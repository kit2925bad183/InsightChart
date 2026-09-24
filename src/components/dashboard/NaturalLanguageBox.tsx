"use client";

import { useState } from "react";
import { Sparkles, Search } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { parseNlQuery } from "@/lib/nlQuery";
import type { StudentRecord } from "@/lib/analysis/stats";
import { mean, round1 } from "@/lib/analysis/stats";

const EXAMPLES = [
  "Show students below 30 marks",
  "Compare CSBS and CSE average scores",
  "Create a pie chart for performance tiers",
  "Show names of students scoring between 51 and 60",
];

export function NaturalLanguageBox({ records }: { records: StudentRecord[] }) {
  const { dispatch } = useApp();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ summary: string; students?: StudentRecord[] } | null>(null);

  const departments = Array.from(new Set(records.map((r) => r.department)));

  const run = (q: string) => {
    setQuery(q);
    const action = parseNlQuery(q, departments);
    let summary = "";
    let students: StudentRecord[] | undefined;

    switch (action.type) {
      case "filter-below": {
        students = records.filter((r) => r.score < action.value);
        summary = `${students.length} student${students.length === 1 ? "" : "s"} scored below ${action.value}.`;
        dispatch({ type: "SET_MAPPING", mapping: { scoreMax: action.value - 0.01, scoreMin: undefined } });
        break;
      }
      case "filter-above": {
        students = records.filter((r) => r.score > action.value);
        summary = `${students.length} student${students.length === 1 ? "" : "s"} scored above ${action.value}.`;
        dispatch({ type: "SET_MAPPING", mapping: { scoreMin: action.value + 0.01, scoreMax: undefined } });
        break;
      }
      case "filter-range":
      case "names-range": {
        students = records.filter((r) => r.score >= action.min && r.score <= action.max);
        summary = `${students.length} student${students.length === 1 ? "" : "s"} scored between ${action.min} and ${action.max}.`;
        dispatch({ type: "SET_MAPPING", mapping: { scoreMin: action.min, scoreMax: action.max } });
        break;
      }
      case "pie-tiers": {
        dispatch({ type: "SET_CHART_TYPE", chartType: "pie" });
        dispatch({ type: "SET_MAPPING", mapping: { category: undefined } });
        summary = "Switched the custom chart to a pie chart of performance tiers.";
        break;
      }
      case "compare-departments": {
        const rows = action.departments.map((d) => {
          const scores = records.filter((r) => r.department === d).map((r) => r.score);
          return `${d}: avg ${round1(mean(scores))} (${scores.length} students)`;
        });
        summary = `Comparison — ${rows.join(" · ")}`;
        break;
      }
      case "unknown":
        summary = action.reason;
        break;
    }

    setResult({ summary, students });
    dispatch({ type: "ADD_NL_HISTORY", query: q, resultSummary: summary });
  };

  return (
    <Card>
      <CardHeader title="Ask about your data" subtitle="Natural-language filters and chart requests" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) run(query);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g. "Show students below 30 marks"'
            aria-label="Natural language query"
            className="w-full text-sm rounded-lg border border-[var(--border-strong)] bg-white pl-8 pr-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          />
        </div>
        <Button type="submit" variant="primary" size="md">
          <Sparkles size={14} /> Ask
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => run(ex)}
            type="button"
            className="text-[11px] rounded-full border border-[var(--border)] px-2.5 py-1 text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {ex}
          </button>
        ))}
      </div>

      {result && (
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted,#f2f6fc)] p-3 fade-in">
          <p className="text-xs font-medium text-[var(--text-primary)]">{result.summary}</p>
          {result.students && result.students.length > 0 && (
            <ul className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)] max-h-40 overflow-y-auto">
              {result.students.slice(0, 30).map((s, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{s.name}</span>
                  <span className="tabular font-medium text-[var(--text-primary)]">{s.score}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
