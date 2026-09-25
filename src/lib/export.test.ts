import { describe, expect, it } from "vitest";
import { rowsToCsv } from "./export";

describe("rowsToCsv", () => {
  it("quotes what needs quoting, neutralises formulas, and keeps every column", () => {
    const csv = rowsToCsv([
      { Name: "Asha, R", Score: 78, Note: 'said "hi"' },
      { Name: "=HYPERLINK(\"http://x\")", Score: -5, Extra: "line1\nline2" },
      { Name: "+91 phone", Score: null, Note: "@mention" },
    ]);
    expect(csv.split("\r\n")).toEqual([
      "Name,Score,Note,Extra",
      '"Asha, R",78,"said ""hi""",',
      `"'=HYPERLINK(""http://x"")",-5,,"line1\nline2"`,
      "'+91 phone,,'@mention,",
      "",
    ]);
  });
});
