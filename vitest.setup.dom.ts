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
      unoptimized,
      ...rest
    } = props;
    void _fill;
    void _priority;
    return createElement("img", {
      ...rest,
      alt: (rest.alt as string) ?? "",
      // Surfaced as an attribute so tests can assert that private
      // /api/media/{id} sources bypass the Next image optimizer.
      "data-unoptimized": unoptimized ? "true" : "false",
    });
  },
}));
