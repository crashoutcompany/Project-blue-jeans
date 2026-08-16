import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ErrorRecovery } from "@/components/error-recovery";

describe("ErrorRecovery", () => {
  it("stays on the page and retries without exposing the error", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    const error = new Error("db exploded");
    render(<ErrorRecovery error={error} reset={reset} />);

    expect(screen.getByText("Could not load this page.")).toBeInTheDocument();
    expect(screen.queryByText("db exploded")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
