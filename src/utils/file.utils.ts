export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export function generateHTMLFromJSON(reportData: any): string {
  const safeJson = escapeHtml(JSON.stringify(reportData, null, 2));

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
            color: #333;
          }
          h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
          }
          .section {
            margin: 20px 0;
          }
          .label {
            font-weight: bold;
            color: #555;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #3498db;
            color: white;
          }
          tr:nth-child(even) {
            background-color: #f2f2f2;
          }
        </style>
      </head>
      <body>
        <h1>Report</h1>
        <div class="section">
          <pre>${safeJson}</pre>
        </div>
      </body>
    </html>
  `;
}

export function getReplitDomain(): string {
  const domain = process.env.REPLIT_DOMAINS;
  const port = process.env.PORT || 5000;

  if (domain) {
    return `https://${domain}`;
  }
  return process.env.BASE_URL || `http://localhost:${port}`;
}
