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
    const {
      fill: _fill,
      priority: _priority,
      ...rest
    } = props;
    void _fill;
    void _priority;
    return createElement("img", {
      ...rest,
      alt: (rest.alt as string) ?? "",
    });
  },
}));
