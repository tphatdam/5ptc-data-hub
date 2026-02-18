import { Injectable, Logger } from '@nestjs/common';
import {
  FundamentalsProvider,
  GoldPriceProvider,
  MarketDataProvider,
  NewsProvider,
  SymbolListProvider,
  AnyDataProvider,
} from './interfaces';
import {
  ProviderFactoryService,
  ProviderEntry,
} from './provider-factory.service';
import {
  IngestionLogMeta,
  logPayload,
  toLogError,
} from '../../../common/logging/ingestion-log';

type AsyncMethodKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => Promise<any> ? K : never;
}[keyof T];

type AsyncMethodArgs<T, K extends AsyncMethodKeys<T>> = T[K] extends (
  ...args: infer A
) => Promise<any>
  ? A
  : never;

type AsyncMethodReturn<T, K extends AsyncMethodKeys<T>> = T[K] extends (
  ...args: any[]
) => Promise<infer R>
  ? R
  : never;

export interface ProviderInvocationResult<T> {
  providerCode: string;
  value: T;
}

export interface ProviderFallbackHookContext {
  providerCode: string;
  attempt: number;
  error?: string;
  valueCount?: number;
}

export interface ProviderFallbackHooks {
  onChainStart?: (providerCodes: string[]) => void;
  onProviderTry?: (context: ProviderFallbackHookContext) => void;
  onProviderFail?: (context: ProviderFallbackHookContext) => void;
  onProviderSuccess?: (context: ProviderFallbackHookContext) => void;
}

export interface ProviderInvokeOptions {
  preferredCodes?: string[];
  logContext?: IngestionLogMeta;
  hooks?: ProviderFallbackHooks;
}

type ProviderInvokeInput = string[] | ProviderInvokeOptions | undefined;

@Injectable()
export class DynamicProviderAdapter {
  private readonly logger = new Logger(DynamicProviderAdapter.name);

  constructor(private readonly providerFactory: ProviderFactoryService) {}

  async invokeMarket<K extends AsyncMethodKeys<MarketDataProvider>>(
    methodName: K,
    args: AsyncMethodArgs<MarketDataProvider, K>,
    preferredCodesOrOptions?: ProviderInvokeInput,
  ): Promise<ProviderInvocationResult<AsyncMethodReturn<MarketDataProvider, K>>> {
    const options = this.resolveOptions(preferredCodesOrOptions);
    const providers = await this.providerFactory.getMarketProviderEntries(
      options.preferredCodes,
    );
    return this.invokeWithFallback('market', providers, methodName, args, options);
  }

  async invokeFundamentals<K extends AsyncMethodKeys<FundamentalsProvider>>(
    methodName: K,
    args: AsyncMethodArgs<FundamentalsProvider, K>,
    preferredCodesOrOptions?: ProviderInvokeInput,
  ): Promise<ProviderInvocationResult<AsyncMethodReturn<FundamentalsProvider, K>>> {
    const options = this.resolveOptions(preferredCodesOrOptions);
    const providers = await this.providerFactory.getFundamentalsProviderEntries(
      options.preferredCodes,
    );
    return this.invokeWithFallback(
      'fundamentals',
      providers,
      methodName,
      args,
      options,
    );
  }

  async invokeGold<K extends AsyncMethodKeys<GoldPriceProvider>>(
    methodName: K,
    args: AsyncMethodArgs<GoldPriceProvider, K>,
    preferredCodesOrOptions?: ProviderInvokeInput,
  ): Promise<ProviderInvocationResult<AsyncMethodReturn<GoldPriceProvider, K>>> {
    const options = this.resolveOptions(preferredCodesOrOptions);
    const providers = await this.providerFactory.getGoldProviderEntries(
      options.preferredCodes,
    );
    return this.invokeWithFallback('gold', providers, methodName, args, options);
  }

  async invokeNews<K extends AsyncMethodKeys<NewsProvider>>(
    methodName: K,
    args: AsyncMethodArgs<NewsProvider, K>,
    preferredCodesOrOptions?: ProviderInvokeInput,
  ): Promise<ProviderInvocationResult<AsyncMethodReturn<NewsProvider, K>>> {
    const options = this.resolveOptions(preferredCodesOrOptions);
    const providers = await this.providerFactory.getNewsProviderEntries(
      options.preferredCodes,
    );
    return this.invokeWithFallback('news', providers, methodName, args, options);
  }

  async invokeSymbolList<K extends AsyncMethodKeys<SymbolListProvider>>(
    methodName: K,
    args: AsyncMethodArgs<SymbolListProvider, K>,
    preferredCodesOrOptions?: ProviderInvokeInput,
  ): Promise<ProviderInvocationResult<AsyncMethodReturn<SymbolListProvider, K>>> {
    const options = this.resolveOptions(preferredCodesOrOptions);
    const providers = await this.providerFactory.getSymbolListProviderEntries(
      options.preferredCodes,
    );
    return this.invokeWithFallback('symbol-list', providers, methodName, args, options);
  }

  private resolveOptions(input: ProviderInvokeInput): ProviderInvokeOptions {
    if (Array.isArray(input)) {
      return { preferredCodes: input };
    }
    return input || {};
  }

  private async invokeWithFallback<
    TProvider extends AnyDataProvider,
    K extends AsyncMethodKeys<TProvider>,
  >(
    capabilityName: string,
    providers: Array<ProviderEntry<TProvider>>,
    methodName: K,
    args: AsyncMethodArgs<TProvider, K>,
    options: ProviderInvokeOptions,
  ): Promise<ProviderInvocationResult<AsyncMethodReturn<TProvider, K>>> {
    if (providers.length === 0) {
      throw new Error(`No ${capabilityName} providers are registered`);
    }

    const logContext: IngestionLogMeta = {
      module: 'data-hub.dynamic-provider',
      ...(options.logContext || {}),
    };
    const providerCodes = providers.map((provider) => provider.code);
    options.hooks?.onChainStart?.(providerCodes);

    this.logger.log(
      logPayload({
        ...logContext,
        event: 'fallback_chain_start',
        status: 'started',
        capabilityName,
        methodName: String(methodName),
        providerChain: providerCodes,
      }),
    );

    const errors: string[] = [];

    for (let attempt = 0; attempt < providers.length; attempt += 1) {
      const entry = providers[attempt];
      const attemptNumber = attempt + 1;
      const maybeMethod = entry.provider[methodName];

      this.logger.log(
        logPayload({
          ...logContext,
          event: 'fallback_provider_try',
          status: 'started',
          providerCode: entry.code,
          attempt: attemptNumber,
          capabilityName,
          methodName: String(methodName),
        }),
      );
      options.hooks?.onProviderTry?.({
        providerCode: entry.code,
        attempt: attemptNumber,
      });

      if (typeof maybeMethod !== 'function') {
        const message = `method ${String(methodName)} is not implemented`;
        errors.push(`${entry.code}: ${message}`);
        this.logger.warn(
          logPayload({
            ...logContext,
            event: 'fallback_provider_fail',
            status: 'failed',
            providerCode: entry.code,
            attempt: attemptNumber,
            error: message,
          }),
        );
        options.hooks?.onProviderFail?.({
          providerCode: entry.code,
          attempt: attemptNumber,
          error: message,
        });
        continue;
      }

      try {
        const method = maybeMethod as unknown as (
          ...invokeArgs: AsyncMethodArgs<TProvider, K>
        ) => Promise<AsyncMethodReturn<TProvider, K>>;
        const value = await method(...args);
        const valueCount = Array.isArray(value) ? value.length : undefined;

        this.logger.log(
          logPayload({
            ...logContext,
            event: 'fallback_provider_success',
            status: 'succeeded',
            providerCode: entry.code,
            attempt: attemptNumber,
            processed: valueCount,
          }),
        );
        options.hooks?.onProviderSuccess?.({
          providerCode: entry.code,
          attempt: attemptNumber,
          valueCount,
        });

        return {
          providerCode: entry.code,
          value,
        };
      } catch (error: unknown) {
        const message = toLogError(error);
        errors.push(`${entry.code}: ${message}`);

        this.logger.warn(
          logPayload({
            ...logContext,
            event: 'fallback_provider_fail',
            status: 'failed',
            providerCode: entry.code,
            attempt: attemptNumber,
            error: message,
          }),
        );
        options.hooks?.onProviderFail?.({
          providerCode: entry.code,
          attempt: attemptNumber,
          error: message,
        });
      }
    }

    throw new Error(
      `All ${capabilityName} providers failed for ${String(methodName)}: ${errors.join(
        ' | ',
      )}`,
    );
  }
}
