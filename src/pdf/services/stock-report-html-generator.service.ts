import { Injectable } from "@nestjs/common";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { vi } from "date-fns/locale";

interface ReportSection {
  id: string;
  data: any;
  rawAnswer?: string;
  error?: string;
  isFallback?: boolean;
}

interface ReportData {
  stockCode: string;
  sections: ReportSection[];
  generatedAt: string;
  conversationID?: string;
}

interface ChartDataset {
  name: string;
  data: number[];
  unit?: string | null;
}

interface ChartData {
  chart_type?: string;
  title: string;
  labels: string[];
  datasets: ChartDataset[];
}

@Injectable()
export class StockReportHTMLGeneratorService {
  private parseNumericValue(value: any): number | null {
    if (typeof value === "number") return value;
    if (!value) return null;

    const str = String(value);

    const rangeMatch = str.match(
      /(\d+(?:[.,]\d{3})*(?:[.,]\d+)?)\s*[-–—~]\s*(\d+(?:[.,]\d{3})*(?:[.,]\d+)?)/,
    );
    if (rangeMatch) {
      const start = rangeMatch[1]
        .replace(/[.,](?=\d{3})/g, "")
        .replace(",", ".");
      const end = rangeMatch[2].replace(/[.,](?=\d{3})/g, "").replace(",", ".");
      const startNum = parseFloat(start);
      const endNum = parseFloat(end);
      return (startNum + endNum) / 2;
    }

    const cleaned = str.replace(/[.,](?=\d{3})/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  private generateCoverPage(stockCode: string, generatedAt: string): string {
    return `
    <div class="cover-page" style="page-break-after: always; position: relative;">

      <div class="tag-5p">5PHUTTAICHINH</div>

      <div class="cover-top">
        <div class="cover-title">BÁO CÁO PHÂN TÍCH CỔ PHIẾU</div>
        <div class="cover-stock">${stockCode}</div>
      </div>

      <div class="cover-meta">
        <div class="label">Ngày tạo:</div>
        <div class="value">${format(generatedAt, "dd/MM/yyyy HH:mm", { locale: vi })}</div>

        <div class="label">Nền tảng:</div>
        <div class="value">5phuttaichinh.com</div>
      </div>

      <div class="cover-footer">
        Báo cáo được tạo tự động bằng AI dựa trên dữ liệu thị trường. 
        Không phải là lời khuyên đầu tư.
      </div>

    </div>`;
  }

  generateReportHTML(reportData: ReportData): string {
    const { stockCode, sections, generatedAt } = reportData;

    const highlightsSection = sections.find((s) => s.id === "highlights");
    const businessSection = sections.find((s) => s.id === "business_overview");
    const financialSection = sections.find(
      (s) => s.id === "financial_analysis",
    );
    const valuationSection = sections.find((s) => s.id === "valuation");
    const conclusionSection = sections.find((s) => s.id === "conclusion");

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Báo cáo Phân tích Cổ phiếu ${stockCode}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Arial, 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #2d2d2d;
      background: #ffffff;
      padding: 0;
      font-size: 10pt;
    }
    
    .container {
      max-width: 210mm;
      margin: 0 auto;
      background: white;
        padding: 0 40px 60px 40px;
    }
    
    .header {
      background: #C60000;
      padding: 40px 50px 35px 50px;
      margin-bottom: 0;
      border-bottom: 8px solid #8B0000;
    }
    
    .header h1 {
      color: #ffffff;
      font-size: 24pt;
      font-weight: 700;
      margin-bottom: 10px;
      letter-spacing: 0.5px;
      line-height: 1.2;
      text-transform: uppercase;
    }
    
    .header .meta {
      color: #ffffff;
      font-size: 9pt;
      font-weight: 400;
      opacity: 0.95;
      letter-spacing: 0.3px;
    }
    
    .section {
      margin-bottom: 40px;
      page-break-inside: avoid;
      padding: 20px 50px;
    }
    
    .section:first-of-type {
      margin-top: 35px;
    }
    
    .section-title {
      font-size: 15pt;
      font-weight: 700;
      color: #C60000;
      margin-bottom: 20px;
      padding-bottom: 8px;
      border-bottom: 3px solid #C60000;
      letter-spacing: 0px;
      line-height: 1.3;
      text-transform: uppercase;
    }
    
    h3 {
      font-size: 12pt;
      font-weight: 700;
      color: #2d2d2d;
      margin: 24px 0 12px 0;
      letter-spacing: 0px;
      line-height: 1.3;
      text-transform: uppercase;
    }
    
    .highlights {
      background: #fff5f5;
      border: 2px solid #C60000;
      border-left: 6px solid #C60000;
      padding: 20px 25px;
      margin-bottom: 20px;
    }
    
    .highlights ul {
      list-style: none;
      padding-left: 0;
    }
    
    .highlights li {
      padding: 8px 0;
      padding-left: 24px;
      position: relative;
      line-height: 1.6;
      color: #2d2d2d;
    }
    
    .highlights li:before {
      content: "■";
      position: absolute;
      left: 0;
      color: #C60000;
      font-weight: 700;
      font-size: 10pt;
    }
    
    .paragraph {
      margin-bottom: 14px;
      text-align: justify;
      line-height: 1.6;
      color: #2d2d2d;
    }
    
    .focus-points {
      background: #f8f8f8;
      border: 1px solid #d0d0d0;
      border-left: 4px solid #666666;
      padding: 18px 22px;
      margin: 16px 0;
    }
    
    .focus-points strong {
      color: #2d2d2d;
      font-weight: 700;
    }
    
    .focus-points ul {
      padding-left: 22px;
      margin-top: 8px;
    }
    
    .focus-points li {
      margin: 6px 0;
      line-height: 1.5;
      color: #2d2d2d;
    }
    
    .segment {
      background: #fafafa;
      border: 1px solid #d0d0d0;
      padding: 20px;
      margin: 20px 0;
      border-left: 5px solid #C60000;
    }
    
    .segment-title {
      font-size: 11pt;
      font-weight: 700;
      color: #C60000;
      margin-bottom: 10px;
      line-height: 1.3;
    }
    
    .trend-badge {
      display: inline-block;
      padding: 3px 10px;
      font-size: 8pt;
      font-weight: 700;
      margin-left: 10px;
      letter-spacing: 0.3px;
      background: #e8e8e8;
      color: #2d2d2d;
    }
    
    .trend-growing { background: #d4edda; color: #155724; }
    .trend-stable { background: #d1ecf1; color: #0c5460; }
    .trend-declining { background: #f8d7da; color: #721c24; }
    .trend-volatile { background: #fff3cd; color: #856404; }
    .trend-unknown { background: #e8e8e8; color: #2d2d2d; }
    
    .metrics-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      border: 1px solid #d0d0d0;
    }
    
    .metrics-table th,
    .metrics-table td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #d0d0d0;
    }
    
    .metrics-table td:nth-child(2) {
      text-align: right;
      font-weight: 700;
      color: #2d2d2d;
      font-variant-numeric: tabular-nums;
    }
    
    .metrics-table th {
      background: #f0f0f0;
      font-weight: 700;
      color: #2d2d2d;
      font-size: 9pt;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    
    .metrics-table tbody tr:nth-child(even) {
      background: #fafafa;
    }
    
    .metrics-table tbody tr:last-child td {
      border-bottom: none;
    }
    
    .risk-flags {
      background: #fff5f5;
      border: 1px solid #C60000;
      border-left: 5px solid #C60000;
      padding: 18px 22px;
      margin: 16px 0;
    }
    
    .risk-flags strong {
      color: #C60000;
      font-weight: 700;
    }
    
    .risk-flags ul {
      padding-left: 22px;
      margin-top: 8px;
    }
    
    .risk-flags li {
      color: #2d2d2d;
      margin: 6px 0;
      line-height: 1.5;
    }
    
    .scenario-card {
      background: white;
      border: 2px solid #d0d0d0;
      padding: 20px;
      margin: 16px 0;
    }
    
    .scenario-card.negative { border-color: #C60000; background: #fff5f5; }
    .scenario-card.neutral { border-color: #808080; background: #fafafa; }
    .scenario-card.positive { border-color: #28a745; background: #f0f8f0; }
    
    .scenario-header {
      font-size: 12pt;
      font-weight: 700;
      margin-bottom: 12px;
      letter-spacing: 0px;
      text-transform: uppercase;
    }
    
    .scenario-header.negative { color: #C60000; }
    .scenario-header.neutral { color: #555555; }
    .scenario-header.positive { color: #28a745; }
    
    .scenario-card > div {
      margin: 6px 0;
      line-height: 1.5;
      color: #2d2d2d;
    }
    
    .scenario-card strong {
      color: #2d2d2d;
      font-weight: 700;
    }
    
    .recommendation-box {
      background: #C60000;
      color: white;
      padding: 30px;
      text-align: center;
      margin: 24px 0;
      border: 3px solid #8B0000;
    }
    
    .recommendation-box .label {
      font-size: 10pt;
      margin-bottom: 10px;
      letter-spacing: 0.5px;
      font-weight: 400;
      text-transform: uppercase;
    }
    
    .recommendation-box .value {
      font-size: 28pt;
      font-weight: 700;
      letter-spacing: 1px;
      line-height: 1.1;
    }
    
    .score-display {
      display: table;
      width: 100%;
      margin: 24px 0;
      padding: 20px;
      background: #fafafa;
      border: 2px solid #d0d0d0;
    }
    
    .score-circle {
      width: 120px;
      height: 120px;
      display: table-cell;
      vertical-align: middle;
      text-align: center;
      font-size: 36pt;
      font-weight: 700;
      color: white;
      background: #C60000;
      border: 4px solid #8B0000;
    }
    
    .chart-container {
      position: relative;
      height: 400px;
      width: 100%;
      margin: 28px 0;
      padding: 18px;
      background: #fafafa;
      border: 2px solid #d0d0d0;
      page-break-inside: avoid;
      page-break-after: auto;
    }
    
    .chart-container canvas {
      max-width: 100%;
      height: 400px !important;
    }
    
    .chart-title {
      font-size: 11pt;
      font-weight: 700;
      color: #2d2d2d;
      margin-bottom: 14px;
      text-align: center;
      letter-spacing: 0px;
      text-transform: uppercase;
    }

    /* ==== COVER PAGE (SSI STYLE) ==== */

.cover-page {
  width: 100%;
  height: 100vh;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.cover-top {
  background: #C60000;
  color: white;
  padding: 80px 60px;
  flex: 0 0 auto;
}

.cover-title {
  font-size: 28pt;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.cover-stock {
  font-size: 46pt;
  font-weight: 900;
  margin-top: 12px;
}

.cover-meta {
  padding: 50px 60px;
  font-size: 14pt;
  color: #222;
  line-height: 1.6;
}

.cover-meta .label {
  font-weight: 700;
  margin-top: 20px;
}

.cover-meta .value {
  margin-top: 6px;
}

.cover-footer {
  margin-top: auto;
  padding: 0 60px 40px 60px;
  font-size: 11pt;
  color: #555;
  border-top: 1px solid #ddd;
  padding-top: 14px;
}
    
    @media print {
      body { 
        background: white; 
        padding: 0; 
      }
      .container { 
        max-width: 100%;
      }
    }
  </style>
</head>
<body>

   ${this.generateCoverPage(stockCode, generatedAt)}
  <div class="container">
    ${this.generateHighlightsHTML(highlightsSection)}
    ${this.generateBusinessOverviewHTML(businessSection)}
    ${this.generateFinancialAnalysisHTML(financialSection)}
    ${this.generateValuationHTML(valuationSection)}
    ${this.generateConclusionHTML(conclusionSection)}
  </div>
  
  <script>
    ${this.generateChartScripts(sections)}
  </script>
</body>
</html>
    `;
  }

  private generateHighlightsHTML(section: ReportSection | undefined): string {
    if (!section || !section.data) {
      return '<div class="section"><div class="section-title">1. Điểm Nhấn Chính</div><p>Không có dữ liệu</p></div>';
    }

    const highlights = section.data.result || [];
    const highlightsHtml = Array.isArray(highlights)
      ? highlights
          .map(
            (item) =>
              `<li style="margin-left: 12px;">${this.escapeHtml(item)}</li>`,
          )
          .join("")
      : "";

    return `
      <div class="section">
        <div class="section-title">1. Điểm Nhấn Chính</div>
        <div class="highlights">
          <ul>
            ${highlightsHtml}
          </ul>
        </div>
      </div>
    `;
  }

  private generateBusinessOverviewHTML(
    section: ReportSection | undefined,
  ): string {
    if (!section || !section.data) {
      return '<div class="section"><div class="section-title">2. Tổng Quan Kinh Doanh</div><p>Không có dữ liệu</p></div>';
    }

    const data = section.data;
    let html =
      '<div class="section"><div class="section-title">2. Tổng Quan Kinh Doanh</div>';

    if (data.executive_summary) {
      html += "<h3>Tóm Tắt Điều Hành</h3>";
      if (Array.isArray(data.executive_summary.paragraphs)) {
        data.executive_summary.paragraphs.forEach((p: any) => {
          html += `<div class="paragraph">${this.escapeHtml(p)}</div>`;
        });
      }

      if (
        data.executive_summary.focus_points &&
        Array.isArray(data.executive_summary.focus_points) &&
        data.executive_summary.focus_points.length > 0
      ) {
        html += '<div class="focus-points"><strong>Điểm Chú Ý:</strong><ul>';
        data.executive_summary.focus_points.forEach((point: any) => {
          html += `<li style="margin-left: 12px;">${this.escapeHtml(point)}</li>`;
        });
        html += "</ul></div>";
      }
    }

    if (
      data.segment_analysis &&
      Array.isArray(data.segment_analysis) &&
      data.segment_analysis.length > 0
    ) {
      html += '<h3 style="margin-top: 30px;">Phân Tích Theo Mảng</h3>';
      data.segment_analysis.forEach((segment: any) => {
        const trendClass = `trend-${segment.trend || "unknown"}`;
        const paragraphsHtml = Array.isArray(segment.paragraphs)
          ? segment.paragraphs
              .map((p: any) => `<div class="paragraph">${this.escapeHtml(p)}</div>`)
              .join("")
          : "";
        const driversHtml =
          segment.key_drivers &&
          Array.isArray(segment.key_drivers) &&
          segment.key_drivers.length > 0
            ? `<div style="margin-top: 10px;"><strong>Yếu Tố Chính:</strong></div><ul>${segment.key_drivers.map((d: any) => `<li style="margin-left: 12px;">${this.escapeHtml(d)}</li>`).join("")}</ul>`
            : "";

        html += `
          <div class="segment">
            <div class="segment-title">
              ${this.escapeHtml(segment.name)}
              <span class="trend-badge ${trendClass}">${this.translateTrend(segment.trend)}</span>
            </div>
            ${paragraphsHtml}
            ${driversHtml}
          </div>
        `;
      });
    }

    if (data.industry_context) {
      html += '<h3 style="margin-top: 30px;">Bối Cảnh Ngành</h3>';
      if (Array.isArray(data.industry_context.paragraphs)) {
        data.industry_context.paragraphs.forEach((p: any) => {
          html += `<div class="paragraph">${this.escapeHtml(p)}</div>`;
        });
      }

      if (
        data.industry_context.macro_factors &&
        Array.isArray(data.industry_context.macro_factors) &&
        data.industry_context.macro_factors.length > 0
      ) {
        html += '<div class="focus-points"><strong>Yếu Tố Vĩ Mô:</strong><ul>';
        data.industry_context.macro_factors.forEach((factor: any) => {
          html += `<li style="margin-left: 12px;">${this.escapeHtml(factor)}</li>`;
        });
        html += "</ul></div>";
      }
    }

    if (
      data.financial_charts &&
      Array.isArray(data.financial_charts) &&
      data.financial_charts.length > 0
    ) {
      data.financial_charts.forEach((chart: any, idx: any) => {
        if (this.hasChartData(chart)) {
          html += `
            <div class="chart-container">
              <div class="chart-title">${this.escapeHtml(chart.title)}</div>
              <canvas id="chart_business_${idx}" width="1200" height="400"></canvas>
            </div>
          `;
        }
      });
    }

    html += "</div>";
    return html;
  }

  private generateFinancialAnalysisHTML(
    section: ReportSection | undefined,
  ): string {
    if (!section || !section.data) {
      return '<div class="section"><div class="section-title">3. Phân Tích Tài Chính</div><p>Không có dữ liệu</p></div>';
    }

    const data = section.data;
    let html =
      '<div class="section"><div class="section-title">3. Phân Tích Tài Chính</div>';

    if (data.paragraphs && Array.isArray(data.paragraphs)) {
      data.paragraphs.forEach((p: any) => {
        html += `<div class="paragraph">${this.escapeHtml(p)}</div>`;
      });
    }

    if (data.key_metrics) {
      html += '<h3 style="margin-top: 30px;">Chỉ Số Tài Chính Chính</h3>';
      html += '<table class="metrics-table"><tbody>';

      const metrics = [
        { key: "total_assets", label: "Tổng Tài Sản", unit: "tỷ VNĐ" },
        { key: "total_debt", label: "Tổng Nợ", unit: "tỷ VNĐ" },
        { key: "cash", label: "Tiền Mặt", unit: "tỷ VNĐ" },
        { key: "debt_to_equity", label: "Nợ/Vốn Chủ Sở Hữu", unit: "" },
        { key: "roe_percent", label: "ROE", unit: "%" },
        { key: "roa_percent", label: "ROA", unit: "%" },
        { key: "gross_margin_percent", label: "Biên Lợi Nhuận Gộp", unit: "%" },
        { key: "net_margin_percent", label: "Biên Lợi Nhuận Ròng", unit: "%" },
        { key: "eps", label: "EPS", unit: "VNĐ" },
      ];

      metrics.forEach((metric) => {
        const value = data.key_metrics[metric.key];
        if (value !== null && value !== undefined) {
          html += `
            <tr>
              <td><strong>${metric.label}</strong></td>
              <td>${this.formatNumber(value)} ${metric.unit}</td>
            </tr>
          `;
        }
      });

      html += "</tbody></table>";
    }

    if (data.risk_assessment) {
      html += '<h3 style="margin-top: 30px;">Đánh Giá Rủi Ro</h3>';
      if (
        data.risk_assessment.paragraphs &&
        Array.isArray(data.risk_assessment.paragraphs)
      ) {
        data.risk_assessment.paragraphs.forEach((p: any) => {
          html += `<div class="paragraph">${this.escapeHtml(p)}</div>`;
        });
      }

      if (
        data.risk_assessment.risk_flags &&
        Array.isArray(data.risk_assessment.risk_flags) &&
        data.risk_assessment.risk_flags.length > 0
      ) {
        html += '<div class="risk-flags"><strong>Cảnh Báo:</strong><ul>';
        data.risk_assessment.risk_flags.forEach((flag: any) => {
          html += `<li style="margin-left: 12px;">${this.escapeHtml(flag)}</li>`;
        });
        html += "</ul></div>";
      }
    }

    if (
      data.financial_charts &&
      Array.isArray(data.financial_charts) &&
      data.financial_charts.length > 0
    ) {
      data.financial_charts.forEach((chart: any, idx: any) => {
        if (this.hasChartData(chart)) {
          html += `
            <div class="chart-container">
              <div class="chart-title">${this.escapeHtml(chart.title)}</div>
              <canvas id="chart_financial_${idx}" width="1200" height="400"></canvas>
            </div>
          `;
        }
      });
    }

    html += "</div>";
    return html;
  }

  private generateValuationHTML(section: ReportSection | undefined): string {
    if (!section || !section.data) {
      return '<div class="section"><div class="section-title">4. Định Giá & Triển Vọng</div><p>Không có dữ liệu</p></div>';
    }

    const data = section.data;
    let html =
      '<div class="section"><div class="section-title">4. Định Giá & Triển Vọng</div>';

    if (data.valuation_paragraphs && Array.isArray(data.valuation_paragraphs)) {
      data.valuation_paragraphs.forEach((p: any) => {
        html += `<div class="paragraph">${this.escapeHtml(p)}</div>`;
      });
    }

    if (
      data.valuation_scenarios &&
      Array.isArray(data.valuation_scenarios) &&
      data.valuation_scenarios.length > 0
    ) {
      html += '<h3 style="margin-top: 30px;">Kịch Bản Định Giá</h3>';
      data.valuation_scenarios.forEach((scenario: any) => {
        const sentimentMap: Record<string, { class: string; label: string }> = {
          "tiêu cực": { class: "negative", label: "Tiêu Cực" },
          "trung lập": { class: "neutral", label: "Trung Lập" },
          "tích cực": { class: "positive", label: "Tích Cực" },
        };
        const sentiment = sentimentMap[String(scenario.sentiment || "").toLowerCase()] || {
          class: "neutral",
          label: scenario.sentiment,
        };
        const assumptionsHtml =
          scenario.assumptions &&
          Array.isArray(scenario.assumptions) &&
          scenario.assumptions.length > 0
            ? `<div style="margin-top: 10px;"><strong>Giả Định:</strong></div><ul style="margin-top: 5px;">${scenario.assumptions.map((a: any) => `<li style="margin-left: 12px;">${this.escapeHtml(a)}</li>`).join("")}</ul>`
            : "";

        const price = this.parseNumericValue(
          scenario.price ||
            scenario.targetpricevnd ||
            scenario.target_price_vnd,
        );
        const pe = this.parseNumericValue(
          scenario.pe || scenario.projected_pe || scenario.projectedpe,
        );
        const growth = this.parseNumericValue(
          scenario.growth ||
            scenario.projectedgrowthpercent ||
            scenario.projected_growth_percent,
        );

        html += `
          <div class="scenario-card ${sentiment.class}">
            <div class="scenario-header ${sentiment.class}">${sentiment.label}</div>
            ${price ? `<div><strong>Giá Mục Tiêu:</strong> ${this.formatNumber(price)} VNĐ</div>` : ""}
            ${pe ? `<div><strong>P/E Dự Kiến:</strong> ${pe}</div>` : ""}
            ${growth ? `<div><strong>Tăng Trưởng Dự Kiến:</strong> ${growth}%</div>` : ""}
            ${scenario.comment ? `<div style="margin-top: 10px;">${this.escapeHtml(scenario.comment)}</div>` : ""}
            ${assumptionsHtml}
          </div>
        `;
      });
    }

    if (
      data.catalysts &&
      Array.isArray(data.catalysts) &&
      data.catalysts.length > 0
    ) {
      html += '<h3 style="margin-top: 30px;">Yếu Tố Hỗ Trợ</h3>';
      html += '<div class="focus-points"><ul>';
      data.catalysts.forEach((catalyst: any) => {
        html += `<li style="margin-left: 12px;">${this.escapeHtml(catalyst)}</li>`;
      });
      html += "</ul></div>";
    }

    if (
      data.main_risks &&
      Array.isArray(data.main_risks) &&
      data.main_risks.length > 0
    ) {
      html += '<h3 style="margin-top: 20px;">Rủi Ro Chính</h3>';
      html += '<div class="risk-flags"><ul>';
      data.main_risks.forEach((risk: any) => {
        html += `<li style="margin-left: 12px;">${this.escapeHtml(risk)}</li>`;
      });
      html += "</ul></div>";
    }

    if (data.valuation_chart && this.hasChartData(data.valuation_chart)) {
      html += `
        <div class="chart-container">
          <div class="chart-title">${this.escapeHtml(data.valuation_chart.title)}</div>
          <canvas id="chart_valuation" width="1200" height="400"></canvas>
        </div>
      `;
    }

    html += "</div>";
    return html;
  }

  private generateConclusionHTML(section: ReportSection | undefined): string {
    if (!section || !section.data) {
      return '<div class="section"><div class="section-title">5. Kết Luận Đầu Tư</div><p>Không có dữ liệu</p></div>';
    }

    const data = section.data;
    let html =
      '<div class="section"><div class="section-title">5. Kết Luận Đầu Tư</div>';

    if (data.recommendation) {
      const recColors: Record<string, string> = {
        MUA: "#10b981",
        GIỮ: "#6b7280",
        BÁN: "#dc2626",
        "KHÔNG XÁC ĐỊNH": "#6b7280",
      };
      const color = recColors[data.recommendation] || "#6b7280";

      html += `
        <div class="recommendation-box" style="background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%);">
          <div class="label">Khuyến Nghị Đầu Tư</div>
          <div class="value">${data.recommendation}</div>
        </div>
      `;
    }

    if (data.investment_score) {
      const score = data.investment_score.score;
      let scoreColor = "#dc2626";
      if (score >= 70) scoreColor = "#10b981";
      else if (score >= 50) scoreColor = "#f59e0b";

      html += `
        <div class="score-display">
          <div style="display: table-row;">
            <div class="score-circle" style="background: ${scoreColor};">${score}</div>
            <div style="display: table-cell; vertical-align: middle; padding-left: 25px;">
              <div style="font-size: 16px; font-weight: 700; color: #2d2d2d;">Điểm Đầu Tư</div>
              <div style="color: #666; margin-top: 6px; line-height: 1.5;">${this.escapeHtml(data.investment_score.interpretation)}</div>
            </div>
          </div>
        </div>
      `;
    }

    if (data.paragraphs && Array.isArray(data.paragraphs)) {
      data.paragraphs.forEach((p: any) => {
        html += `<div class="paragraph">${this.escapeHtml(p)}</div>`;
      });
    }

    if (
      data.top_reasons &&
      Array.isArray(data.top_reasons) &&
      data.top_reasons.length > 0
    ) {
      html += '<h3 style="margin-top: 30px;">Lý Do Chính</h3>';
      html += '<div class="focus-points"><ul>';
      data.top_reasons.forEach((reason: any) => {
        html += `<li style="margin-left: 12px;">${this.escapeHtml(reason)}</li>`;
      });
      html += "</ul></div>";
    }

    if (data.sentiment_chart && this.hasChartData(data.sentiment_chart)) {
      html += `
        <div class="chart-container">
          <div class="chart-title">${this.escapeHtml(data.sentiment_chart.title)}</div>
          <canvas id="chart_sentiment" width="1200" height="400"></canvas>
        </div>
      `;
    }

    html += "</div>";
    return html;
  }

  private generateChartScripts(sections: ReportSection[]): string {
    let scripts = "";
    let chartCount = 0;

    const businessSection = sections.find((s) => s.id === "business_overview");
    if (
      businessSection &&
      businessSection.data &&
      businessSection.data.financial_charts &&
      Array.isArray(businessSection.data.financial_charts)
    ) {
      businessSection.data.financial_charts.forEach((chart: any, idx: any) => {
        if (this.hasChartData(chart)) {
          chartCount += 1;
          scripts += this.generateChartJS(`chart_business_${idx}`, chart);
        }
      });
    }

    const financialSection = sections.find(
      (s) => s.id === "financial_analysis",
    );
    if (
      financialSection &&
      financialSection.data &&
      financialSection.data.financial_charts &&
      Array.isArray(financialSection.data.financial_charts)
    ) {
      financialSection.data.financial_charts.forEach((chart: any, idx: any) => {
        if (this.hasChartData(chart)) {
          chartCount += 1;
          scripts += this.generateChartJS(`chart_financial_${idx}`, chart);
        }
      });
    }

    const valuationSection = sections.find((s) => s.id === "valuation");
    if (
      valuationSection &&
      valuationSection.data &&
      valuationSection.data.valuation_chart
    ) {
      if (this.hasChartData(valuationSection.data.valuation_chart)) {
        chartCount += 1;
        scripts += this.generateChartJS(
          "chart_valuation",
          valuationSection.data.valuation_chart,
        );
      }
    }

    const conclusionSection = sections.find((s) => s.id === "conclusion");
    if (
      conclusionSection &&
      conclusionSection.data &&
      conclusionSection.data.sentiment_chart
    ) {
      if (this.hasChartData(conclusionSection.data.sentiment_chart)) {
        chartCount += 1;
        scripts += this.generateChartJS(
          "chart_sentiment",
          conclusionSection.data.sentiment_chart,
        );
      }
    }

    const trackingScript = `
      window.totalCharts = ${chartCount};
      window.completedCharts = 0;
      window.allChartsReady = false;
      
      function checkAllChartsReady() {
        if (window.completedCharts >= window.totalCharts) {
          window.allChartsReady = true;
          strapi.log.info('All charts rendered successfully');
        }
      }
    `;

    return trackingScript + scripts;
  }

  private generateChartJS(canvasId: string, chartData: ChartData): string {
    if (
      !chartData ||
      !chartData.datasets ||
      !Array.isArray(chartData.datasets)
    ) {
      return "";
    }

    const chartType =
      chartData.chart_type === "stacked_bar" ? "bar" : chartData.chart_type;
    const isPieChart = chartType === "pie" || chartType === "doughnut";

    const colors = [
      "rgba(37, 99, 235, 0.8)",
      "rgba(16, 185, 129, 0.8)",
      "rgba(245, 158, 11, 0.8)",
      "rgba(239, 68, 68, 0.8)",
      "rgba(139, 92, 246, 0.8)",
      "rgba(251, 191, 36, 0.8)",
      "rgba(236, 72, 153, 0.8)",
      "rgba(14, 165, 233, 0.8)",
    ];

    const datasets = chartData.datasets.map((dataset, idx) => {
      if (!dataset || !dataset.data || !Array.isArray(dataset.data)) {
        return {
          label: dataset?.name || "Unknown",
          data: [],
          backgroundColor: colors[idx % colors.length],
          borderColor: colors[idx % colors.length].replace("0.8", "1"),
          borderWidth: 2,
        };
      }

      if (isPieChart) {
        const sliceColors = dataset.data.map(
          (_, i) => colors[i % colors.length],
        );
        return {
          label: dataset.name,
          data: dataset.data,
          backgroundColor: sliceColors,
          borderColor: sliceColors.map((c) => c.replace("0.8", "1")),
          borderWidth: 2,
        };
      }

      return {
        label: dataset.name,
        data: dataset.data,
        backgroundColor: colors[idx % colors.length],
        borderColor: colors[idx % colors.length].replace("0.8", "1"),
        borderWidth: 2,
      };
    });

    const config: any = {
      type: chartType,
      data: {
        labels: chartData.labels || [],
        datasets: datasets,
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: {
          duration: 0,
        },
        plugins: {
          legend: {
            display: isPieChart || datasets.length > 1,
            position: "top",
          },
        },
        scales: isPieChart
          ? undefined
          : {
              x: {
                ticks: {
                  maxRotation: 45,
                  minRotation: 0,
                },
              },
            },
      },
    };

    if (chartData.chart_type === "stacked_bar") {
      config.options.scales.x.stacked = true;
      config.options.scales.y = { stacked: true };
    }

    const baseConfig = JSON.stringify(config);
    const configWithCallback = baseConfig.replace(
      '"animation":{"duration":0}',
      '"animation":{"duration":0,"onComplete":function(){window.completedCharts++;checkAllChartsReady();}}',
    );

    return `
      new Chart(document.getElementById('${canvasId}'), ${configWithCallback});
    `;
  }

  private hasChartData(chart: any): boolean {
    if (
      !chart ||
      !chart.datasets ||
      !Array.isArray(chart.datasets) ||
      chart.datasets.length === 0
    ) {
      return false;
    }

    return chart.datasets.some(
      (dataset: any) =>
        dataset &&
        dataset.data &&
        Array.isArray(dataset.data) &&
        dataset.data.length > 0 &&
        dataset.data.some(
          (value: any) => value !== null && value !== undefined && value !== 0,
        ),
    );
  }

  private escapeHtml(text: any): string {
    if (!text) return "";
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
  }

  private formatNumber(num: any): string {
    if (num === null || num === undefined) return "N/A";
    return new Intl.NumberFormat("vi-VN").format(num);
  }

  private translateTrend(trend: string): string {
    const trendMap: Record<string, string> = {
      growing: "Tăng trưởng",
      stable: "Ổn định",
      declining: "Giảm",
      volatile: "Biến động",
      unknown: "Không rõ",
    };
    return trendMap[trend] || trend;
  }
}
