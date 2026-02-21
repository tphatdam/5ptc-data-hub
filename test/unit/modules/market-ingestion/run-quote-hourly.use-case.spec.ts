import { Test } from '@nestjs/testing';
import { RunQuoteHourlyUseCase } from '../../../../src/modules/market-ingestion/application/use-cases/run-quote-hourly.use-case';
import { MARKET_INGESTION_PORT } from '../../../../src/modules/market-ingestion/domain/ports/tokens';

describe('RunQuoteHourlyUseCase', () => {
  const marketIngestionPort = {
    runQuoteHourly: jest.fn(async () => undefined),
    runDailyCompany: jest.fn(async () => undefined),
    runDailyEod: jest.fn(async () => undefined),
  };

  let useCase: RunQuoteHourlyUseCase;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RunQuoteHourlyUseCase,
        { provide: MARKET_INGESTION_PORT, useValue: marketIngestionPort },
      ],
    }).compile();

    useCase = moduleRef.get(RunQuoteHourlyUseCase);
  });

  it('executes quote-hourly flow through market ingestion port', async () => {
    await useCase.execute();
    expect(marketIngestionPort.runQuoteHourly).toHaveBeenCalledTimes(1);
  });

  it('rethrows errors from market ingestion port', async () => {
    marketIngestionPort.runQuoteHourly.mockRejectedValueOnce(new Error('boom'));
    await expect(useCase.execute()).rejects.toThrow('boom');
  });
});
