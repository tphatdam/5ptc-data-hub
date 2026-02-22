export interface IntradayStockJobPayload {
  cycleId: string;
  timeBucket: string;
  symbolId: number;
  ticker: string;
  from: string;
  to: string;
}

export interface IntradayIndexJobPayload {
  cycleId: string;
  timeBucket: string;
  indexId: number;
  indexCode: string;
  from: string;
  to: string;
}
