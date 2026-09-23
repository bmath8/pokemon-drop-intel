import { describe, expect, it } from "vitest";

import type { ProductRecord } from "./dashboard-data";
import { normalizeProductSignal } from "./sku-normalizer";

function product(overrides: Partial<ProductRecord> & Pick<ProductRecord, "id" | "title">): ProductRecord {
  return {
    aliases: [],
    release: "",
    msrp: "$49.99",
    channels: ["Pokemon Center"],
    status: "Upcoming",
    launchLinks: [],
    ...overrides,
  };
}

const registry: ProductRecord[] = [
  product({
    id: "prismatic-etb",
    title: "Prismatic Evolutions Elite Trainer Box",
    aliases: ["Prismatic ETB"],
    release: "January 17, 2025",
  }),
  product({
    id: "surging-sparks-bb",
    title: "Surging Sparks Booster Bundle",
    aliases: ["Surging Sparks Bundle"],
  }),
];

describe("normalizeProductSignal", () => {
  it("scores an exact title match highest and returns it as the primary match", () => {
    const result = normalizeProductSignal(
      "Restock: Prismatic Evolutions Elite Trainer Box is live!",
      registry,
    );

    expect(result.primaryMatch?.productId).toBe("prismatic-etb");
    // exact title (100) + partial-token hits from the alias ("prismatic")
    expect(result.primaryMatch?.score).toBeGreaterThanOrEqual(100);
    expect(result.primaryMatch?.matchedTerms).toContain("prismatic evolutions elite trainer box");
  });

  it("matches on an alias and ignores punctuation/case", () => {
    const result = normalizeProductSignal("PRISMATIC-ETB drop tonight", registry);

    expect(result.primaryMatch?.productId).toBe("prismatic-etb");
  });

  it("does not count generic words like 'elite', 'trainer', 'box' as evidence", () => {
    const result = normalizeProductSignal("New elite trainer box bundle announced", registry);

    expect(result.candidates).toEqual([]);
    expect(result.primaryMatch).toBeNull();
  });

  it("adds a release-date bonus when the release hint appears", () => {
    const withoutDate = normalizeProductSignal("Prismatic Evolutions restock", registry);
    const withDate = normalizeProductSignal(
      "Prismatic Evolutions restock January 17, 2025",
      registry,
    );

    expect(withDate.candidates[0].score - withoutDate.candidates[0].score).toBe(12);
  });

  it("keeps weak single-token matches as candidates but not as the primary match", () => {
    // One non-generic token hit ("sparks") = 14 points, below the 22-point primary threshold.
    const result = normalizeProductSignal("sparks", [
      product({ id: "only-title", title: "Surging Sparks Tin" }),
    ]);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].score).toBe(14);
    expect(result.primaryMatch).toBeNull(); // below the 22-point threshold
  });

  it("sorts candidates by score and returns at most four", () => {
    const many = Array.from({ length: 6 }, (_, index) =>
      product({ id: `p${index}`, title: `Surging Sparks Item${index}` }),
    );

    const result = normalizeProductSignal("Surging Sparks Item3 restock", many);

    expect(result.candidates).toHaveLength(4);
    expect(result.candidates[0].productId).toBe("p3");
    const scores = result.candidates.map((candidate) => candidate.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});
