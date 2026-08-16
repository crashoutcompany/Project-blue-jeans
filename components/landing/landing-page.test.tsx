import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false }),
  },
}));

import { LandingPage } from "@/components/landing/landing-page";

describe("LandingPage", () => {
  it("renders brand, CTA, and legal links", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("link", { name: "Project Blue Jeans" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Get started" }),
    ).toHaveAttribute("href", "/auth/sign-in");
    const signInLinks = screen.getAllByRole("link", { name: "Sign in" });
    expect(signInLinks.length).toBeGreaterThanOrEqual(1);
    expect(signInLinks[0]).toHaveAttribute("href", "/auth/sign-in");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
  });
});
