import { describe, expect, it } from "vitest";
import { csvCell, csvRow } from "@/lib/csv";

/**
 * The export is the one place where this app's data leaves it and is opened by
 * software that will happily execute what it finds. These are the cases that
 * matter, not the happy path.
 */

describe("csvCell", () => {
  it("passes ordinary text through untouched", () => {
    expect(csvCell("Nemesis")).toBe("Nemesis");
    expect(csvCell(42)).toBe("42");
  });

  it("renders null and undefined as empty, not as the word", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("defuses every formula prefix", () => {
    // Opened in Excel or Sheets, each of these runs. The note is the user's own
    // text, so this is how "export your data" becomes a way to attack whoever
    // you send the file to.
    for (const prefix of ["=", "+", "-", "@"]) {
      expect(csvCell(`${prefix}cmd|calc`)).toBe(`'${prefix}cmd|calc`);
    }
  });

  it("defuses a formula hidden behind leading whitespace", () => {
    // Some readers strip a leading tab or carriage return before deciding
    // whether the cell is a formula, so the naive check on "=" alone is not
    // enough.
    expect(csvCell("\t=1+1")).toBe("'\t=1+1");
    // The carriage return is defused the same way, and then quoted on top,
    // because on its own it would end the row early.
    expect(csvCell("\r=1+1")).toBe('"\'\r=1+1"');
  });

  it("does not mangle a negative number's meaning", () => {
    // It gains an apostrophe like any other leading minus — correct, because a
    // reader cannot tell -1 from -1+cmd|'/c calc'!A1 without parsing it.
    expect(csvCell(-12)).toBe("'-12");
  });

  it("quotes and escapes anything that would break the row", () => {
    expect(csvCell("Alton Towers, Staffordshire")).toBe('"Alton Towers, Staffordshire"');
    expect(csvCell('She said "wow"')).toBe('"She said ""wow"""');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("quotes a defused formula that also contains a comma", () => {
    expect(csvCell("=SUM(1,2)")).toBe('"\'=SUM(1,2)"');
  });
});

describe("csvRow", () => {
  it("joins cells with commas, each independently encoded", () => {
    expect(csvRow(["Nemesis", "Alton Towers, UK", null, "=cmd"])).toBe(
      'Nemesis,"Alton Towers, UK",,\'=cmd',
    );
  });
});
