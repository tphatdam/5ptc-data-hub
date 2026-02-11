import { ExchangeDTO, IndexDTO, SymbolDTO } from '../sources/seed.dto';

export const STATIC_EXCHANGES: ExchangeDTO[] = [
  { code: 'HOSE', name: 'Ho Chi Minh Stock Exchange' },
  { code: 'HNX', name: 'Hanoi Stock Exchange' },
  { code: 'UPCOM', name: 'Unlisted Public Company Market' },
];

export const STATIC_INDICES: IndexDTO[] = [
  { code: 'VNINDEX', name: 'VN Index', exchangeCode: 'HOSE' },
  { code: 'VN30', name: 'VN30 Index', exchangeCode: 'HOSE' },
  { code: 'HNXINDEX', name: 'HNX Index', exchangeCode: 'HNX' },
  { code: 'UPCOMINDEX', name: 'UPCOM Index', exchangeCode: 'UPCOM' },
];

export const STATIC_SYMBOLS: SymbolDTO[] = [
  {
    ticker: 'VCB',
    exchangeCode: 'HOSE',
    companyName: 'Vietcombank',
    industry: 'Banks',
  },
  {
    ticker: 'VNM',
    exchangeCode: 'HOSE',
    companyName: 'Vinamilk',
    industry: 'Food & Beverage',
  },
  {
    ticker: 'FPT',
    exchangeCode: 'HOSE',
    companyName: 'FPT Corporation',
    industry: 'Technology',
  },
  {
    ticker: 'PVT',
    exchangeCode: 'HNX',
    companyName: 'PetroVietnam Construction',
    industry: 'Construction',
  },
  {
    ticker: 'SHS',
    exchangeCode: 'UPCOM',
    companyName: 'Saigon - Hanoi Securities',
    industry: 'Securities',
  },
];
