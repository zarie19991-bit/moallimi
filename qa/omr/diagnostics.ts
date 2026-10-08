import { omr, scan } from "./source";
import { syntheticSheet, blue } from "./fixtures";
import { memoryDb } from "./memory-db";

const mixed = omr.readOmrJpeg(syntheticSheet({
  marks: [{ row: 0, option: 0 }, { row: 0, option: 2, color: blue }],
}), 1);
const result: Record<string, any> = {
  mixed_ink: {
    expected: { status: "multiple", marked: [0, 2] },
    actual: mixed.answers[0],
    verification: mixed.verification,
  },
};
function compact(row: any) {
  return {
    answer_version: row.answer_version,
    score: row.effective_snapshot.score,
    answers: row.effective_snapshot.answers,
    reviewed_at: row.reviewed_at,
    reviewed_by: row.reviewed_by,
    disposition: row.disposition,
  };
}
for (const action of ["teacher_scan_list", "teacher_scan_alerts"]) {
  const m = memoryDb(syntheticSheet());
  const before = compact(structuredClone(m.tables.nafes_scan_sheets[0]));
  await scan.handlePaperScan(m.db, { ...m.request, action }, m.owner);
  result[action] = {
    before, after: compact(m.tables.nafes_scan_sheets[0]),
    write_operations: m.writes.length,
    writes_to_attempts: m.writes.filter(x => x.table === "nafes_assessment_attempts").length,
  };
}
console.log(JSON.stringify(result, null, 2));
