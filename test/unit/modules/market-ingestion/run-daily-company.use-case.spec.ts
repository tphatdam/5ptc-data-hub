import { Test } from '@nestjs/testing';
import { RunDailyCompanyUseCase } from '../../../../src/modules/market-ingestion/application/use-cases/run-daily-company.use-case';
import { MARKET_INGESTION_PORT } from '../../../../src/modules/market-ingestion/domain/ports/tokens';

describe('RunDailyCompanyUseCase', () => {
  const marketIngestionPort = {
    runQuoteHourly: jest.fn(async () => undefined),
    runDailyCompany: jest.fn(async () => undefined),
  };

  let useCase: RunDailyCompanyUseCase;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RunDailyCompanyUseCase,
        { provide: MARKET_INGESTION_PORT, useValue: marketIngestionPort },
      ],
    }).compile();

    useCase = moduleRef.get(RunDailyCompanyUseCase);
  });

  it('executes daily-company flow through market ingestion port', async () => {
    await useCase.execute();
    expect(marketIngestionPort.runDailyCompany).toHaveBeenCalledTimes(1);
  });

  it('rethrows errors from market ingestion port', async () => {
    marketIngestionPort.runDailyCompany.mockRejectedValueOnce(new Error('boom'));
    await expect(useCase.execute()).rejects.toThrow('boom');
  });
});
