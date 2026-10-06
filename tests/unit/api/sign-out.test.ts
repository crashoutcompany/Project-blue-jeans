import { describe, expect, it, vi } from "vitest";

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  auth: { api: { signOut } },
}));

import { GET, POST } from "@/app/auth/sign-out/route";

describe("/auth/sign-out", () => {
  it("refuses GET so a cross-site link cannot sign the user out", async () => {
    const res = GET();
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs out on POST and redirects to sign-in with the cleared cookie", async () => {
    signOut.mockResolvedValue(
      new Response(null, {
        headers: { "set-cookie": "better-auth.session_token=; Max-Age=0" },
      }),
    );

    const res = await POST(
      new Request("http://localhost:3000/auth/sign-out", { method: "POST" }),
    );

    expect(signOut).toHaveBeenCalledOnce();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3000/signin");
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
