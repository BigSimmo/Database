#!/usr/bin/env python3
"""score — reduce both engines' raw per-document output to aggregate measurements.

Reads the two run_corpus.py outputs plus the per-document result files, scores
each engine against the manifest's ground truth, and writes the aggregate-only
measurements file that report/build-report.mjs turns into the final report:

    score.py --manifest <path> --raw-dir <out/raw> --out <out/raw/measurements.json>

Scoring definitions (kept here, next to the arithmetic, so a reviewer sees both):

- Parse success: the runner completed, and for text-bearing strata extracted
  non-empty text. A hostile document is never counted here.
- Table cell precision/recall: position-free multiset matching of normalised cell
  text between the manifest's declared cells and the engine's best-matching
  extracted table. Position-free because the engines disagree on header/body row
  indexing; the exactness Gate B cares about is whether the *values* survive.
  Strata with no ground-truth tables score vacuous 1.0 unless the engine
  hallucinates a table there (precision then drops).
- Numeric exactness: whitespace-normalised substring presence of each manifest
  assertion (dose, unit, comparator threshold) in the engine's extracted text and
  table cells combined.
- Hostile containment: a hostile document is contained when the engine neither
  crashes (dies by a signal the driver did not send, or exits outside its clean
  error contract) nor echoes a planted canary to stdout/stderr. A graceful parse
  of a malformed file and a clean failure are both containment — the hostile
  corpus asks whether misbehaviour is bounded, not whether parsing succeeds; the
  manifest's `containedFailure` flag documents which outcome is expected.

Stdlib only. The output carries numbers and ids only — the aggregate report is
additionally rebuilt through lab-contract.mjs's numeric allowlist, so even this
file's shape is not trusted as a leak boundary.
"""

from __future__ import annotations

import argparse
import html
import json
import re
from collections import Counter
from pathlib import Path

TEXT_STRATA = {"text_simple", "layout_multicolumn", "table_simple", "table_heavy", "scanned_ocr", "numeric_dense"}


def normalise(text: str) -> str:
    # Escape-neutral like the existing `\|` handling: docling's markdown export
    # HTML-escapes angle brackets, so a comparator assertion like '>= 1.4 mmol/L'
    # surfaces as '&gt;= 1.4 mmol/L' — the value intact, only entity-encoded.
    # Run 32174653778 scored those as missing (-25 to -62.5pp per stratum) purely
    # on this encoding difference; exactness compares values, not escaping.
    return " ".join(html.unescape(text.replace("\\|", "|")).split()).lower()


def percentile(values: list[int], fraction: float) -> int:
    if not values:
        return 0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round(fraction * (len(ordered) - 1))))
    return ordered[index]


def markdown_to_cells(markdown: str) -> list[str]:
    cells: list[str] = []
    for line in markdown.splitlines():
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        row = [part.strip() for part in stripped.strip("|").split("|")]
        if row and all(re.fullmatch(r":?-{2,}:?", part) for part in row if part):
            continue  # separator row
        cells.extend(part for part in row if part)
    return cells


def engine_cells(result: dict) -> list[list[str]]:
    """Each extracted table as a list of normalised cell strings."""
    tables = []
    for table in result.get("tables", []):
        if isinstance(table.get("cells"), list):
            texts = [cell.get("text", "") for cell in table["cells"] if isinstance(cell, dict)]
        elif isinstance(table.get("markdown"), str):
            texts = markdown_to_cells(table["markdown"])
        else:
            texts = []
        tables.append([normalise(text) for text in texts if normalise(text)])
    return tables


def score_tables(truth_tables: list[list[str]], extracted_tables: list[list[str]]) -> tuple[int, int, int]:
    """Return (matched, truthCells, extractedCells) with greedy best-table matching."""
    truth_cells = sum(len(cells) for cells in truth_tables)
    extracted_cells = sum(len(cells) for cells in extracted_tables)
    matched = 0
    remaining = [Counter(cells) for cells in extracted_tables]
    for truth in truth_tables:
        truth_counter = Counter(truth)
        best_index, best_overlap = None, 0
        for index, candidate in enumerate(remaining):
            overlap = sum((truth_counter & candidate).values())
            if overlap > best_overlap:
                best_index, best_overlap = index, overlap
        if best_index is not None:
            matched += best_overlap
            remaining.pop(best_index)
    return matched, truth_cells, extracted_cells


def load_result(raw_dir: Path, record: dict) -> dict | None:
    if not record.get("resultPath"):
        return None
    path = raw_dir / record["resultPath"]
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def score_engine(engine_run: dict, manifest: dict, raw_dir: Path, canary_tokens: list[str]) -> dict:
    fixtures_by_id = {fixture["id"]: fixture for fixture in manifest["fixtures"]}
    hostile_by_id = {entry["id"]: entry for entry in manifest["hostile"]}
    per_stratum_docs: dict[str, list[dict]] = {stratum: [] for stratum in manifest["strata"]}
    hostile_docs: list[dict] = []

    for record in engine_run["perDoc"]:
        if record["kind"] == "hostile":
            hostile_docs.append(record)
        else:
            per_stratum_docs[fixtures_by_id[record["id"]]["stratum"]].append(record)

    per_stratum = {}
    for stratum, records in per_stratum_docs.items():
        wall_clocks = [record["wallClockMs"] for record in records]
        parse_success = 0
        matched = truth_cells = extracted_cells = 0
        assertions_total = assertions_found = 0
        for record in records:
            fixture = fixtures_by_id[record["id"]]
            result = load_result(raw_dir, record)
            text = result.get("text", "") if result else ""
            table_grids = engine_cells(result) if result else []
            haystack = normalise("\n".join([text, *[" ".join(cells) for cells in table_grids]]))
            if record["exitReason"] == "completed" and result and result.get("ok") and haystack:
                parse_success += 1
            truth_tables = [
                [normalise(cell["text"]) for cell in table["cells"]] for table in fixture["tables"]
            ]
            table_matched, table_truth, table_extracted = score_tables(truth_tables, table_grids)
            matched += table_matched
            truth_cells += table_truth
            extracted_cells += table_extracted
            assertions_total += len(fixture["assertions"])
            assertions_found += sum(1 for assertion in fixture["assertions"] if normalise(assertion["text"]) in haystack)
        precision = matched / extracted_cells if extracted_cells else 1.0
        recall = matched / truth_cells if truth_cells else 1.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
        per_stratum[stratum] = {
            "docCount": len(records),
            "parseSuccessCount": parse_success,
            "wallClockMsP50": percentile(wall_clocks, 0.5),
            "wallClockMsP95": percentile(wall_clocks, 0.95),
            "peakRssBytesMax": max((record["peakRssBytes"] for record in records), default=0),
            "tableCellPrecision": round(precision, 4),
            "tableCellRecall": round(recall, 4),
            "tableCellF1": round(f1, 4),
            "assertionsTotal": assertions_total,
            "assertionsFound": assertions_found,
        }

    contained = crash_artifacts = canary_echoes = 0
    for record in hostile_docs:
        entry = hostile_by_id[record["id"]]
        streams = f"{record.get('stdoutTail', '')}\n{record.get('stderrTail', '')}"
        echoed = any(token in streams for token in canary_tokens)
        if echoed:
            canary_echoes += 1
        crashed = record["exitReason"] in {"crash", "signal"}
        if crashed:
            crash_artifacts += 1
        if not crashed and not echoed:
            contained += 1
        del entry  # expectation flags are documentation; containment is uniform

    return {
        "perStratum": per_stratum,
        "hostile": {
            "docCount": len(hostile_docs),
            "containedCount": contained,
            "crashArtifactCount": crash_artifacts,
            "canaryEchoCount": canary_echoes,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--raw-dir", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    raw_dir = Path(args.raw_dir)
    canary_tokens = [entry["token"] for entry in manifest["canaryRegistry"]]

    engines = {}
    for engine in ("legacy", "docling"):
        run_path = raw_dir / f"{engine}.json"
        engine_run = json.loads(run_path.read_text(encoding="utf-8"))
        engines[engine] = score_engine(engine_run, manifest, raw_dir, canary_tokens)

    Path(args.out).write_text(
        json.dumps({"datasetVersion": manifest["datasetVersion"], "engines": engines}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"score: wrote {args.out}")


if __name__ == "__main__":
    main()
