type StorageRemovalError = { message: string } | null;

export type UploadedArtifactStorage = {
  from: (bucket: string) => {
    remove: (paths: string[]) => Promise<{ error: StorageRemovalError }>;
  };
};

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return String(error);
}

/**
 * Remove one newly uploaded object when its corresponding database write did
 * not commit. Successful compensation preserves the original persistence
 * error; failed compensation reports both failures so the orphan is visible.
 */
export async function compensateUploadedArtifactAndThrow(args: {
  storage: UploadedArtifactStorage;
  bucket: string;
  path: string;
  persistenceError: unknown;
}): Promise<never> {
  let cleanupError: unknown = null;
  try {
    const cleanup = await args.storage.from(args.bucket).remove([args.path]);
    cleanupError = cleanup.error;
  } catch (error) {
    cleanupError = error;
  }

  if (cleanupError) {
    throw new Error(
      `Artifact persistence failed: ${errorMessage(args.persistenceError)}; uploaded artifact cleanup failed: ${errorMessage(cleanupError)}`,
      { cause: args.persistenceError },
    );
  }
  if (args.persistenceError instanceof Error) throw args.persistenceError;
  throw new Error(errorMessage(args.persistenceError));
}
