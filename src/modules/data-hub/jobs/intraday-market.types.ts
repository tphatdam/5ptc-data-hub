export interface IntradayMarketBasePayload {
  cycleId: string;
  timeBucket: string;
  from: string;
  to: string;
}

export interface IntradayStockJobPayload extends IntradayMarketBasePayload {
  symbolId: number;
  ticker: string;
}

export interface IntradayIndexJobPayload extends IntradayMarketBasePayload {
  indexId: number;
  indexCode: string;
}
