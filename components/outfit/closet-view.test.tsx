import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const toggleGarmentFavorite = vi.fn();

vi.mock("@/app/actions/garments", () => ({
  toggleGarmentFavorite: (...args: unknown[]) => toggleGarmentFavorite(...args),
}));

vi.mock("@/app/actions/outfits", () => ({
  wearOutfitToday: vi.fn(),
  renameOutfit: vi.fn(),
  getTodaysOutfitId: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/uploadthing", () => ({
  useUploadThing: () => ({
    startUpload: vi.fn(),
  }),
}));

vi.mock("@/components/ui/sidebar", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/ui/sidebar")
  >("@/components/ui/sidebar");
  return {
    ...actual,
    useSidebar: () => ({
      state: "expanded",
      open: true,
      setOpen: vi.fn(),
      openMobile: false,
      setOpenMobile: vi.fn(),
      isMobile: false,
      toggleSidebar: vi.fn(),
    }),
  };
});

import { ClosetView } from "@/components/outfit/closet-view";

describe("ClosetView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
      screen.getByRole("button", { name: /view details for shirt/i }),
    );
    await user.click(screen.getByRole("button", { name: /add to favorites/i }));
    expect(toggleGarmentFavorite).toHaveBeenCalledWith(gid);
  });

  it("confirms then deletes a garment via DELETE /api/closet/garments", async () => {
    const user = userEvent.setup();
    const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

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
      screen.getByRole("button", { name: /view details for shirt/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /remove from closet/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /delete photo and piece/i }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/closet/garments",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /view details for shirt/i }),
      ).not.toBeInTheDocument();
    });
  });
});
