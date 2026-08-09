import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

const hoisted = vi.hoisted(() => ({
  replace: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: hoisted.replace,
    refresh: vi.fn(),
    push: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    getSession: hoisted.getSession,
  },
}));

import { RedirectWhenSignedIn } from "@/components/auth/redirect-when-signed-in";

describe("RedirectWhenSignedIn", () => {
  it("does nothing when path is not sign-in/up", () => {
    hoisted.getSession.mockResolvedValue({ data: { session: {} } });
    render(<RedirectWhenSignedIn path="forgot" />);
    return waitFor(() => {
      expect(hoisted.replace).not.toHaveBeenCalled();
    });
  });

  it("redirects to Today when session exists on sign-in", async () => {
    hoisted.getSession.mockResolvedValue({ data: { session: { id: "s" } } });
    render(<RedirectWhenSignedIn path="sign-in" />);
    await waitFor(() => {
      expect(hoisted.replace).toHaveBeenCalledWith("/");
    });
  });
});
