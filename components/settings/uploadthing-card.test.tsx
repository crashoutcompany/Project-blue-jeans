import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { UploadThingCard } from "@/components/settings/uploadthing-card";

const connectedView = {
  funding: "byok" as const,
  canEdit: true,
  connected: true,
  testedAt: "2026-08-18T12:00:00.000Z",
};

const fetchMock = vi.fn();

describe("UploadThingCard", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows only Connected, with Replace and Disconnect, and no token input", () => {
    render(<UploadThingCard initial={connectedView} />);

    expect(screen.getByText(/^Connected\./)).toBeInTheDocument();
    expect(screen.queryByText(/…/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/api token/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Replace token" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Disconnect" }),
    ).toBeInTheDocument();
  });

  it("opens an empty password field to replace the token, and Cancel discards it", async () => {
    const user = userEvent.setup();
    render(<UploadThingCard initial={connectedView} />);

    await user.click(screen.getByRole("button", { name: "Replace token" }));
    const input = screen.getByLabelText("New API token");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("");

    await user.type(input, "ut-typed-but-cancelled");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("New API token")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Replace token" }));
    expect(screen.getByLabelText("New API token")).toHaveValue("");
  });

  it("clears the field after a successful save", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    render(
      <UploadThingCard initial={{ ...connectedView, connected: false }} />,
    );

    const input = screen.getByLabelText("API token");
    expect(input).toHaveAttribute("type", "password");
    await user.type(input, "ut-new-wearer-token");
    await user.click(screen.getByRole("button", { name: "Save token" }));

    await waitFor(() => expect(input).toHaveValue(""));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/settings/providers/uploadthing",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ token: "ut-new-wearer-token" }),
      }),
    );
  });
});
