type Row = Record<string, any>;
const copy = <T>(x: T): T => structuredClone(x);
export const ids = {
  session: "11111111-1111-4111-8111-111111111111",
  student: "22222222-2222-4222-8222-222222222222",
  owner: "33333333-3333-4333-8333-333333333333",
  sheet: "44444444-4444-4444-8444-444444444444",
};
export function memoryDb(image: string, overrides: Row = {}) {
  const payload = {
    question_count: 4, question_start: 1,
    assignments: [{ student_id: ids.student, student_name: "طالب تجريبي", sheet_no: 1, model: "A" }],
    answer_keys: [{ model: "A", answers: Array.from({ length: 4 }, () => ({ correct_index: 0 })) }],
  };
  const current = {
    identity_valid: true, model: "A", student_name: "طالب تجريبي",
    omr_policy: "old-test-policy", score: 1, total: 4, markers_ok: true,
    answers: [{ selected: 0, marked: [0], status: "clear", state: "correct", reviewed_manually: true }],
  };
  const tables: Record<string, Row[]> = {
    nafes_paper_reviews: [{ id: "test-review-pk", review_id: "test-review", owner_id: ids.owner, subjects: ["reading"], payload }],
    nafes_scan_sessions: [{ id: ids.session, review_pk: "test-review-pk", review_snapshot: payload, expected_count: 1 }],
    nafes_scan_sheets: [{
      id: ids.sheet, session_id: ids.session, ordinal: 1, student_id: ids.student,
      sheet_no: 1, image_data: image, answer_version: 1,
      snapshot: copy(current), effective_snapshot: copy(current),
      reviewed_at: "2026-01-01T00:00:00Z", reviewed_by: ids.owner,
      disposition: "verified", blocked_duplicate: false, ...overrides,
    }],
    nafes_scan_alerts: [], nafes_assessment_attempts: [],
  };
  const writes: Row[] = [];
  class Query {
    filters: ((row: Row) => boolean)[] = [];
    patch: Row | null = null;
    cap = Infinity;
    constructor(public table: string) {
      if (!(table in tables)) throw new Error(`Unconfigured memory table: ${table}`);
    }
    select(_columns?: string) { return this; }
    eq(column: string, value: any) { this.filters.push(row => row[column] === value); return this; }
    contains(column: string, value: Row) {
      this.filters.push(row => Object.entries(value).every(([k, v]) => row[column]?.[k] === v)); return this;
    }
    not(column: string, op: string, value: any) {
      if (op !== "is") throw new Error(`Unsupported mock operator: ${op}`);
      this.filters.push(row => row[column] !== value); return this;
    }
    order(_column: string, _opts?: Row) { return this; }
    limit(n: number) { this.cap = n; return this; }
    range(_from: number, to: number) { this.cap = to + 1; return this; }
    update(patch: Row) { this.patch = copy(patch); return this; }
    execute(single = false) {
      const selected = tables[this.table].filter(row => this.filters.every(f => f(row))).slice(0, this.cap);
      if (this.patch) {
        writes.push({ table: this.table, patch: copy(this.patch), ids: selected.map(x => x.id) });
        for (const row of selected) Object.assign(row, copy(this.patch));
      }
      return { data: copy(single ? selected[0] || null : selected), error: null };
    }
    async maybeSingle() { return this.execute(true); }
    async single() { return this.execute(true); }
    then(resolve: any, reject: any) { return Promise.resolve(this.execute()).then(resolve, reject); }
  }
  const db = {
    from(table: string) { return new Query(table); },
    async rpc(name: string, args: Row) {
      writes.push({ rpc: name, args: copy(args) });
      if (name === "nafes_scan_register") return { data: args.p_sheet, error: null };
      if (name === "nafes_scan_assign_identity") return {
        data: { ...tables.nafes_scan_sheets[0], student_id: args.p_student, effective_snapshot: args.p_effective }, error: null,
      };
      throw new Error(`Unconfigured memory RPC: ${name}`);
    },
  };
  return {
    db, writes, tables, owner: { id: ids.owner, subject_scope: "all" },
    request: { review_id: "test-review", session_id: ids.session, reason:"synthetic explicit visual review" },
  };
}
