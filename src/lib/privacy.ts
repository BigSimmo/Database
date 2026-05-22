export function safeIngestionJobLog(jobId: string) {
  return `Processing ingestion job ${jobId}`;
}

export function safeErrorLogDetails(error: unknown) {
  return {
    name: error instanceof Error ? error.name : typeof error,
  };
}
