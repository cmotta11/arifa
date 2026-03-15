/**
 * Prefix strings that start with formula-trigger characters to prevent
 * CSV formula injection when the file is opened in spreadsheet software.
 */
function sanitizeCellValue(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return "'" + value;
  }
  return value;
}

/**
 * Convert array of objects to CSV string and trigger browser download.
 */
export function downloadCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          let str = val == null ? "" : String(val);
          // Guard against CSV formula injection
          str = sanitizeCellValue(str);
          // Escape quotes and wrap in quotes if contains comma/newline/quote
          return str.includes(",") || str.includes("\n") || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(","),
    ),
  ];

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
