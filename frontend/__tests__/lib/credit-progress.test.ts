import { describe, expect, it } from "vitest";

import { getCreditProgressPercent } from "@/lib/credit-progress";

describe("getCreditProgressPercent", () => {
  it("returns 100 when earned credits meet required credits", () => {
    expect(getCreditProgressPercent(1, 1)).toBe(100);
  });

  it("caps progress at 100 when earned credits exceed required credits", () => {
    expect(getCreditProgressPercent(5, 4)).toBe(100);
  });

  it("returns 0 when required credits are unavailable", () => {
    expect(getCreditProgressPercent(3, 0)).toBe(0);
  });
});
