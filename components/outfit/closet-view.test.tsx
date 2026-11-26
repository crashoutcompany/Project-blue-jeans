import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const toggleGarmentFavorite = vi.fn();
const setGarmentRetired = vi.fn();

vi.mock("@/app/actions/garments", () => ({
  toggleGarmentFavorite: (...args: unknown[]) => toggleGarmentFavorite(...args),
  setGarmentRetired: (...args: unknown[]) => setGarmentRetired(...args),
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

  it("shows each piece's wear count on the card and in details", async () => {
    const user = userEvent.setup();
    render(
      <ClosetView
        initialGarments={[
          { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", name: "Tee", category: "tops", wearCount: 3 },
          { id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12", name: "Blazer", category: "outerwear", wearCount: 0 },
        ]}
      />,
    );

    const cards = screen.getAllByTestId("garment-wear-count");
    expect(cards.map((c) => c.textContent)).toEqual([
      "Worn 3 times",
      "Never worn",
    ]);
    await user.click(
      screen.getByRole("button", { name: /view details for blazer, never worn/i }),
    );
    expect(screen.getByTestId("garment-detail-wear-count")).toHaveTextContent(
      "Never worn",
    );
  });

  it("retires a piece into the Retired tab and unhides it back", async () => {
    const user = userEvent.setup();
    setGarmentRetired.mockResolvedValue({ ok: true });
    const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    render(
      <ClosetView
        initialGarments={[
          { id: gid, name: "Blazer", category: "outerwear", wearCount: 0 },
          { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", name: "Tee", category: "tops", wearCount: 2 },
        ]}
      />,
    );
    expect(screen.getByText("2 pieces")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /view details for blazer/i }),
    );
    await user.click(screen.getByRole("button", { name: "Retire piece" }));

    expect(setGarmentRetired).toHaveBeenCalledWith(gid, true);
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /view details for blazer/i }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText("1 piece")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Retired" }));
    const retired = screen.getByRole("region", { name: "Retired pieces" });
    // The add-photos dock would sit over the Unhide buttons.
    expect(screen.getByTestId("closet-add-zone")).toHaveClass("hidden");
    expect(
      within(retired).getByRole("button", { name: /view details for blazer/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 retired")).toBeInTheDocument();

    await user.click(
      within(retired).getByRole("button", { name: "Unhide Blazer" }),
    );
    expect(setGarmentRetired).toHaveBeenLastCalledWith(gid, false);
    await waitFor(() => {
      expect(within(retired).getByText("No retired pieces")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: "Pieces" }));
    expect(
      screen.getByRole("button", { name: /view details for blazer/i }),
    ).toBeInTheDocument();
  });

  it("keeps a piece in place when retiring fails", async () => {
    const user = userEvent.setup();
    setGarmentRetired.mockResolvedValue({
      ok: false,
      message: "That piece was not found.",
    });
    render(
      <ClosetView
        initialGarments={[
          { id: "f47ac10b-58cc-4372-a567-0e02b2c3d479", name: "Blazer", category: "outerwear" },
        ]}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /view details for blazer/i }),
    );
    await user.click(screen.getByRole("button", { name: "Retire piece" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That piece was not found.",
    );
    expect(screen.getByText("1 piece")).toBeInTheDocument();
  });
});
