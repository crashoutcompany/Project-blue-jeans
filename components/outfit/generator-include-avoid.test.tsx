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

const mixedGarments = [
  ...garments,
  { id: "b1", name: "Jean", category: "bottoms" as const, imageUrl: null },
  { id: "s1", name: "Boot", category: "shoes" as const, imageUrl: null },
];

async function expandSection(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  const header = screen.getByRole("button", { name, expanded: false });
  await user.click(header);
}

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

  it("starts every category collapsed, with no previews until a piece is marked", () => {
    render(<Harness omitted={[]} initial={{}} />);

    for (const name of ["Tops"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    }
    expect(
      screen.queryByRole("button", { name: /include t1/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/included t1/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ignored t1/i)).not.toBeInTheDocument();
  });

  it("expands to the picker and collapses again", async () => {
    const user = userEvent.setup();
    render(<Harness omitted={[]} initial={{}} />);

    await expandSection(user, "Tops");
    expect(screen.getByRole("button", { name: "Tops" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: /include t1/i })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Tops" }));
    expect(screen.getByRole("button", { name: "Tops" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(
      screen.queryByRole("button", { name: /include t1/i }),
    ).not.toBeInTheDocument();
  });

  it("previews marked garments after collapse and clears them", async () => {
    const user = userEvent.setup();
    function MixedHarness() {
      const [marks, setMarks] = useState<ConstraintMap>({});
      return (
        <GeneratorIncludeAvoidPicker
          closetGarments={mixedGarments}
          omittedIds={new Set()}
          marks={marks}
          onChange={setMarks}
          pending={false}
        />
      );
    }
    render(<MixedHarness />);

    await expandSection(user, "Tops");
    await user.click(screen.getByRole("button", { name: /include t1/i }));
    await user.click(screen.getByRole("button", { name: /avoid t2/i }));
    await user.click(screen.getByRole("button", { name: "Tops" }));

    expect(screen.getByText("Included t1")).toBeInTheDocument();
    expect(screen.getByText("Ignored t2")).toBeInTheDocument();
    expect(screen.queryByText(/included t3/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Bottoms selections")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Shoes selections")).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Clear" })[0]!);
    expect(screen.queryByText("Included t1")).not.toBeInTheDocument();
    expect(screen.queryByText("Ignored t2")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tops" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("previews only a few marked garments, not the whole row", () => {
    const many = ["a", "b", "c", "d", "e", "f"].map((id) => ({
      id,
      name: id,
      category: "tops" as const,
      imageUrl: null,
    }));
    const marks = Object.fromEntries(
      many.map((g) => [g.id, "include" as const]),
    );
    render(
      <GeneratorIncludeAvoidPicker
        closetGarments={many}
        omittedIds={new Set()}
        marks={marks}
        onChange={() => {}}
        pending={false}
      />,
    );

    for (const name of ["a", "b", "c", "d"]) {
      expect(screen.getByText(`Included ${name}`)).toBeInTheDocument();
    }
    expect(screen.queryByText("Included e")).not.toBeInTheDocument();
    expect(screen.queryByText("Included f")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
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
    await expandSection(user, "Tops");
    await user.click(screen.getByRole("button", { name: /include t4/i }));
    expect(screen.getByRole("button", { name: /include t4/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("disables Include when three visible pieces are already pinned", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        omitted={[]}
        initial={{ t1: "include", t2: "include", t3: "include" }}
      />,
    );

    expect(screen.getByText(/include is full/i)).toBeInTheDocument();
    expect(screen.getByText("Included t1")).toBeInTheDocument();
    await expandSection(user, "Tops");
    expect(screen.getByRole("button", { name: /include t4/i })).toBeDisabled();
  });
});
