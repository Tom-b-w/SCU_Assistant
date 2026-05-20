import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("Topbar search layering", () => {
  it("gives the header an explicit stacking order so search suggestions can render above page content", () => {
    const filePath = fileURLToPath(
      new URL("../../../src/components/layout/topbar.tsx", import.meta.url)
    );
    const source = readFileSync(filePath, "utf8");

    expect(source).toContain(
      '<header className="relative z-30'
    );
    expect(source).toContain(
      'className="absolute left-0 right-0 top-12 z-50'
    );
  });
});
