import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import TermsPage from "@/app/(main)/terms/page";

describe("TermsPage", () => {
  it("renders terms heading and back link", () => {
    render(<TermsPage />);

    expect(screen.getByTestId("terms-shell-marker")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Terms", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to app" })).toHaveAttribute(
      "href",
      "/closet",
    );
  });
});
