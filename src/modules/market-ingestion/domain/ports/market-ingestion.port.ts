export interface MarketIngestionPort {
  runQuoteHourly(): Promise<void>;
  runDailyCompany(): Promise<void>;
}
