// Rule-based natural-language query parser — no external API required.
// Recognizes a fixed set of intents and converts them into filters/chart actions.

export type NlAction =
  | { type: "filter-below"; value: number }
  | { type: "filter-above"; value: number }
  | { type: "filter-range"; min: number; max: number }
  | { type: "compare-departments"; departments: string[] }
  | { type: "pie-tiers" }
  | { type: "names-range"; min: number; max: number }
  | { type: "unknown"; reason: string };

const NUM = /-?\d+(\.\d+)?/;

export function parseNlQuery(raw: string, knownDepartments: string[]): NlAction {
  const q = raw.trim().toLowerCase();
  if (!q) return { type: "unknown", reason: "Type a question first, e.g. \"show students below 30 marks\"." };

  // "between 51 and 60" / "51 to 60" / "51-60"
  const between = q.match(/between\s+(\d+(?:\.\d+)?)\s*(?:and|-|to)\s*(\d+(?:\.\d+)?)/) ??
    q.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/);

  if (/name/.test(q) && between) {
    return { type: "names-range", min: Number(between[1]), max: Number(between[2]) };
  }

  if (between) {
    return { type: "filter-range", min: Number(between[1]), max: Number(between[2]) };
  }

  const belowMatch = q.match(/(below|under|less than|<)\s*(\d+(?:\.\d+)?)/);
  if (belowMatch) return { type: "filter-below", value: Number(belowMatch[2]) };

  const aboveMatch = q.match(/(above|over|more than|greater than|>)\s*(\d+(?:\.\d+)?)/);
  if (aboveMatch) return { type: "filter-above", value: Number(aboveMatch[2]) };

  if (/pie|donut/.test(q) && /(tier|performance|band)/.test(q)) {
    return { type: "pie-tiers" };
  }

  if (/compare/.test(q)) {
    const mentioned = knownDepartments.filter((d) => q.includes(d.toLowerCase()));
    if (mentioned.length >= 2) return { type: "compare-departments", departments: mentioned };
    return { type: "unknown", reason: "Name two or more departments to compare, e.g. \"Compare CSBS and CSE average scores\"." };
  }

  const single = q.match(NUM);
  if (single) {
    return { type: "unknown", reason: "Try phrasing it as \"below N\", \"above N\", \"between N and M\", or \"compare X and Y\"." };
  }

  return { type: "unknown", reason: "I couldn't understand that. Try: \"Show students below 30 marks\", \"Compare CSBS and CSE average scores\", or \"Create a pie chart for performance tiers\"." };
}
