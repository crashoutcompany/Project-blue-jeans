import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const toggleGarmentFavorite = vi.fn();

vi.mock("@/app/actions/garments", () => ({
  toggleGarmentFavorite: (...args: unknown[]) => toggleGarmentFavorite(...args),
}));

vi.mock("@/lib/uploadthing", () => ({
  useUploadThing: () => ({
    startUpload: vi.fn(),
  }),
}));

import { ClosetView } from "@/components/outfit/closet-view";

describe("ClosetView", () => {
  it("calls toggleGarmentFavorite when favorite is clicked", async () => {
    const user = userEvent.setup();
    toggleGarmentFavorite.mockResolvedValue({ ok: true });
    const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    render(
      <ClosetView
        initialGarments={[
          {
            id: gid,
            name: "Shirt",
            category: "tops",
            imageUrl: "https://example.com/a.jpg",
            isFavorite: false,
          },
        ]}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /add to favorites/i }),
    );
    expect(toggleGarmentFavorite).toHaveBeenCalledWith(gid);
  });
});
