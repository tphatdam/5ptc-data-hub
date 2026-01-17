import { Injectable } from '@nestjs/common';
import { OpenAIService } from '../../ai/services/openai.service';

interface PromptConfig {
  id: string;
  template: string;
}

interface SectionResult {
  id: string;
  data: any;
  rawAnswer?: string;
  error?: string;
  isFallback?: boolean;
}

interface StockReportResult {
  stockCode: string;
  conversationID: string;
  sections: SectionResult[];
  generatedAt: string;
}

const STOCK_REPORT_PROMPTS: PromptConfig[] = [
  {
    id: "highlights",
    template: `Bạn là nhà phân tích tài chính Việt Nam.

Hãy tạo phần "Điểm nhấn chính" cho mã cổ phiếu {stock_code}:
- Tóm tắt 4–6 điểm nổi bật nhất trong 12 tháng gần nhất: doanh thu, lợi nhuận, biên lợi nhuận, sản lượng, sự kiện (IPO, dự án, sáp nhập…).
- Viết ngắn gọn, rõ ràng, dạng bullet.
- Mỗi điểm có thể kèm con số cụ thể hoặc so sánh với cùng kỳ (%).
- Giọng văn chuyên nghiệp, giống bản tin tài chính.

Mục tiêu: phần mở đầu tóm tắt toàn bộ bức tranh doanh nghiệp.
Yêu cầu: trả về kết quả dạng json, có dạng {"result": ["content_1","content_2", ...]}`,
  },
  {
    id: "business_overview",
    template: `Bạn là nhà phân tích thị trường chứng khoán Việt Nam (HOSE/HNX).

Hãy tạo tổng quan kinh doanh cho mã cổ phiếu Việt Nam {stock_code} trên sàn HOSE/HNX. Trả về JSON hợp lệ.

LƯU Ý: {stock_code} là mã cổ phiếu VIỆT NAM (VD: VIC = Vingroup, VNM = Vinamilk, HPG = Hòa Phát). KHÔNG tra cứu mã chứng khoán nước ngoài.

VÍ DỤ MẪU - COPY CHÍNH XÁC CẤU TRÚC (CHỈ 3 TRƯỜNG):
{
  "executive_summary": {
    "paragraphs": [
      "Doanh thu Q2/2024 đạt 16.656 tỷ đồng (+9.6% YoY). LNST tăng 21.5% nhờ biên gộp cải thiện từ giá nguyên liệu giảm.",
      "Xuất khẩu tăng trưởng mạnh 15%, trong khi nội địa ổn định 5%. Thị phần dẫn đầu ngành sữa với 50%."
    ],
    "focus_points": [
      "Doanh thu và lợi nhuận tăng trưởng tốt",
      "Xuất khẩu là động lực chính",
      "Biên lợi nhuận cải thiện"
    ]
  },
  "segment_analysis": [
    {
      "name": "Sữa nước",
      "paragraphs": ["Tăng trưởng 12% nhờ sản phẩm cao cấp"],
      "trend": "growing",
      "key_drivers": ["Sản phẩm mới", "Thị trường xuất khẩu"]
    }
  ],
  "financial_charts": null
}

QUY TẮC BẮT BUỘC:
- CHỈ 3 trường: executive_summary, segment_analysis, financial_charts
- paragraphs: Từ 1-2 đoạn. Mỗi đoạn từ 200-300 từ
- focus_points: tối đa 3 điểm
- segment_analysis: tối đa 2 mảng, mỗi mảng 1 đoạn ngắn từ 100-200 từ
- financial_charts: TÙY CHỌN - để null nếu không có dữ liệu, HOẶC thêm 1 biểu đồ line/bar nếu có số liệu hữu ích (doanh thu, lợi nhuận theo quý/năm)
- TỔNG số từ toàn bộ JSON: 300-450 từ (không tính chart)`,
  },
  {
    id: "financial_analysis",
    template: `Bạn là chuyên gia tài chính thị trường chứng khoán Việt Nam (HOSE/HNX).

Hãy viết **phân tích tài chính chi tiết** cho mã cổ phiếu Việt Nam {stock_code} trên sàn HOSE/HNX.  
Trả về JSON hợp lệ duy nhất, không có text bên ngoài.

LƯU Ý: {stock_code} là mã cổ phiếu VIỆT NAM (VD: VIC = Vingroup, VNM = Vinamilk). KHÔNG phân tích công ty nước ngoài.

Schema:
{
  "paragraphs": [string],             // 2–3 đoạn dài (tổng 300–500 từ): phân tích cơ cấu tài sản, nợ, dòng tiền, ROE/ROA, sức khỏe tài chính.
  "key_metrics": {                    // nếu có dữ liệu định lượng
    "total_assets": number|null,
    "total_debt": number|null,
    "cash": number|null,
    "debt_to_equity": number|null,
    "roe_percent": number|null,
    "roa_percent": number|null,
    "gross_margin_percent": number|null,
    "net_margin_percent": number|null,
    "eps": number|null
  },
  "risk_assessment": {
    "paragraphs": [string],           // 1–2 đoạn: đánh giá rủi ro tài chính (đòn bẩy, thanh khoản, chi phí lãi vay…)
    "risk_flags": [string]            // danh sách các cảnh báo tài chính (nếu có)
  },
  "financial_charts": [               // TÙY CHỌN: biểu đồ định lượng
    {
      "chart_type": "bar"|"line",
      "title": string,
      "labels": [string],
      "datasets": [
        {"name": string, "data": [number], "unit": string|null}
      ]
    }
  ] | null
}

Yêu cầu:
- Các đoạn phân tích phải sâu, có luận điểm, so sánh, và diễn giải rõ ý.
- financial_charts: TÙY CHỌN - để null nếu không có dữ liệu, HOẶC thêm 1-2 biểu đồ nếu có số liệu định lượng (ROE/ROA theo năm, biên lợi nhuận, debt ratio...).
- Nếu thiếu số liệu, để null nhưng vẫn mô tả định tính.`,
  },
  {
    id: "valuation",
    template: `Bạn là nhà phân tích định giá thị trường chứng khoán Việt Nam (HOSE/HNX).

Hãy phân tích định giá cho mã cổ phiếu Việt Nam {stock_code} trên sàn HOSE/HNX. Trả về JSON hợp lệ.

LƯU Ý: {stock_code} là mã cổ phiếu VIỆT NAM (VD: VIC = Vingroup, VNM = Vinamilk). KHÔNG định giá công ty nước ngoài.

VÍ DỤ MẪU - HÃY COPY CHÍNH XÁC CẤU TRÚC NÀY (CHỈ 4 TRƯỜNG):
{
  "valuation_paragraphs": [
    "Phân tích định giá dựa trên P/E và tăng trưởng dự kiến",
    "Xem xét các yếu tố vĩ mô và triển vọng ngành"
  ],
  "valuation_scenarios": [
    {
      "sentiment": "tích cực",
      "assumptions": ["Tăng trưởng mạnh", "Chi phí giảm"],
      "pe": "18",
      "growth": "10",
      "price": "75000",
      "comment": "Triển vọng tốt"
    },
    {
      "sentiment": "trung lập",
      "assumptions": ["Tăng trưởng ổn định"],
      "pe": "15",
      "growth": "5",
      "price": "65000",
      "comment": "Duy trì hiện tại"
    },
    {
      "sentiment": "tiêu cực",
      "assumptions": ["Áp lực chi phí"],
      "pe": "12",
      "growth": "2",
      "price": "55000",
      "comment": "Rủi ro cao"
    }
  ],
  "catalysts": ["Mở rộng xuất khẩu", "Sản phẩm mới"],
  "main_risks": ["Cạnh tranh tăng", "Chi phí nguyên liệu"]
}

QUY TẮC BẮT BUỘC:
- CHỈ 4 trường: valuation_paragraphs, valuation_scenarios, catalysts, main_risks
- KHÔNG thêm trường nào khác (KHÔNG có valuation_chart)
- pe, growth, price: Viết dạng string (VD: "18", "10", "75000")
- Có thể viết khoảng (VD: "15-18", "65000-70000")
- sentiment: "tích cực" hoặc "trung lập" hoặc "tiêu cực"
- Phải có ít nhất 1 scenario`,
  },
  {
    id: "conclusion",
    template: `Bạn là nhà phân tích đầu tư thị trường chứng khoán Việt Nam (HOSE/HNX).

Hãy viết kết luận đầu tư cho mã cổ phiếu Việt Nam {stock_code} trên sàn HOSE/HNX. Trả về JSON hợp lệ.

LƯU Ý: {stock_code} là mã cổ phiếu VIỆT NAM (VD: VIC = Vingroup, VNM = Vinamilk). KHÔNG phân tích công ty nước ngoài.

VÍ DỤ MẪU - COPY CHÍNH XÁC CẤU TRÚC (CHỈ 4 TRƯỜNG):
{
  "paragraphs": [
    "VNM thể hiện sức khỏe tài chính tốt với doanh thu tăng trưởng ổn định và biên lợi nhuận cải thiện. Định giá hợp lý ở mức P/E 15-18.",
    "Rủi ro chính từ cạnh tranh và biến động giá nguyên liệu. Triển vọng trung hạn tích cực nhờ xuất khẩu."
  ],
  "recommendation": "GIỮ",
  "top_reasons": [
    "Tăng trưởng doanh thu ổn định",
    "Định giá hợp lý",
    "Xuất khẩu mở rộng"
  ],
  "investment_score": {
    "score": 68,
    "interpretation": "Trung lập - Phù hợp nắm giữ dài hạn"
  }
}

QUY TẮC BẮT BUỘC:
- CHỈ 4 trường: paragraphs, recommendation, top_reasons, investment_score
- paragraphs: 2 đoạn, độ dài 100-150 từ
- top_reasons: đúng 3 lý do ngắn gọn
- recommendation: "MUA" hoặc "GIỮ" hoặc "BÁN" hoặc "KHÔNG XÁC ĐỊNH"
- investment_score.score: số từ 0-100
- TỔNG số từ: 200-300 từ`,
  },
];

@Injectable()
export class StockReportService {
  private readonly INTER_PROMPT_DELAY_MS = 3000;

  constructor(private readonly openaiService: OpenAIService) {}

  private extractAndRepairJSON(text: any, sectionId: string): any {
    if (typeof text === "object" && text !== null) {
      console.log("⚠ Text is already an object, validating schema...");
      if (this.validateSectionSchema(text, sectionId)) {
        return text;
      } else {
        console.log("❌ Object does not match expected schema");
        return null;
      }
    }

    const cleanedText = String(text).trim();

    const strategies = [
      (t: string) => {
        const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/g;
        const matches = [...t.matchAll(fenceRegex)];
        if (matches.length > 0) {
          for (const match of matches) {
            const content = match[1].trim();
            const extracted = this.extractBalancedJSON(content);
            if (extracted) {
              try {
                const parsed = JSON.parse(this.repairJSON(extracted));
                if (this.validateSectionSchema(parsed, sectionId)) {
                  return parsed;
                }
              } catch (e) {
                console.log(`Strategy 1 parse attempt failed: ${e.message}`);
                continue;
              }
            }
          }
        }
        return null;
      },

      (t: string) => {
        let cleaned = t
          .replace(/```(?:json)?/g, "")
          .replace(/```/g, "")
          .trim();
        const extracted = this.extractBalancedJSON(cleaned);
        if (extracted) {
          try {
            const parsed = JSON.parse(this.repairJSON(extracted));
            if (this.validateSectionSchema(parsed, sectionId)) {
              return parsed;
            }
          } catch (e) {
            console.log(`Strategy 2 parse attempt failed: ${e.message}`);
            return null;
          }
        }
        return null;
      },

      (t: string) => {
        const extracted = this.extractBalancedJSON(t);
        if (extracted) {
          try {
            const parsed = JSON.parse(this.repairJSON(extracted));
            if (this.validateSectionSchema(parsed, sectionId)) {
              return parsed;
            }
          } catch (e) {
            console.log(`Strategy 3 parse attempt failed: ${e.message}`);
            return null;
          }
        }
        return null;
      },
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const result = strategies[i](cleanedText);
        if (result) {
          console.log(
            `✓ Successfully extracted JSON for ${sectionId} using strategy ${i + 1}`,
          );
          return result;
        }
      } catch (e) {
        console.log(`Strategy ${i + 1} execution error: ${e.message}`);
        continue;
      }
    }

    console.error(`❌ All JSON extraction strategies failed for ${sectionId}`);
    console.error(
      `Raw response (first 500 chars): ${cleanedText.substring(0, 500)}`,
    );
    return null;
  }

  private extractBalancedJSON(text: string): string | null {
    const start = text.indexOf("{");
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = start; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === "\\") {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === "{") {
          depth++;
        } else if (char === "}") {
          depth--;
          if (depth === 0) {
            return text.substring(start, i + 1);
          }
        }
      }
    }

    return null;
  }

  private validateSectionSchema(parsed: any, sectionId: string): boolean {
    if (!parsed || typeof parsed !== "object") return false;

    const requiredKeys: Record<string, string[]> = {
      highlights: ["result"],
      business_overview: ["executive_summary", "segment_analysis"],
      financial_analysis: ["paragraphs", "key_metrics", "risk_assessment"],
      valuation: ["valuation_paragraphs", "valuation_scenarios"],
      conclusion: [
        "paragraphs",
        "recommendation",
        "top_reasons",
        "investment_score",
      ],
    };

    const required = requiredKeys[sectionId];
    if (!required) return true;

    for (const key of required) {
      if (!(key in parsed)) {
        console.log(`Missing required key "${key}" for section ${sectionId}`);
        return false;
      }
    }

    return true;
  }

  private normalizeNumericRanges(jsonStr: string): string {
    const result = jsonStr.replace(
      /:\s*"?(\d+(?:[.,]\d{3})*(?:[.,]\d+)?)\s*[-‒–—−~]\s*(\d+(?:[.,]\d{3})*(?:[.,]\d+)?)"?/g,
      (match, start, end) => {
        const cleanStart = start.replace(/[.,](?=\d{3})/g, "").replace(",", ".");
        const cleanEnd = end.replace(/[.,](?=\d{3})/g, "").replace(",", ".");

        const startNum = parseFloat(cleanStart);
        const endNum = parseFloat(cleanEnd);

        const midpoint = (startNum + endNum) / 2;

        const result =
          Number.isInteger(startNum) && Number.isInteger(endNum)
            ? Math.round(midpoint)
            : midpoint;

        console.log(`  ✓ Normalized range "${start}...${end}" → ${result}`);
        return `: ${result}`;
      },
    );

    return result;
  }

  private repairJSON(jsonStr: string): string {
    jsonStr = this.normalizeNumericRanges(jsonStr);

    jsonStr = jsonStr.replace(/(\d)_(\d)/g, "$1$2");

    jsonStr = jsonStr.replace(
      /([:,\[])\s*(\d+(?:\.\d+)?)\s*\*\s*(\d+(?:\.\d+)?)/g,
      (match, prefix, num1, num2) => {
        const result = parseFloat(num1) * parseFloat(num2);
        console.log(
          `  ✓ Evaluated multiplication "${num1} * ${num2}" → ${result}`,
        );
        return `${prefix} ${result}`;
      },
    );

    jsonStr = jsonStr.replace(
      /([:,\[])\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(?=\s*[,\]\}])/g,
      (match, prefix, num1, num2) => {
        const result = parseFloat(num1) * parseFloat(num2);
        console.log(
          `  ✓ Evaluated implicit multiplication "${num1} ${num2}" → ${result}`,
        );
        return `${prefix} ${result}`;
      },
    );

    jsonStr = jsonStr.replace(/(\[)\s*\/+\s*/g, "$1");

    jsonStr = jsonStr.replace(/"\s*\/\s*"/g, '", "');

    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, "$1");

    jsonStr = jsonStr.replace(/\n/g, " ");

    jsonStr = jsonStr.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');

    jsonStr = jsonStr.replace(/:\s*'([^']*)'/g, ': "$1"');

    return jsonStr;
  }

  private getFallbackData(sectionId: string, stockCode: string): any {
    const fallbacks: Record<string, any> = {
      highlights: {
        result: [
          `Dữ liệu cho cổ phiếu ${stockCode} đang được cập nhật`,
          `Vui lòng thử lại sau hoặc tham khảo nguồn tin tài chính khác`,
          `Hệ thống AI tạm thời không khả dụng để phân tích chi tiết`,
        ],
      },
      business_overview: {
        executive_summary: {
          paragraphs: [
            `Báo cáo chi tiết cho mã ${stockCode} đang được xử lý. Do hệ thống AI tạm thời gặp sự cố, chúng tôi không thể cung cấp phân tích tổng quan kinh doanh đầy đủ lúc này.`,
            `Vui lòng thử tạo báo cáo lại sau ít phút hoặc tham khảo các nguồn tin tài chính uy tín khác để có thông tin cập nhật về doanh nghiệp.`,
          ],
          focus_points: [`Dữ liệu đang được cập nhật`, `Vui lòng thử lại sau`],
        },
      },
      financial_analysis: {
        paragraphs: [
          `Phân tích tài chính cho ${stockCode} đang được cập nhật. Hệ thống AI tạm thời không khả dụng để cung cấp đánh giá chi tiết.`,
          `Khuyến nghị: Tham khảo báo cáo tài chính chính thức từ công ty hoặc các nguồn phân tích độc lập.`,
        ],
        key_metrics: {},
        risk_assessment: {
          paragraphs: [`Đánh giá rủi ro đang được cập nhật`],
          risk_flags: [],
        },
      },
      valuation: {
        valuation_paragraphs: [
          `Định giá cho ${stockCode} đang được cập nhật. Vui lòng thử lại sau hoặc tham khảo ý kiến chuyên gia tài chính.`,
        ],
        valuation_scenarios: [],
        catalysts: [`Dữ liệu đang được cập nhật`],
        main_risks: [`Vui lòng thử lại sau`],
      },
      conclusion: {
        paragraphs: [
          `Kết luận đầu tư cho ${stockCode} đang được xử lý. Do hạn chế kỹ thuật, chúng tôi không thể cung cấp khuyến nghị đầu tư đầy đủ lúc này.`,
          `Vui lòng thử lại sau hoặc tham khảo chuyên gia tài chính. Đây không phải lời khuyên đầu tư.`,
        ],
        recommendation: "KHÔNG XÁC ĐỊNH",
        top_reasons: [
          `Dữ liệu đang được cập nhật`,
          `Hệ thống AI tạm thời không khả dụng`,
          `Vui lòng thử lại sau`,
        ],
        investment_score: {
          score: 0,
          interpretation: "Không thể đánh giá do thiếu dữ liệu",
        },
      },
    };

    return (
      fallbacks[sectionId] || {
        message: `Không có dữ liệu cho phần ${sectionId}`,
      }
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async generateStockReport(stockCode: string): Promise<StockReportResult> {
    const results: SectionResult[] = [];
    let conversationID = "";

    console.log(`Starting stock report generation for ${stockCode}...`);

    for (let i = 0; i < STOCK_REPORT_PROMPTS.length; i++) {
      const promptConfig = STOCK_REPORT_PROMPTS[i];
      const prompt = promptConfig.template.replace(/{stock_code}/g, stockCode);

      console.log(
        `Generating section ${i + 1}/${STOCK_REPORT_PROMPTS.length}: ${promptConfig.id}`,
      );

      try {
        // Increase retries to reduce flakiness with external providers.
        const response = await this.openaiService.askOpenAIWithRetry(prompt, conversationID, 2);

        conversationID = response.conversationID;

        let parsedData: any;
        try {
          parsedData = JSON.parse(response.answers);
          console.log(`✓ Direct JSON parse succeeded for ${promptConfig.id}`);
        } catch (parseError) {
          console.log(
            `Direct JSON parse failed for section ${promptConfig.id}: ${parseError.message}`,
          );
          console.log(`Attempting multi-strategy extraction...`);

          parsedData = this.extractAndRepairJSON(response.answers, promptConfig.id);
          if (!parsedData) {
            console.error(
              `❌ Complete extraction failure for ${promptConfig.id}`,
            );
            console.error(
              `Response length: ${response.answers?.length || 0} characters`,
            );
            throw new Error(
              `Could not extract valid JSON from response for section ${promptConfig.id}`,
            );
          }
        }

        results.push({
          id: promptConfig.id,
          data: parsedData,
          rawAnswer: response.answers,
        });

        console.log(`✓ Section ${promptConfig.id} completed`);
      } catch (error) {
        console.error(`Error generating section ${promptConfig.id}:`, error);

        const fallbackData = this.getFallbackData(promptConfig.id, stockCode);

        results.push({
          id: promptConfig.id,
          data: fallbackData,
          error: error.message,
          isFallback: true,
        });

        console.log(`⚠ Using fallback content for section ${promptConfig.id}`);
      }

      if (i < STOCK_REPORT_PROMPTS.length - 1) {
        console.log(`Waiting ${this.INTER_PROMPT_DELAY_MS}ms before next section...`);
        await this.delay(this.INTER_PROMPT_DELAY_MS);
      }
    }

    console.log(`Stock report generation completed for ${stockCode}`);

    return {
      stockCode,
      conversationID,
      sections: results,
      generatedAt: new Date().toISOString(),
    };
  }

  extractAndRepair(text: any, sectionId: string): any {
    return this.extractAndRepairJSON(text, sectionId);
  }
}
