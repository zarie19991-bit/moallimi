import { test, expect } from "bun:test";
import { developmentOmr as omr, developmentScan as scan } from "./source";
import { syntheticSheet, blue } from "./fixtures";
import { memoryDb } from "./memory-db";

// The same safety assertions that failed on the original now target development.
// Original behavior is retained in the before/after comparison, never overwritten.
test("REGRESSION: a black and a blue marked bubble must not become one clear answer", () => {
  const r = omr.readOmrJpeg(syntheticSheet({
    marks: [{ row: 0, option: 0 }, { row: 0, option: 2, color: blue }],
  }), 1);
  expect(r.answers[0].status).toBe("multiple");
  expect([...r.answers[0].marked].sort()).toEqual([0, 2]);
});
for (const rotation of [90, 180] as const) {
  test(`REGRESSION: valid sheet rotated ${rotation} degrees retains its answer`, () => {
    const r = omr.readOmrJpeg(syntheticSheet({ rotation, marks: [{ row: 0, option: 0 }] }), 1);
    expect(r.answers[0].status).toBe("clear");
    expect(r.answers[0].selected).toBe(0);
  });
}
for (const action of ["teacher_scan_list", "teacher_scan_alerts"]) {
  test(`REGRESSION: ${action} must not overwrite manually reviewed snapshots`, async () => {
    const m = memoryDb(syntheticSheet());
    const before = structuredClone(m.tables.nafes_scan_sheets[0]);
    await scan.handlePaperScan(m.db, { ...m.request, action }, m.owner);
    expect(m.writes).toHaveLength(0);
    expect(m.tables.nafes_scan_sheets[0]).toEqual(before);
  });
}
