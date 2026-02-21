export interface CompanyIntelBasePayload {
  cycleId: string;
  timeBucket: string;
  from: string;
  to: string;
  symbolId: number;
  ticker: string;
  attempt: number;
}

export interface CompanyIntelForeignJobPayload extends CompanyIntelBasePayload {
  jobType: 'foreign';
}

export interface CompanyIntelInsiderJobPayload extends CompanyIntelBasePayload {
  jobType: 'insider';
}
