import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GoogleAiStudioCard } from "@/components/settings/google-ai-studio-card";

const connectedView = {
  funding: "byok" as const,
  canEdit: true,
  connected: true,
  testedAt: "2026-08-18T12:00:00.000Z",
};

const fetchMock = vi.fn();

describe("GoogleAiStudioCard", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows only Connected, with Replace and Disconnect, and no key input", () => {
    render(<GoogleAiStudioCard initial={connectedView} />);

    expect(screen.getByText(/^Connected\./)).toBeInTheDocument();
    expect(screen.queryByText(/…/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Replace key" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Disconnect" }),
    ).toBeInTheDocument();
  });

  it("opens an empty password field to replace the key, and Cancel discards it", async () => {
    const user = userEvent.setup();
    render(<GoogleAiStudioCard initial={connectedView} />);

    await user.click(screen.getByRole("button", { name: "Replace key" }));
    const input = screen.getByLabelText("New API key");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("");

    await user.type(input, "AIza-typed-but-cancelled");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("New API key")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Replace key" }));
    expect(screen.getByLabelText("New API key")).toHaveValue("");
  });

  it("clears the field after a successful save", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    render(
      <GoogleAiStudioCard initial={{ ...connectedView, connected: false }} />,
    );

    const input = screen.getByLabelText("API key");
    expect(input).toHaveAttribute("type", "password");
    await user.type(input, "AIza-new-wearer-key");
    await user.click(screen.getByRole("button", { name: "Save key" }));

    await waitFor(() => expect(input).toHaveValue(""));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/settings/providers/google-ai-studio",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ apiKey: "AIza-new-wearer-key" }),
      }),
    );
  });
});
