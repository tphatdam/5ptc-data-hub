import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface ParsedElement {
  text: string;
  html: string;
  attr: (name: string) => string | undefined;
}

@Injectable()
export class CheerioParserService {
  parse(html: string) {
    return cheerio.load(html);
  }

  select(html: string, selector: string): ParsedElement[] {
    const $ = this.parse(html);
    const results: ParsedElement[] = [];

    $(selector).each((_, element) => {
      const $el = $(element);
      results.push({
        text: $el.text().trim(),
        html: $.html(element) || '',
        attr: (name: string) => $el.attr(name),
      });
    });

    return results;
  }

  extractTable(html: string, tableSelector: string): Record<string, string>[][] {
    const $ = this.parse(html);
    const table = $(tableSelector);
    const rows: Record<string, string>[][] = [];

    const headers: string[] = [];
    table.find('thead th, thead td').each((_, th) => {
      headers.push($(th).text().trim());
    });

    table.find('tbody tr').each((_, tr) => {
      const row: Record<string, string>[] = [];
      $(tr)
        .find('td')
        .each((colIndex, td) => {
          const header = headers[colIndex] || `col_${colIndex}`;
          row.push({ [header]: $(td).text().trim() });
        });
      if (row.length > 0) {
        rows.push(row);
      }
    });

    return rows;
  }

  extractText($: ReturnType<typeof cheerio.load>, selector: string): string {
    return $(selector).text().trim();
  }

  extractAttr($: ReturnType<typeof cheerio.load>, selector: string, attr: string): string | undefined {
    return $(selector).attr(attr);
  }
}
