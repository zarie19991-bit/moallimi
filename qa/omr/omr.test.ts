import { describe, test, expect } from "bun:test";
import { omr as originalOmr, scan as originalScan, developmentOmr, developmentScan, auditedSource } from "./source";
import { syntheticSheet, blue } from "./fixtures";
import { memoryDb } from "./memory-db";

const blank = syntheticSheet();
for(const [label,omr,scan] of [
  ["Unchanged uploaded source",originalOmr,originalScan],
  ["Isolated development source",developmentOmr,developmentScan],
] as const)describe(`${label}: isolated baseline`, () => {
  test("all seven local source files and their relative imports are present", () => {
    expect(Object.keys(auditedSource.sources)).toHaveLength(7);
    expect(auditedSource.dependencies).toContain("npm:jpeg-js@0.4.4");
    expect(auditedSource.dependencies).toContain("npm:@supabase/supabase-js@2.95.0");
  });
  test("network calls are denied", async () => {
    await expect(fetch("https://example.invalid")).rejects.toThrow("network requests are forbidden");
  });
  for (const [status, selected, marked, key, state] of [
    ["clear", 0, [0], 0, "correct"],
    ["clear", 1, [1], 0, "incorrect"],
    ["blank", null, [], 0, "blank"],
    ["multiple", 0, [0, 1], 0, "multiple"],
    ["ambiguous", 0, [0], 0, "uncertain"],
    ["clear", 0, [0], null, "uncertain"],
    ["clear", 9, [], 0, "uncertain"],
  ]) {
    test(`classification ${status}/${selected}/${key} -> ${state}`, () => {
      expect(scan.classifyAnswer({ status, selected, marked }, { correct_index: key }, 0).state).toBe(state);
    });
  }
  test("PNG is explicitly rejected, not silently decoded as JPEG", () => {
    expect(() => omr.readOmrJpeg("data:image/png;base64,AA==", 4)).toThrow("JPEG");
  });
  test("malformed JPEG fails explicitly", () => {
    expect(() => omr.readOmrJpeg("data:image/jpeg;base64,AA==", 4)).toThrow();
  });
  test("image without template markers is rejected", () => {
    expect(() => omr.readOmrJpeg(syntheticSheet({ markers: false }), 4)).toThrow("علامات");
  });
  test("blank synthetic page has 60 blank answers", () => {
    const r = omr.readOmrJpeg(blank, 60);
    expect(r.answers).toHaveLength(60);
    expect(r.answers.every((a: any) => a.status === "blank" && a.selected === null)).toBe(true);
  });
  test("black fills: all four option indices", () => {
    const r = omr.readOmrJpeg(syntheticSheet({ marks: [0, 1, 2, 3].map(i => ({ row: i, option: i })) }), 4);
    expect(r.answers.map((a: any) => [a.status, a.selected])).toEqual([0, 1, 2, 3].map(i => ["clear", i]));
  });
  test("blue fills: all four option indices", () => {
    const r = omr.readOmrJpeg(syntheticSheet({ marks: [0, 1, 2, 3].map(i => ({ row: i, option: i, color: blue })) }), 4);
    expect(r.answers.map((a: any) => [a.status, a.selected])).toEqual([0, 1, 2, 3].map(i => ["clear", i]));
  });
  for (const color of [[25, 25, 25], blue] as [number, number, number][]) {
    test(`two same-color fills are multiple (${color.join(",")})`, () => {
      const r = omr.readOmrJpeg(syntheticSheet({ marks: [0, 2].map(option => ({ row: 0, option, color })) }), 1);
      expect(r.answers[0].status).toBe("multiple");
      expect([...r.answers[0].marked].sort()).toEqual([0, 2]);
    });
  }
  test("question numbering and second 15-row block", () => {
    const r = omr.readOmrJpeg(syntheticSheet({ marks: [{ row: 15, option: 3 }] }), 16, 21);
    expect(r.answers[15].question).toBe(36);
    expect(r.answers[15].selected).toBe(3);
  });
  test("61 questions fail rather than silently truncating", () => {
    expect(() => omr.readOmrJpeg(blank, 61)).toThrow("عدد أسئلة");
  });
  test("270-degree landscape orientation is handled", () => {
    const r = omr.readOmrJpeg(syntheticSheet({ rotation: 270, marks: [{ row: 0, option: 0 }] }), 1);
    expect(r.answers[0].selected).toBe(0);
  });
  test("registration ignores forged browser answers and uses JPEG pixels", async () => {
    const m = memoryDb(blank);
    const r = await scan.handlePaperScan(m.db, {
      ...m.request, action: "teacher_scan_register",
      sheet: { ordinal: 1, sheet_no: 1, model: "A", qr_valid: true, image_data: blank,
        answers: Array.from({ length: 4 }, () => ({ selected: 0, status: "clear" })) },
    }, m.owner);
    expect(r.sheet.snapshot.score).toBe(0);
    expect(r.sheet.snapshot.counts.blank).toBe(4);
    expect(m.writes[0].rpc).toBe("nafes_scan_register");
  });
  test("quality report performs no memory DB writes", async () => {
    const m = memoryDb(blank);
    await scan.handlePaperScan(m.db, { ...m.request, action: "teacher_scan_quality_report" }, m.owner);
    expect(m.writes).toHaveLength(0);
  });
});
