# Stock Report PDF Generator - Usage Guide

## Overview
The `/generate-stock-report` endpoint generates comprehensive Vietnamese financial analysis reports as downloadable PDF files.

## How to Use

### Using cURL
```bash
curl -X POST https://your-repl-url.repl.dev/generate-stock-report \
  -H "Content-Type: application/json" \
  -d '{"stock_code": "VNM"}' \
  --output VNM-stock-report.pdf
```

### Using JavaScript/Fetch
```javascript
const response = await fetch('https://your-repl-url.repl.dev/generate-stock-report', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ stock_code: 'VNM' })
});

const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'VNM-stock-report.pdf';
a.click();
```

## Report Structure

The generated PDF includes 5 comprehensive sections:

1. **Điểm Nhấn Chính** (Key Highlights)
   - 4-6 bullet points summarizing major events and metrics

2. **Tổng Quan Kinh Doanh** (Business Overview)
   - Executive summary
   - Segment analysis
   - Industry context
   - Optional financial charts

3. **Phân Tích Tài Chính** (Financial Analysis)
   - Key metrics (ROE, margins, debt ratio, etc.)
   - Risk assessment
   - Financial visualizations

4. **Định Giá & Triển Vọng** (Valuation & Outlook)
   - Multiple valuation scenarios (negative/neutral/positive)
   - Growth catalysts
   - Main risks

5. **Kết Luận Đầu Tư** (Investment Conclusion)
   - Recommendation (MUA/GIỮ/BÁN)
   - Investment score (1-10)
   - Detailed reasoning

## Important Notes

- **Processing Time**: Report generation takes 2-5 minutes due to AI analysis
- **Timeout**: Maximum 5-minute timeout
- **File Format**: Returns PDF with filename format: `{STOCK_CODE}-stock-report.pdf`
- **Charts**: Includes Chart.js visualizations for financial data
- **Language**: All content is in Vietnamese

## API Documentation

Visit `/api-docs` for interactive Swagger documentation and testing interface.

## Example Stock Codes

- VNM (Vinamilk)
- VIC (Vingroup)
- VHM (Vinhomes)
- HPG (Hoa Phat Group)
- FPT (FPT Corporation)
