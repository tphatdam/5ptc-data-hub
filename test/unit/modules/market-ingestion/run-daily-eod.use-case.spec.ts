import { Test } from '@nestjs/testing';
import { RunDailyEodUseCase } from '../../../../src/modules/market-ingestion/application/use-cases/run-daily-eod.use-case';
import { MARKET_INGESTION_PORT } from '../../../../src/modules/market-ingestion/domain/ports/tokens';

describe('RunDailyEodUseCase', () => {
  const marketIngestionPort = {
    runQuoteHourly: jest.fn(async () => undefined),
    runDailyCompany: jest.fn(async () => undefined),
    runDailyEod: jest.fn(async () => undefined),
  };

  let useCase: RunDailyEodUseCase;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RunDailyEodUseCase,
        { provide: MARKET_INGESTION_PORT, useValue: marketIngestionPort },
      ],
    }).compile();

    useCase = moduleRef.get(RunDailyEodUseCase);
  });

  it('executes daily-eod flow through market ingestion port', async () => {
    await useCase.execute();
    expect(marketIngestionPort.runDailyEod).toHaveBeenCalledTimes(1);
  });

  it('rethrows errors from market ingestion port', async () => {
    marketIngestionPort.runDailyEod.mockRejectedValueOnce(new Error('boom'));
    await expect(useCase.execute()).rejects.toThrow('boom');
  });
});
