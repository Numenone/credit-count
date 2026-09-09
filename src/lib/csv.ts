/**
 * CSV encoding for the data export.
 *
 * Lives here rather than inside the route handler so it can be tested. The
 * formula-injection rule below is the kind of thing that is easy to write once,
 * hard to notice regressing, and genuinely dangerous when it does.
 */

/**
 * Encodes one cell.
 *
 * A ride note beginning `=`, `+`, `-` or `@` is executed as a formula when the
 * file is opened in Excel, Sheets or LibreOffice — which turns "export your own
 * data" into a way to attack whoever you send the file to. A leading apostrophe
 * makes the cell text, and the tab and carriage return are covered too because
 * leading whitespace is stripped by some readers before the formula check runs.
 */
export function csvCell(value: unknown) {
  if (value == null) return "";
  let text = String(value);

  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  // Quote anything that could break the row, and double any embedded quotes.
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(cells: unknown[]) {
  return cells.map(csvCell).join(",");
}
