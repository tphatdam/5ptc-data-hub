# Exchange Provider Module

Canonical business entrypoint for exchange data runtime.

Current cutover strategy:

- `ExchangeProviderModule` aggregates all market-data related modules.
- `AppModule` imports only `ExchangeProviderModule` for business features.
- Existing modules are still kept for compatibility in this release.

Target structure for subsequent cleanup:

- `application/` - use cases and orchestration
- `domain/` - ports, models, and contracts
- `infrastructure/` - providers, repositories, queue, and persistence adapters
- `presentation/` - controllers and transport adapters
