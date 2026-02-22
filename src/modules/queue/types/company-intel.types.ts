export interface CompanyIntelBaseJobPayload {
  cycleId: string;
  timeBucket: string;
  symbolId: number;
  ticker: string;
  from: string;
  to: string;
  attempt: number;
}

export interface CompanyIntelForeignJobPayload extends CompanyIntelBaseJobPayload {
  jobType: 'foreign';
}

export interface CompanyIntelInsiderJobPayload extends CompanyIntelBaseJobPayload {
  jobType: 'insider';
}
