export interface ExchangeDTO {
  code: string;
  name: string;
}

export interface SymbolDTO {
  ticker: string;
  exchangeCode: string;
  companyName?: string;
  industry?: string;
  isin?: string;
  listedAt?: Date;
}

export interface IndexDTO {
  code: string;
  name: string;
  exchangeCode?: string;
}
