import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: vi.fn(),
  },
}));

vi.mock("@/lib/garments/persist-uploaded-garments", () => ({
  persistUploadedGarmentItems: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import { persistUploadedGarmentItems } from "@/lib/garments/persist-uploaded-garments";
import { POST } from "@/app/api/closet/garments/route";

const getSession = vi.mocked(auth.getSession);
const persistMock = vi.mocked(persistUploadedGarmentItems);

describe("POST /api/closet/garments", () => {
  beforeEach(() => {
    getSession.mockReset();
    persistMock.mockReset();
  });

  const validItem = {
    url: "https://x.com/a.jpg",
    key: "k1",
    name: "Shirt",
    category: "tops",
  };

  it("returns 401 when not signed in", async () => {
    getSession.mockResolvedValue({ data: null });
    const res = await POST(
      new Request("http://localhost/api/closet/garments", {
        method: "POST",
        body: JSON.stringify({ items: [validItem] }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "u@x.com", role: "user" } },
    });
    const res = await POST(
      new Request("http://localhost/api/closet/garments", {
        method: "POST",
        body: JSON.stringify({ items: [validItem] }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "a@x.com", role: "admin" } },
    });
    const res = await POST(
      new Request("http://localhost/api/closet/garments", {
        method: "POST",
        body: JSON.stringify({ items: "nope" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("calls persistUploadedGarmentItems and returns 200", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "a@x.com", role: "admin" } },
    });
    persistMock.mockResolvedValue({ ok: true });
    const res = await POST(
      new Request("http://localhost/api/closet/garments", {
        method: "POST",
        body: JSON.stringify({ items: [validItem] }),
      }),
    );
    expect(res.status).toBe(200);
    expect(persistMock).toHaveBeenCalled();
  });

  it("returns 422 when persist fails", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "a@x.com", role: "admin" } },
    });
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
