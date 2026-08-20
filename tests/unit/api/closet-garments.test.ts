import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: vi.fn(),
  },
}));

vi.mock("@/lib/auth/admitted", () => ({
  assertAdmittedSession: vi.fn(),
}));

vi.mock("@/lib/garments/persist-uploaded-garments", () => ({
  persistUploadedGarmentItems: vi.fn(),
}));

vi.mock("@/lib/garments/delete-garment", () => ({
  deleteGarment: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { persistUploadedGarmentItems } from "@/lib/garments/persist-uploaded-garments";
import { deleteGarment } from "@/lib/garments/delete-garment";
import { POST, DELETE } from "@/app/api/closet/garments/route";

const admitted = vi.mocked(assertAdmittedSession);
const persistMock = vi.mocked(persistUploadedGarmentItems);
const deleteMock = vi.mocked(deleteGarment);

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

describe("POST /api/closet/garments", () => {
  beforeEach(() => {
    admitted.mockReset();
    persistMock.mockReset();
    deleteMock.mockReset();
  });

  const validItem = {
    mediaAssetId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    name: "Shirt",
    category: "tops",
  };

  it("returns 401 when not admitted", async () => {
    admitted.mockResolvedValue({
      ok: false,
      status: 401,
      message: "Sign in to continue.",
    });
    const res = await POST(
      new Request("http://localhost/api/closet/garments", {
        method: "POST",
        body: JSON.stringify({ items: [validItem] }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    admitted.mockResolvedValue(ownerGate);
    const res = await POST(
      new Request("http://localhost/api/closet/garments", {
        method: "POST",
        body: JSON.stringify({ items: "nope" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("calls persistUploadedGarmentItems and returns 200", async () => {
    admitted.mockResolvedValue(ownerGate);
    persistMock.mockResolvedValue({ ok: true });
    const res = await POST(
      new Request("http://localhost/api/closet/garments", {
        method: "POST",
        body: JSON.stringify({ items: [validItem] }),
      }),
    );
    expect(res.status).toBe(200);
    expect(persistMock).toHaveBeenCalledWith(
      "owner-1",
      expect.arrayContaining([
        expect.objectContaining({ mediaAssetId: validItem.mediaAssetId }),
      ]),
      ownerGate.membership,
    );
  });

  it("returns 422 when persist fails", async () => {
    admitted.mockResolvedValue(ownerGate);
    persistMock.mockResolvedValue({ ok: false, message: "bad" });
    const res = await POST(
      new Request("http://localhost/api/closet/garments", {
        method: "POST",
        body: JSON.stringify({ items: [validItem] }),
      }),
    );
    expect(res.status).toBe(422);
  });
});

describe("DELETE /api/closet/garments", () => {
  const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("returns 401 when not admitted", async () => {
    admitted.mockResolvedValue({
      ok: false,
      status: 401,
      message: "Sign in to continue.",
    });
    const res = await DELETE(
      new Request("http://localhost/api/closet/garments", {
        method: "DELETE",
        body: JSON.stringify({ id: gid }),
      }),
    );
    expect(res.status).toBe(401);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("returns 200 when deleteGarment succeeds", async () => {
    admitted.mockResolvedValue(ownerGate);
    deleteMock.mockResolvedValue({ ok: true });
    const res = await DELETE(
      new Request("http://localhost/api/closet/garments", {
        method: "DELETE",
        body: JSON.stringify({ id: gid }),
      }),
    );
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith(
      "owner-1",
      gid,
      expect.objectContaining({ userId: "owner-1" }),
    );
  });
});
