# Docling lab sandbox image (docs/rag-improvement/README.md §B3).
#
# Build stage has network (hash-verified installs + model prefetch); the benchmark
# itself runs with `--network=none` (see eval/docling/run-lab.sh), so everything the
# run needs — both venvs, tesseract, and the docling models — is baked in here.
# The repository is NOT baked in: run-lab.sh bind-mounts it read-only at /repo.
#
# Same digest-pinned base as Dockerfile / Dockerfile.worker (Debian bookworm:
# python3 is 3.11, matching both hashed locks consumed below).
FROM node:24-bookworm-slim@sha256:235600a8101ab264e117b1768e925532262668dc9b581ef1dd7d96ced463b8e7

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    tesseract-ocr \
    fonts-dejavu-core \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Legacy comparator venv: read-only consumption of the worker's production hashed
# lock (the file is never modified — hard boundary in HANDOVER S6).
COPY worker/python/requirements.txt /tmp/legacy-requirements.txt
RUN python3 -m venv /opt/legacy-venv \
  && /opt/legacy-venv/bin/pip install --no-cache-dir --require-hashes -r /tmp/legacy-requirements.txt \
  && /opt/legacy-venv/bin/pip check \
  && rm /tmp/legacy-requirements.txt

# Docling venv from the lab's own hashed lock (CPU-only torch).
COPY eval/docling/requirements.txt /tmp/docling-requirements.txt
RUN python3 -m venv /opt/docling-venv \
  && /opt/docling-venv/bin/pip install --no-cache-dir --require-hashes -r /tmp/docling-requirements.txt \
  && /opt/docling-venv/bin/pip check \
  && rm /tmp/docling-requirements.txt

# Prefetch docling's models now: the egress-blocked run cannot reach HuggingFace,
# so a missing model at run time would fail every docling conversion.
RUN /opt/docling-venv/bin/docling-tools models download --output-dir /opt/docling-models \
  && chmod -R a+rX /opt/docling-models

RUN useradd --create-home --shell /usr/sbin/nologin lab
USER lab
WORKDIR /repo
