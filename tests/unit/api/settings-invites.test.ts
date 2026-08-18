import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admitted", () => ({
  assertAdmittedSession: vi.fn(),
}));

vi.mock("@/lib/auth/invites", () => ({
  createWearerInvite: vi.fn(),
  listPendingInvites: vi.fn(),
}));

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { createWearerInvite, listPendingInvites } from "@/lib/auth/invites";
import { GET, POST } from "@/app/api/settings/invites/route";

const admitted = vi.mocked(assertAdmittedSession);
const createInvite = vi.mocked(createWearerInvite);
const listInvites = vi.mocked(listPendingInvites);

const ownerGate = {
  ok: true as const,
  userId: "owner-1",
  membership: {
    userId: "owner-1",
    accessRole: "owner" as const,
    credentialSource: "platform_env" as const,
    status: "active" as const,
    persisted: true,
  },
};

const wearerGate = {
  ok: true as const,
  userId: "wearer-1",
  membership: {
    userId: "wearer-1",
    accessRole: "wearer" as const,
    credentialSource: "user_byok" as const,
    status: "active" as const,
    persisted: true,
  },
};

describe("settings invite routes", () => {
  beforeEach(() => {
    admitted.mockReset();
    createInvite.mockReset();
    listInvites.mockReset();
  });

  it("GET returns 403 for non-owners", async () => {
    admitted.mockResolvedValue(wearerGate);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(listInvites).not.toHaveBeenCalled();
  });

  it("GET lists pending invites for the owner", async () => {
    admitted.mockResolvedValue(ownerGate);
    listInvites.mockResolvedValue([
      {
        id: "inv-1",
        email: "a@b.com",
        expiresAt: "2026-08-25T00:00:00.000Z",
      },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      invites: [
        {
          id: "inv-1",
          email: "a@b.com",
          expiresAt: "2026-08-25T00:00:00.000Z",
        },
      ],
    });
  });

  it("POST returns 403 for non-owners", async () => {
    admitted.mockResolvedValue(wearerGate);
    const res = await POST(
      new Request("http://localhost/api/settings/invites", {
        method: "POST",
        body: JSON.stringify({ email: "a@b.com" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(createInvite).not.toHaveBeenCalled();
  });

  it("POST creates an invite for the owner", async () => {
    admitted.mockResolvedValue(ownerGate);
    createInvite.mockResolvedValue({
      ok: true,
      token: "raw-token",
      email: "a@b.com",
      expiresAt: "2026-08-25T00:00:00.000Z",
    });
    const res = await POST(
      new Request("http://localhost/api/settings/invites", {
        method: "POST",
        body: JSON.stringify({ email: "a@b.com" }),
      }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      token: "raw-token",
      email: "a@b.com",
      expiresAt: "2026-08-25T00:00:00.000Z",
    });
  });
});
