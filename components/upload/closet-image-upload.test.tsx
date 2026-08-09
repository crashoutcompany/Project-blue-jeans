import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/compress-image", () => ({
  compressImageForUpload: vi.fn(async (f: File) => f),
}));

import { ClosetImageUpload } from "@/components/upload/closet-image-upload";

describe("ClosetImageUpload", () => {
  it("invokes onFilesReady for image files", async () => {
    const user = userEvent.setup();
    const onFilesReady = vi.fn();
    const { container } = render(
      <ClosetImageUpload onFilesReady={onFilesReady} />,
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).toBeTruthy();

    const file = new File(["x"], "a.png", { type: "image/png" });
    await user.upload(input as HTMLInputElement, file);

    await waitFor(() => {
      expect(onFilesReady).toHaveBeenCalled();
    });
  });
});
