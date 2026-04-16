import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    replace: vi.fn(),
    push: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/image", () => ({
  default: function MockImage(props: Record<string, unknown>) {
    const { fill: _ignored, ...rest } = props;
    void _ignored;
    return createElement("img", {
      ...rest,
      alt: (rest.alt as string) ?? "",
    });
  },
}));
