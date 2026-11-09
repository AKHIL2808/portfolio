import { expect, it } from "vitest";

// Deliberately failing: proves a red CI check stops the merge (F.1/W.05). Never merged.
it("fails on purpose", () => {
  expect(1).toBe(2);
});
