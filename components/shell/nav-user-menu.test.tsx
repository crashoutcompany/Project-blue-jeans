import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const hoisted = vi.hoisted(() => ({
  useSession: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    useSession: hoisted.useSession,
  },
}));

import { NavUserMenu } from "@/components/shell/nav-user-menu";

describe("NavUserMenu", () => {
  it("shows Sign in when logged out", () => {
    hoisted.useSession.mockReturnValue({ data: null, isPending: false });
    render(<NavUserMenu />);
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows user menu when logged in", () => {
    hoisted.useSession.mockReturnValue({
      data: {
        user: { name: "Ada", email: "ada@example.com", image: null },
      },
      isPending: false,
    });
    render(<NavUserMenu />);
    expect(screen.getByText("Ada")).toBeInTheDocument();
  });

  it("shows skeleton while pending", () => {
    hoisted.useSession.mockReturnValue({ data: null, isPending: true });
    const { container } = render(<NavUserMenu />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
});
