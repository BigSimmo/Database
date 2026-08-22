#!/usr/bin/env bash
# entry.sh — in-container phase driver for the Docling lab benchmark.
#
# Runs as the non-root `lab` user inside the egress-blocked container started by
# eval/docling/run-lab.sh: the repository is bind-mounted read-only at /repo, the
# only writable paths are /out (bind mount) and /tmp (tmpfs). Phases:
#   1. generate the fixture corpus from the committed manifest (self-checking);
#   2. legacy engine pass  (extractDocument -> worker Python venv, read-only use);
#   3. docling engine pass (docling venv, models baked at image build);
#   4. score both passes into aggregate measurements.
# The final report is assembled on the host afterwards (build-report.mjs needs git).
set -euo pipefail

REPO=/repo
OUT=/out
LAB="$REPO/eval/docling"
DOCLING_PY=/opt/docling-venv/bin/python
LEGACY_PY=/opt/legacy-venv/bin/python

mkdir -p "$OUT/corpus" "$OUT/raw"

echo "== phase 1: fixtures =="
"$DOCLING_PY" "$LAB/fixtures/generate_fixtures.py" \
  --manifest "$LAB/fixtures/manifest.v1.json" \
  --out "$OUT/corpus"

echo "== phase 2: legacy engine =="
PYTHON_BIN="$LEGACY_PY" "$LEGACY_PY" "$LAB/harness/run_corpus.py" \
  --engine legacy \
  --corpus "$OUT/corpus" \
  --manifest "$LAB/fixtures/manifest.v1.json" \
  --config "$LAB/report/lab-config.json" \
  --out "$OUT/raw/legacy.json"

echo "== phase 3: docling engine =="
# TORCHDYNAMO_DISABLE=1: docling's models call torch.compile, whose Inductor
# backend needs a C++ compiler at runtime — the sandbox image deliberately has
# none, which failed every clean conversion in run 32171549648 with
# InvalidCxxCompiler. Eager mode is deterministic and needs no toolchain; each
# document runs in a fresh process anyway, so per-doc compilation only added
# overhead.
TORCHDYNAMO_DISABLE=1 DOCLING_PYTHON="$DOCLING_PY" DOCLING_ARTIFACTS_PATH=/opt/docling-models \
  "$DOCLING_PY" "$LAB/harness/run_corpus.py" \
  --engine docling \
  --corpus "$OUT/corpus" \
  --manifest "$LAB/fixtures/manifest.v1.json" \
  --config "$LAB/report/lab-config.json" \
  --out "$OUT/raw/docling.json" \
  --warmup

echo "== phase 4: score =="
"$DOCLING_PY" "$LAB/harness/score.py" \
  --manifest "$LAB/fixtures/manifest.v1.json" \
  --raw-dir "$OUT/raw" \
  --out "$OUT/raw/measurements.json"

echo "entry.sh: all phases complete"
