# Financial Analysis & PDF Generator Service

## Overview
This NestJS service provides three core functionalities: generating comprehensive financial analysis reports for Vietnamese stocks using AI, converting JSON data into professionally formatted PDF documents, and offering AI question-answering capabilities. The project aims to deliver a robust, production-ready service, emphasizing interactive API documentation, efficient resource management, and secure operations. It focuses on providing detailed Vietnamese stock market insights and high-quality PDF output.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes
**January 15, 2026**: Implemented comprehensive Vietnam Finance Data Hub with PostgreSQL schema and scheduled data ingestion.

**Database Schema (10 tables)**:
- `data_source`: External data provider registry (MARKET|NEWS|GOLD types)
- `exchange`: HOSE, HNX, UPCOM exchanges
- `symbol`: Stock tickers with company info, linked to exchanges
- `market_index`: VNINDEX, HNXINDEX, UPCOMINDEX, VN30
- `index_candle`: OHLCV data for indices (1d|15m intervals)
- `stock_candle`: OHLCV data for stocks with unique constraint (symbol_id, interval, ts)
- `stock_snapshot`: Fundamental data (PE, EPS, market cap, free float)
- `gold_price`: SJC/DOJI/PNJ gold prices
- `news_article`: Financial news with tickers/tags arrays and GIN indexes
- `job_run`: Job execution audit log with status tracking

**Scheduled Jobs** (using @nestjs/schedule):
- `IntradayMarketJob`: Every 15 min during trading hours (09:00-11:30, 13:00-15:00)
- `EodDailyJob`: 15:35 Mon-Fri, fetch daily candles
- `FundamentalsJob`: 02:00 daily, fetch PE/EPS/market cap
- `GoldJob`: 07:00 daily, fetch gold prices
- `NewsJob`: Every 15 min, fetch latest articles
- `SymbolSyncJob`: Sunday 03:00, sync ticker list
- `GapFillJob`: 16:00 daily, fill missing intraday data

**Key Services**:
- `MarketHoursService`: VN trading hours detection with holiday support
- `HttpClientService`: Axios with retry (3x), timeout (10s), rate limiting (3 rps via Bottleneck)
- `AdvisoryLockService`: pg_try_advisory_lock for distributed locking
- `JobRunService`: Structured logging with run_id, in-memory concurrency guard
- `UpsertService`: Batch upserts with ON CONFLICT DO UPDATE, 500-row batches
- `TcbsProvider`: Implementation fetching from TCBS Securities API

**API Endpoints**:
- `GET /data-hub/health`: Health check with trading status
- `GET /data-hub/metrics`: Symbol and candle counts
- `GET /data-hub/jobs/status`: Job execution history

**Commands**: `npm run db:seed` populates exchanges, indices, and data sources.

**January 12, 2026**: Redesigned GET /daily-stock-report/:stockCode API endpoint with "get today's report if exists, else create placeholder and enqueue background job" pattern. Key changes: (1) Made `url` column nullable in DailyStockReportEntity to support placeholder rows; (2) Added `status` field to response DTO with 'PENDING' or 'READY' values; (3) Implemented `getOrCreateToday()` method using Asia/Ho_Chi_Minh timezone via date-fns-tz; (4) Uses createQueryBuilder with string date parameters for timezone-safe idempotent queries; (5) Updated report processor and queue service to handle optional email (skips notifications when email not provided); (6) Added 12 unit tests covering idempotency, normalization, and status handling. The unique index on (stock, reportDate) prevents duplicate placeholders at database level.

**January 12, 2026**: Added `investmentRecommendation` column to daily stock reports. New `InvestmentRecommendation` enum with Vietnamese values (Giữ/Mua/Bán). The report processor now extracts recommendations from the AI-generated conclusion section and persists them to the database. Column is nullable for backwards compatibility with existing records.

**November 17, 2025**: Enhanced PDF visual design to professional investment report standards. Comprehensive CSS/HTML improvements: modern system font stack with optimized line-height (1.8 body, 1.3 headings) and letter-spacing; A4-compliant layout (210mm max-width, 60/50px margins, 50px section spacing); refined header with gradient background and 3px border; enhanced financial tables with zebra striping, right-aligned numbers, and subtle borders (#e2e8f0); improved section hierarchy with larger font sizes and consistent spacing; refined color scheme (darker slate blues #0f172a, softer grays #f8fafc) for better contrast; polished scenario cards and recommendation boxes with shadows and improved typography; enhanced chart containers with light borders. All changes verified compatible with HTML2PDFRocket API.

**November 17, 2025**: Replaced PDF-Lib with **HTML2PDFRocket API** for cloud-based PDF generation. Integrated secure HTTPS API (https://api.html2pdfrocket.com/pdf) with form-urlencoded POST requests containing API key and HTML content. PdfService now uses axios with 60-second timeout and arraybuffer response handling. Removed all local PDF generation dependencies (pdf-lib, @pdf-lib/fontkit, fonts directory) and Puppeteer/Chromium. Benefits: Full HTML/CSS/Chart.js rendering restored, Vietnamese Unicode support, zero local system dependencies, no browser process, cloud scalability. Comprehensive error handling for authentication failures (401/403), rate limits (429), timeouts, and network errors with structured logging. API key managed securely via environment variables (HTML2PDFROCKET_API_KEY).


**October 28, 2025**: Achieved 100% notification reliability with atomic claim mechanism and comprehensive error logging. Added `notificationSent` boolean column to DailyStockReportEntity to track notification state. Implemented atomic claim with failure revert in ReportProcessor: `atomicClaimNotification` uses `UPDATE ... WHERE notificationSent = false` to prevent duplicate notifications during job retries, and `revertNotificationClaim` restores the flag if subsequent steps fail. Fresh report generation blocks until notification succeeds, using `retryStep` (5 attempts, 3-second delays) with early `AI_STOCK_API_URL` validation. Cached report access notifications (DailyStockReportService) use fire-and-forget async wrapper with `retryStep` and comprehensive error logging including HTTP status, network errors, stack traces, and request config. All errors propagate correctly for retry behavior. The system now guarantees no duplicate notifications for fresh generation and provides full diagnostic visibility for all failure scenarios.

**October 24, 2025**: Implemented two-tier retry system for stock report generation. Created `retryStep` utility function that retries individual steps up to 5 times with 3-second delays before propagating failures. All main steps (AI generation, HTML generation, PDF generation, S3 upload, database save) now retry locally before triggering job-level retries. This provides granular resilience: transient failures in individual steps are recovered quickly (15 seconds max), while persistent failures fall back to Bull's job-level retry with 20 attempts and 3-minute delays. Enhanced `handleGenerateStockReport` to use Bull's native retry mechanism, extracted report generation logic into `executeReportGeneration` method, and added generic `addJob` method to QueueService.

**October 22, 2025**: Added PDF URL validation in `notifyApiAboutReport` to throw errors when attempting to send null, undefined, or empty PDF URLs to the external API. This prevents invalid data from being sent and provides clear error messages for debugging.

**October 22, 2025**: Enhanced daily stock report email delivery to send template emails in both scenarios: when returning cached reports and when generating new reports. Both paths now use template ID 354 with consistent parameters (stock, url, date).

**October 22, 2025**: Fixed daily stock report deduplication by using `reportDate >= midnight` comparison instead of exact `createdAt` timestamp matching.

## System Architecture

### Backend Architecture
The service is built with **NestJS** (v10+) and TypeScript, following a modular design. It uses **HTML2PDFRocket API** for cloud-based PDF generation with full HTML/CSS/Chart.js rendering support. The PdfService makes HTTPS requests to the external API with 60-second timeout. Request processing includes timeout handling and comprehensive error management for API failures.

### NestJS Module Architecture
The application is organized into eight main modules:
-   **AppModule**: Root module.
-   **PdfModule**: Handles PDF generation, stock reports, and HTML rendering.
-   **AiModule**: Manages AI/OpenAI integration.
-   **HealthModule**: Provides system health check endpoints.
-   **DailyStockReportModule**: Manages automated daily stock report generation with deduplication.
-   **QueueModule**: Handles async job processing using Bull and Redis.
-   **BrevoModule**: Email service integration.
-   **S3Module**: AWS S3 integration for report storage.
-   **DataHubModule**: Vietnam finance data ingestion and storage hub.

### API Design
The API is a REST interface with seven main endpoints:
-   **POST /daily-stock-report/:stock_code**: Generates daily stock report with deduplication and email delivery.
-   **POST /generate-stock-report**: Generates a multi-section financial report for a Vietnamese stock code, returning a downloadable PDF.
-   **POST /generate-pdf**: Converts JSON data into a PDF document, streaming the output.
-   **POST /test-valuation-prompt**: Test endpoint for AI prompts.
-   **POST /ask**: Provides AI question-answering.
-   **GET /** and **GET /health**: Service health checks.
-   **GET /api-docs**: Interactive Swagger/OpenAPI documentation.

### Stock Report Generation Architecture
Stock report generation creates a 5-section financial analysis. It orchestrates sequential calls to an AI service, maintains conversation context, and uses multi-strategy JSON extraction and validation. Reports are rendered into HTML using a Vietnamese financial template, incorporating **Chart.js** for visualizations, and then converted to PDF via Puppeteer. Reliability features include fast failover to OpenAI's gpt-4o-mini, fallback content, and schema validation.

### HTML/PDF Generation
The service employs dynamic HTML generation by embedding JSON data into a pre-defined HTML template with inline CSS, optimized for A4 page format.

### Error Handling & Validation
Error handling uses NestJS's HttpExceptionFilter. Request validation is enforced through class-validator DTOs with a global ValidationPipe. Security considerations include HTML escaping, content-type validation, request size limits (10MB), and robust resource cleanup.

### Daily Stock Report System
This module provides automated daily stock report generation with deduplication, async processing, cloud storage, and email delivery. It ensures only one report per stock per day is generated.
-   **Database**: PostgreSQL with unique constraint on (stock, reportDate).
-   **Queue System**: Bull + Redis for async job processing.
-   **Storage**: AWS S3 for persistent report storage.
-   **Email**: Brevo for transactional email delivery.
-   **Workflow**: Checks for existing reports, otherwise enqueues async jobs for generation, S3 upload, database persistence, and email delivery.

## External Dependencies

### Runtime Dependencies
-   **NestJS**: Core framework and modules.
-   **TypeScript**: Static typing and compilation.
-   **Validation**: `class-validator` and `class-transformer`.
-   **Axios**: HTTP client for HTML2PDFRocket API integration.
-   **OpenAI**: Official client library for AI integration.
-   **Swagger**: Interactive API documentation.

### System Dependencies
-   None: PDF generation uses cloud-based HTML2PDFRocket API without local browser or native dependencies.

### External Services
-   **HTML2PDFRocket**: Cloud-based HTML-to-PDF conversion service (requires `HTML2PDFROCKET_API_KEY`).
-   **ChatGPT API**: External AI service at `http://173.231.55.42:9577/chatGPT/completions` (configurable via `OPENAI_API_URL`).
-   **OpenAI Official API**: Fallback service using `gpt-4o-mini` (requires `OPENAI_API_KEY`).
-   **PostgreSQL**: Database for daily stock reports.
-   **Redis**: Used by Bull for queue management and caching.
-   **AWS S3**: For storing generated PDF reports.
-   **Brevo**: Email service for sending notifications.

### Infrastructure Requirements
-   **Deployment Environment**: Replit, requiring Nix-based package management and port 5000.