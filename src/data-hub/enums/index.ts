export enum DataSourceType {
  MARKET = 'MARKET',
  NEWS = 'NEWS',
  GOLD = 'GOLD',
}

export enum CandleInterval {
  DAILY = '1d',
  INTRADAY_15M = '15m',
}

export enum GoldProvider {
  SJC = 'SJC',
  DOJI = 'DOJI',
  PNJ = 'PNJ',
}

export enum JobStatus {
  SUCCESS = 'SUCCESS',
  FAIL = 'FAIL',
  SKIP = 'SKIP',
}

export enum ExchangeCode {
  HOSE = 'HOSE',
  HNX = 'HNX',
  UPCOM = 'UPCOM',
}

export enum MarketIndexCode {
  VNINDEX = 'VNINDEX',
  HNXINDEX = 'HNXINDEX',
  UPCOMINDEX = 'UPCOMINDEX',
}
