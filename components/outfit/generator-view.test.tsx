import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GeneratorView } from "@/components/outfit/generator-view";

describe("GeneratorView", () => {
  const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  const garments = [
    {
      id: gid,
      name: "Tee",
      category: "tops",
      imageUrl: "https://example.com/a.jpg",
    },
  ];

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            looks: [
              {
                id: "look-1",
                title: "Look",
                description: "Desc",
                tags: ["day"],
                featured: true,
                garmentIds: [gid],
              },
            ],
            curatorNote: "Note",
          }),
      }),
    );
  });

  it("POSTs /api/generate-lookbook when sending a prompt", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    render(<GeneratorView closetGarments={garments} />);
    await user.type(screen.getByLabelText(/outfit request/i), "Brunch look");
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/generate-lookbook",
        expect.objectContaining({ method: "POST" }),
      );
    });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Look" })).toBeInTheDocument();
    });
    expect(screen.getByText("Your look includes:")).toBeInTheDocument();
    expect(screen.getByText("Tee")).toBeInTheDocument();
  });

  it("starts generation from an empty-state starter", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    render(<GeneratorView closetGarments={garments} />);
    await user.click(screen.getByRole("button", { name: /gallery opening/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/generate-lookbook",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const body = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(body.narrative).toMatch(/gallery opening/i);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Look" })).toBeInTheDocument();
    });
  });

  /**
   * `disabled` only takes effect on the next render, so two clicks dispatched
   * before React re-renders would both spend the account's Gemini quota.
   */
  it("generates once when a starter is double-clicked in the same frame", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<GeneratorView closetGarments={garments} />);
    const starter = screen.getByRole("button", { name: /gallery opening/i });

    starter.click();
    starter.click();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(
      fetchMock.mock.calls.filter(
        (call) => call[0] === "/api/generate-lookbook",
      ),
    ).toHaveLength(1);
  });

  it("does not POST Include marks for committed Outfit tops", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    const oxford = {
      id: "a47ac10b-58cc-4372-a567-0e02b2c3d479",
      name: "Oxford",
      category: "tops",
      imageUrl: "https://example.com/b.jpg",
    };
    const { rerender } = render(
      <GeneratorView closetGarments={[...garments, oxford]} />,
    );
    await user.click(screen.getByRole("button", { name: "Tops" }));
    await user.click(screen.getByRole("button", { name: /include tee/i }));
    rerender(
      <GeneratorView
        closetGarments={[...garments, oxford]}
        committedOutfitTopIds={[gid]}
      />,
    );
    await user.type(screen.getByLabelText(/outfit request/i), "Brunch look");
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/generate-lookbook",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const body = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(body.includedGarmentIds ?? []).not.toContain(gid);
  });
});
