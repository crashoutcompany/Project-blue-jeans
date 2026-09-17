import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  GeneratorIncludeAvoidPicker,
  type ConstraintMap,
} from "@/components/outfit/generator-include-avoid";

const garments = ["t1", "t2", "t3", "t4"].map((id) => ({
  id,
  name: id,
  category: "tops" as const,
  imageUrl: null,
}));

function Harness({
  omitted,
  initial,
}: {
  omitted: string[];
  initial: ConstraintMap;
}) {
  const [marks, setMarks] = useState<ConstraintMap>(initial);
  return (
    <GeneratorIncludeAvoidPicker
      closetGarments={garments}
      omittedIds={new Set(omitted)}
      marks={marks}
      onChange={setMarks}
      pending={false}
    />
  );
}

describe("GeneratorIncludeAvoidPicker", () => {
  afterEach(() => {
    cleanup();
  });
  it("does not count omitted Include marks toward the cap", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        omitted={["t1"]}
        initial={{ t1: "include", t2: "include", t3: "include" }}
      />,
    );

    expect(screen.queryByText(/include is full/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /include t4/i }));
    expect(screen.getByRole("button", { name: /include t4/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("disables Include when three visible pieces are already pinned", () => {
    render(
      <Harness
        omitted={[]}
        initial={{ t1: "include", t2: "include", t3: "include" }}
      />,
    );

    expect(screen.getByText(/include is full/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /include t4/i })).toBeDisabled();
  });
});
