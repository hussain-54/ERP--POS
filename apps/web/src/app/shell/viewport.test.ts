import { describe, expect, it } from "vitest";
import { readViewportMode, VIEWPORT_MOBILE_QUERY, VIEWPORT_TABLET_QUERY } from "./viewport";

function matchMediaFor(mode: "mobile" | "tablet" | "desktop") {
  return (query: string) => ({
    matches:
      mode === "mobile"
        ? query === VIEWPORT_MOBILE_QUERY
        : mode === "tablet"
          ? query === VIEWPORT_TABLET_QUERY
          : false,
  });
}

describe("readViewportMode", () => {
  it("maps mobile, tablet, and desktop breakpoints", () => {
    expect(readViewportMode(matchMediaFor("mobile"))).toBe("mobile");
    expect(readViewportMode(matchMediaFor("tablet"))).toBe("tablet");
    expect(readViewportMode(matchMediaFor("desktop"))).toBe("desktop");
  });
});
