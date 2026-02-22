export type TriggerRunStatusValue = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAIL';
export type TriggerStepStatusValue = 'RUNNING' | 'SUCCESS' | 'FAIL' | 'SKIP';

export interface TriggerRunStepStatusDto {
  step: string;
  status: TriggerStepStatusValue;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

export interface TriggerRunStatusDto {
  runId: string;
  status: TriggerRunStatusValue;
  startedAt: string | null;
  finishedAt: string | null;
  summary: {
    totalSteps: number;
    success: number;
    failed: number;
    skipped: number;
  };
  steps: TriggerRunStepStatusDto[];
}
