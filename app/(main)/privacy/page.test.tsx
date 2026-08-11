import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import PrivacyPage from "@/app/(main)/privacy/page";

describe("PrivacyPage", () => {
  it("renders privacy heading and back link", () => {
    render(<PrivacyPage />);

    expect(screen.getByTestId("privacy-shell-marker")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Privacy", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to app" })).toHaveAttribute(
      "href",
      "/closet",
    );
  });
});
