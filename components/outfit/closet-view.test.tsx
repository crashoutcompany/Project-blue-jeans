import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
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

vi.mock("@/lib/compress-image", () => ({
  compressImageForUpload: vi.fn(async (file: File) => file),
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

// jsdom has no object URLs; draft previews only need a string.
Object.assign(URL, {
  createObjectURL: () => "blob:preview",
  revokeObjectURL: () => {},
});

describe("ClosetView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Upload one photo with the category suggestion held until `suggest()`. */
  async function queueDraftWithPendingSuggestion() {
    const user = userEvent.setup();
    let respond: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            respond = resolve;
          }),
      ),
    );
    render(<ClosetView initialGarments={[]} />);
    await user.upload(
      screen.getByLabelText("Choose clothing photos"),
      new File(["x"], "boots.png", { type: "image/png" }),
    );
    const drafts = await screen.findByRole("region", { name: "Ready to save" });
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const suggest = (category: string) =>
      act(async () => {
        respond({ ok: true, json: async () => ({ ok: true, category }) });
      });
    return { user, drafts, suggest };
  }

  function pressed(drafts: HTMLElement, category: string) {
    return within(drafts)
      .getByRole("button", { name: category })
      .getAttribute("aria-pressed");
  }

  it("applies the AI category suggestion to an untouched draft", async () => {
    const { drafts, suggest } = await queueDraftWithPendingSuggestion();

    await suggest("bottoms");

    expect(pressed(drafts, "Bottoms")).toBe("true");
  });

  /** Tops is also the default, so only the touched flag tells them apart. */
  it("keeps a hand-confirmed Tops when the AI suggestion arrives later", async () => {
    const { user, drafts, suggest } = await queueDraftWithPendingSuggestion();

    await user.click(within(drafts).getByRole("button", { name: "Tops" }));
    await suggest("bottoms");

    expect(pressed(drafts, "Tops")).toBe("true");
    expect(pressed(drafts, "Bottoms")).toBe("false");
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
