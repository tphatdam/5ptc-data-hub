export type TriggerRunMode = 'full';

export interface TriggerRunAllJobPayload {
  runId: string;
  mode: TriggerRunMode;
}
