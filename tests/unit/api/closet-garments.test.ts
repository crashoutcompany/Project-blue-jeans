import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: vi.fn(),
  },
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

import { auth } from "@/lib/auth/server";
import { persistUploadedGarmentItems } from "@/lib/garments/persist-uploaded-garments";
import { deleteGarment } from "@/lib/garments/delete-garment";
import { POST, DELETE } from "@/app/api/closet/garments/route";

const getSession = vi.mocked(auth.getSession);
const persistMock = vi.mocked(persistUploadedGarmentItems);
const deleteMock = vi.mocked(deleteGarment);

describe("POST /api/closet/garments", () => {
  beforeEach(() => {
    getSession.mockReset();
    persistMock.mockReset();
    deleteMock.mockReset();
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
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
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
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    persistMock.mockResolvedValue({ ok: true });
    const res = await POST(
      new Request("http://localhost/api/closet/garments", {
        method: "POST",
        body: JSON.stringify({ items: [validItem] }),
      }),
    );
    expect(res.status).toBe(200);
    expect(persistMock).toHaveBeenCalledWith(
      "u1",
      expect.arrayContaining([expect.objectContaining({ key: "k1" })]),
    );
  });

  it("returns 422 when persist fails", async () => {
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
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

describe("DELETE /api/closet/garments", () => {
  const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("returns 401 when not signed in", async () => {
    getSession.mockResolvedValue({ data: null });
    const res = await DELETE(
      new Request("http://localhost/api/closet/garments", {
        method: "DELETE",
        body: JSON.stringify({ id: gid }),
      }),
    );
    expect(res.status).toBe(401);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("returns 403 when not admin", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "u@x.com", role: "user" } },
    });
    const res = await DELETE(
      new Request("http://localhost/api/closet/garments", {
        method: "DELETE",
        body: JSON.stringify({ id: gid }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body", async () => {
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    const res = await DELETE(
      new Request("http://localhost/api/closet/garments", {
        method: "DELETE",
        body: JSON.stringify({ id: "" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("returns 200 when deleteGarment succeeds", async () => {
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    deleteMock.mockResolvedValue({ ok: true });
    const res = await DELETE(
      new Request("http://localhost/api/closet/garments", {
        method: "DELETE",
        body: JSON.stringify({ id: gid }),
      }),
    );
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith("u1", gid);
  });

  it("returns 404 when the garment is missing", async () => {
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    deleteMock.mockResolvedValue({
      ok: false,
      message: "Garment not found.",
    });
    const res = await DELETE(
      new Request("http://localhost/api/closet/garments", {
        method: "DELETE",
        body: JSON.stringify({ id: gid }),
      }),
    );
    expect(res.status).toBe(404);
  });
});
