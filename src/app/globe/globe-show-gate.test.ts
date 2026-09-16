import { describe, expect, it } from "vitest";

import { createShowAt, GLOBE_DEFAULTS } from "./globe-renderer";

describe("Show gate", () => {
  it("falls back to the plain value with no keyframes", () => {
    expect(createShowAt({ ...GLOBE_DEFAULTS, txShow: 1 }, [])(4)).toBe(true);
    expect(createShowAt({ ...GLOBE_DEFAULTS, txShow: 0 }, [])(4)).toBe(false);
  });

  it("steps on the keyframes, so a transaction that started while on keeps running after off", () => {
    const showAt = createShowAt(GLOBE_DEFAULTS, [
      { timeSeconds: 0, value: 1 },
      { timeSeconds: 6, value: 0 },
    ]);
    expect(showAt(3.5)).toBe(true);
    expect(showAt(5.6)).toBe(true);
    expect(showAt(6)).toBe(false);
    expect(showAt(9)).toBe(false);
  });
});
