import { describe, expect, it, vi } from "vitest";
import { compensateUploadedArtifactAndThrow } from "@/lib/storage-upload-compensation";

describe("compensateUploadedArtifactAndThrow", () => {
  it("removes exactly the uploaded path and rethrows the persistence error", async () => {
    const persistenceError = new Error("image row insert failed");
    const remove = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ remove });

    await expect(
      compensateUploadedArtifactAndThrow({
        storage: { from },
        bucket: "clinical-images",
        path: "owner/images/document/generation/image-1.png",
        persistenceError,
      }),
    ).rejects.toBe(persistenceError);

    expect(from).toHaveBeenCalledWith("clinical-images");
    expect(remove).toHaveBeenCalledWith(["owner/images/document/generation/image-1.png"]);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("reports both errors when compensation fails", async () => {
    const remove = vi.fn().mockResolvedValue({ error: { message: "storage remove failed" } });

    await expect(
      compensateUploadedArtifactAndThrow({
        storage: { from: () => ({ remove }) },
        bucket: "clinical-images",
        path: "owner/images/document/generation/image-1.png",
        persistenceError: new Error("image row insert failed"),
      }),
    ).rejects.toThrow("image row insert failed; uploaded artifact cleanup failed: storage remove failed");
  });
});
