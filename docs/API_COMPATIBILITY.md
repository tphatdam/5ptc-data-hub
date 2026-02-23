# API Compatibility Layer

## Danh sách file đã tạo/sửa

### Tạo mới
- `src/common/guards/api-key.guard.ts` – Global guard x-api-key, public /health, /api/health
- `src/common/filters/api-exception.filter.ts` – Format lỗi `{ success: false, error, message }` cho /api
- `src/common/interceptors/api-logging.interceptor.ts` – requestId, duration
- `src/common/cache/cache.module.ts` – CacheModule + CACHE_TTL
- `src/modules/api-compatibility/providers/interfaces.ts`
- `src/modules/api-compatibility/providers/vietstock.provider.ts`
- `src/modules/api-compatibility/providers/fireant.provider.ts`
- `src/modules/api-compatibility/providers/ai-crawler.provider.ts`
- `src/modules/api-compatibility/providers/vnstock.provider.ts`
- `src/modules/api-compatibility/providers/sstock-api.provider.ts`
- `src/modules/api-compatibility/providers/simplize-api.provider.ts`
- `src/modules/api-compatibility/providers/api-providers.module.ts`
- `src/modules/api-compatibility/providers/index.ts`
- `src/modules/market-content/dto/articles.dto.ts`
- `src/modules/market-content/market-content-api.service.ts`
- `src/modules/market-content/market-content-api.controller.ts`
- `src/modules/market-pricing/market-pricing-api.service.ts`
- `src/modules/market-pricing/market-pricing-api.controller.ts`
- `src/modules/market-company/stock-api.service.ts`
- `src/modules/market-company/stock-api.controller.ts`
- `src/modules/market-company/sstock-proxy.service.ts`
- `src/modules/market-company/sstock-proxy.controller.ts`
- `src/modules/market-recommendation/market-recommendation-api.service.ts`
- `src/modules/market-recommendation/market-recommendation-api.controller.ts`
- `src/modules/market-recommendation/market-recommendation.module.ts`
- `src/modules/market-reporting/market-reporting-api.service.ts`
- `src/modules/market-reporting/market-reporting-api.controller.ts`
- `src/modules/market-reporting/market-reporting.module.ts`
- `jest-e2e.config.js`
- `test/api-compatibility.e2e-spec.ts`

### Sửa
- `src/config/configuration.ts` – Thêm internalApiKey, vnStock, vietstock, fireant, aiCrawler, vndirect, payment
- `src/config/validate-env.ts` – Thêm biến optional cho API compatibility
- `src/app.module.ts` – CacheModule, APP_GUARD ApiKeyGuard
- `src/main.ts` – ApiExceptionFilter, ApiLoggingInterceptor, Swagger description
- `src/modules/health/health.controller.ts` – GET /api/health
- `src/modules/market-content/market-content.module.ts` – Controller, service, CONTENT_PROVIDER
- `src/modules/market-pricing/market-pricing.module.ts` – Controller, service, PRICING_PROVIDER
- `src/modules/market-company/market-company.module.ts` – Controllers, services, SStock proxy
- `src/modules/exchange-provider/exchange-provider.module.ts` – MarketRecommendationModule, MarketReportingModule
- `package.json` – test:e2e script, @nestjs/cache-manager, cache-manager, supertest
- `.env.example` – Biến API compatibility

---

## Mapping endpoint -> service / provider

| Endpoint | Service | Provider adapter |
|----------|---------|------------------|
| /api/articles, /api/news, /api/comments, /api/categories, /api/filters, /api/tickers, /api/seo | MarketContentApiService | AiCrawlerProvider (CONTENT_PROVIDER) |
| /api/market, /api/marketboard/*, /api/gold-prices, /api/exchange-rates, /api/vietstock/industries, /api/market-sentiment, /api/top-stocks, ... | MarketPricingApiService | VnStockProvider (PRICING_PROVIDER) |
| /api/stocks, /api/stock/profile|info|price/:symbol, /api/validate-related-stocks | StockApiService | SStockApiProvider (STOCK_PROVIDER) |
| /api/sstock?path=... | SStockProxyService | SStockApiProvider |
| /api/recommendations, /api/watchlists, /api/alerts, /api/notifications | MarketRecommendationApiService | SStockApiProvider (RECOMMENDATION_PROVIDER) |
| /api/onboarding/*, /api/payment/*, /api/daily-report, /api/get-stock-report, /api/mark-download | MarketReportingApiService | AiCrawlerProvider (REPORTING_PROVIDER) |

---

## 10 lệnh curl mẫu (x-api-key)

Thay `$KEY` bằng giá trị `INTERNAL_API_KEY`. Base URL mặc định: `http://localhost:5000`.

```bash
# 1. Health (public, không cần key)
curl -s http://localhost:5000/health
curl -s http://localhost:5000/api/health

# 2. Articles
curl -s -H "x-api-key: $KEY" "http://localhost:5000/api/articles"

# 3. Market
curl -s -H "x-api-key: $KEY" "http://localhost:5000/api/market"

# 4. Marketboard index-quote
curl -s -X POST -H "x-api-key: $KEY" -H "Content-Type: application/json" -d '{}' "http://localhost:5000/api/marketboard/index-quote"

# 5. Gold prices
curl -s -H "x-api-key: $KEY" "http://localhost:5000/api/gold-prices"

# 6. Stock profile
curl -s -H "x-api-key: $KEY" "http://localhost:5000/api/stock/profile/VNM"

# 7. SStock proxy
curl -s -H "x-api-key: $KEY" "http://localhost:5000/api/sstock?path=/api/v1/company/all"

# 8. Watchlists
curl -s -H "x-api-key: $KEY" "http://localhost:5000/api/watchlists"

# 9. Alerts
curl -s -H "x-api-key: $KEY" "http://localhost:5000/api/alerts"

# 10. Payment check-success
curl -s -H "x-api-key: $KEY" "http://localhost:5000/api/payment/check-success/sample-txn-ref"
```

---

## Cache TTL

- gold-prices: 60s  
- exchange-rates: 15m (900s)  
- stock price: 30s  
- stock profile/info: 5m (300s)  
- market-sentiment: 30s  
