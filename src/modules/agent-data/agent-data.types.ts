export interface AgentResponseMeta {
  source: 'local';
  storage: 'db' | 'live_fallback';
  provider?: string;
  asOf?: string;
  stale?: boolean;
}

export function metaDb(asOf?: string): AgentResponseMeta {
  return { source: 'local', storage: 'db', asOf: asOf ?? new Date().toISOString() };
}

export function metaLiveFallback(provider: string, asOf?: string): AgentResponseMeta {
  return {
    source: 'local',
    storage: 'live_fallback',
    provider,
    asOf: asOf ?? new Date().toISOString(),
  };
}
