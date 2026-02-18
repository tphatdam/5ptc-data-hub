import { Injectable, Logger } from '@nestjs/common';
import {
  AnyDataProvider,
  ProviderCapability,
  RegisteredProvider,
} from './interfaces';

interface ProviderRegistration {
  code: string;
  provider: AnyDataProvider;
  capabilities: ProviderCapability[];
}

@Injectable()
export class ProviderRegistryService {
  private readonly logger = new Logger(ProviderRegistryService.name);

  private readonly providersByCapability = new Map<
    ProviderCapability,
    Map<string, AnyDataProvider>
  >();

  register(registration: ProviderRegistration): void {
    const { code, provider, capabilities } = registration;

    for (const capability of capabilities) {
      if (!this.providersByCapability.has(capability)) {
        this.providersByCapability.set(capability, new Map<string, AnyDataProvider>());
      }

      const capabilityProviders = this.providersByCapability.get(capability)!;
      capabilityProviders.set(code, provider);
    }

    this.logger.debug(
      `Registered provider ${code} with capabilities: ${capabilities.join(', ')}`,
    );
  }

  listByCapability<TProvider extends AnyDataProvider>(
    capability: ProviderCapability,
  ): Array<RegisteredProvider<TProvider>> {
    const capabilityProviders = this.providersByCapability.get(capability);
    if (!capabilityProviders) {
      return [];
    }

    return Array.from(capabilityProviders.entries()).map(([code, provider]) => ({
      code,
      provider: provider as TProvider,
    }));
  }

  getByCode<TProvider extends AnyDataProvider>(
    capability: ProviderCapability,
    code: string,
  ): RegisteredProvider<TProvider> | null {
    const capabilityProviders = this.providersByCapability.get(capability);
    if (!capabilityProviders) {
      return null;
    }

    const provider = capabilityProviders.get(code);
    if (!provider) {
      return null;
    }

    return {
      code,
      provider: provider as TProvider,
    };
  }
}
