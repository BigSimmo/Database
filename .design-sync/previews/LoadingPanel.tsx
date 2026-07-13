import { LoadingPanel } from "prompt-for-codex-medical-knowledge-base";

export const Spinner = () => <LoadingPanel label="Searching guidelines…" />;

export const Skeleton = () => <LoadingPanel variant="skeleton" label="Loading answer" lines={3} />;

export const SkeletonLong = () => <LoadingPanel variant="skeleton" label="Loading document list" lines={5} />;
