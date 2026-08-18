#!/usr/bin/env python3
"""run_corpus — uniform per-document driver for both lab engines.

One driver owns the sandbox measurements so legacy and docling are treated
identically: each document runs in a child process inside its own process group,
with the per-document wall clock from report/lab-config.json enforced by SIGKILL
to the whole group, peak RSS taken from os.wait4 rusage, and stdout/stderr
captured only as bounded tails (an engine echoing document content to its streams
is a leak, and score.py scans for exactly that).

    run_corpus.py --engine legacy|docling --corpus <out-dir> --manifest <path> \
        --config <lab-config.json> --out <raw.json> [--warmup]

Stdlib only, no network. Raw per-document output (which may carry extracted text
in each result file) stays under the run's out/raw/ directory and is reduced to
aggregates by score.py; nothing here is a reportable sink.
"""

from __future__ import annotations

import argparse
import json
import os
import resource
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

STREAM_TAIL_BYTES = 10 * 1024


def read_stream(stream, sink: dict, key: str) -> None:
    captured = b""
    while True:
        chunk = stream.read(64 * 1024)
        if not chunk:
            break
        if len(captured) < STREAM_TAIL_BYTES:
            captured += chunk[: STREAM_TAIL_BYTES - len(captured)]
    sink[key] = captured.decode("utf-8", errors="replace")


def engine_command(engine: str, repo_root: Path, file_path: Path, result_path: Path) -> list[str]:
    harness = repo_root / "eval" / "docling" / "harness"
    if engine == "legacy":
        return [
            os.environ.get("LAB_NODE_BIN", "node"),
            str(repo_root / "scripts" / "run-tsx.mjs"),
            str(harness / "run-legacy.ts"),
            "--file",
            str(file_path),
            "--result",
            str(result_path),
        ]
    return [
        os.environ.get("DOCLING_PYTHON", sys.executable),
        str(harness / "run_docling.py"),
        "--file",
        str(file_path),
        "--result",
        str(result_path),
    ]


def run_one(cmd: list[str], timeout_seconds: int, cwd: Path) -> dict:
    started = time.monotonic()
    proc = subprocess.Popen(
        cmd,
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
    )
    streams: dict = {}
    readers = [
        threading.Thread(target=read_stream, args=(proc.stdout, streams, "stdout"), daemon=True),
        threading.Thread(target=read_stream, args=(proc.stderr, streams, "stderr"), daemon=True),
    ]
    for reader in readers:
        reader.start()

    timed_out = False
    status = None
    rusage = None
    deadline = started + timeout_seconds
    while True:
        done_pid, status, rusage = os.wait4(proc.pid, os.WNOHANG)
        if done_pid == proc.pid:
            break
        if time.monotonic() > deadline and not timed_out:
            timed_out = True
            # Kill the whole process group: the legacy runner spawns a Python child
            # of its own, and containment means nothing survives the deadline.
            os.killpg(proc.pid, signal.SIGKILL)
        time.sleep(0.05)
    wall_clock_ms = int((time.monotonic() - started) * 1000)
    for reader in readers:
        reader.join(timeout=5)
    # os.wait4 already reaped the child; tell Popen so its destructor stays quiet.
    proc.returncode = 0

    exit_code = os.waitstatus_to_exitcode(status) if not os.WIFSIGNALED(status) else None
    termination_signal = os.WTERMSIG(status) if os.WIFSIGNALED(status) else None
    if timed_out:
        exit_reason = "timeout"
    elif termination_signal is not None:
        exit_reason = "signal"
    elif exit_code == 0:
        exit_reason = "completed"
    elif exit_code == 10:
        exit_reason = "error"
    else:
        exit_reason = "crash"
    return {
        "exitReason": exit_reason,
        "exitCode": exit_code,
        "signal": termination_signal,
        "wallClockMs": wall_clock_ms,
        "peakRssBytes": (rusage.ru_maxrss if rusage else 0) * 1024,
        "stdoutTail": streams.get("stdout", ""),
        "stderrTail": streams.get("stderr", ""),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", required=True, choices=["legacy", "docling"])
    parser.add_argument("--corpus", required=True, help="directory containing fixtures/ and hostile/")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--config", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--warmup", action="store_true", help="run one untimed conversion first (model load)")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[3]
    corpus = Path(args.corpus)
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    sandbox = config["sandbox"]
    caps = config["outputCaps"]
    os.environ.setdefault("LAB_PER_DOC_TEXT_BYTES", str(caps["perDocumentTextBytes"]))

    documents = [
        {"id": fixture["id"], "kind": "fixture", "path": corpus / "fixtures" / f"{fixture['id']}.pdf"}
        for fixture in manifest["fixtures"]
    ] + [
        {"id": entry["id"], "kind": "hostile", "path": corpus / "hostile" / f"{entry['id']}.pdf"}
        for entry in manifest["hostile"]
    ]
    missing = [str(doc["path"]) for doc in documents if not doc["path"].exists()]
    if missing:
        print(f"run_corpus: {len(missing)} corpus file(s) missing — run generate_fixtures.py first", file=sys.stderr)
        raise SystemExit(1)

    results_dir = Path(args.out).parent / f"{args.engine}-docs"
    results_dir.mkdir(parents=True, exist_ok=True)

    if args.warmup:
        warmup_result = results_dir / "warmup.json"
        run_one(
            engine_command(args.engine, repo_root, documents[0]["path"], warmup_result),
            sandbox["perDocumentWallClockSeconds"],
            repo_root,
        )
        warmup_result.unlink(missing_ok=True)

    total_raw_bytes = 0
    per_doc = []
    for doc in documents:
        result_path = results_dir / f"{doc['id']}.json"
        timeout_seconds = (
            sandbox["hostilePerDocumentWallClockSeconds"] if doc["kind"] == "hostile" else sandbox["perDocumentWallClockSeconds"]
        )
        record = run_one(engine_command(args.engine, repo_root, doc["path"], result_path), timeout_seconds, repo_root)
        record.update({"id": doc["id"], "kind": doc["kind"]})

        result_bytes = result_path.stat().st_size if result_path.exists() else 0
        if result_bytes > caps["perDocumentTextBytes"] + 1024 * 1024:
            # Over the per-document output cap: the material is discarded, the breach recorded.
            result_path.unlink()
            record["exitReason"] = "output_cap_exceeded"
            result_bytes = 0
        total_raw_bytes += result_bytes
        if total_raw_bytes > caps["totalRawBytes"]:
            print("run_corpus: total raw output cap exceeded — aborting run", file=sys.stderr)
            raise SystemExit(1)
        record["resultBytes"] = result_bytes
        record["resultPath"] = str(result_path.relative_to(results_dir.parent)) if result_bytes > 0 else None
        per_doc.append(record)
        print(
            f"run_corpus[{args.engine}] {doc['id']}: {record['exitReason']} "
            f"{record['wallClockMs']}ms rss={record['peakRssBytes'] // (1024 * 1024)}MB",
            flush=True,
        )

    Path(args.out).write_text(
        json.dumps(
            {
                "engine": args.engine,
                "datasetVersion": manifest["datasetVersion"],
                "resourceLimits": {
                    "perDocumentWallClockSeconds": sandbox["perDocumentWallClockSeconds"],
                    "hostilePerDocumentWallClockSeconds": sandbox["hostilePerDocumentWallClockSeconds"],
                },
                "perDoc": per_doc,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"run_corpus[{args.engine}]: wrote {args.out} ({len(per_doc)} documents)")


if __name__ == "__main__":
    main()
