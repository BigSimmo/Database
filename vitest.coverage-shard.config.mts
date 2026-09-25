import config from "./vitest.config.mjs";

// A partition is not a coverage verdict. CI requires both successful partitions,
// then merges their blobs using the original config and its unchanged thresholds.
export default {
  ...config,
  test: {
    ...config.test,
    coverage: { ...config.test.coverage, reporter: [], thresholds: undefined },
  },
};
