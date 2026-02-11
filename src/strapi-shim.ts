/**
 * Runtime shim for legacy strapi.log usage in existing code.
 * New code must use PinoLogger (nestjs-pino) instead.
 */
(globalThis as any).strapi = {
  log: {
    info: (...args: unknown[]) => console.log('[strapi]', ...args),
    warn: (...args: unknown[]) => console.warn('[strapi]', ...args),
    error: (...args: unknown[]) => console.error('[strapi]', ...args),
    debug: (...args: unknown[]) => console.debug('[strapi]', ...args),
  },
};
