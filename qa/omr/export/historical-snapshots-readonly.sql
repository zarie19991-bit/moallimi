-- READ ONLY: run only in the existing Supabase SQL editor, never via an Edge action.
-- Replace the six placeholders THERE with the corresponding row IDs.
-- Page numbers must match pages 1..6 of the anonymized PDF.
-- Do not upload the filled-in SQL: upload only the resulting anonymous JSON.
-- No names, student IDs, row IDs, scores, correct-answer keys, or images are exported.
WITH chosen(qa_page, sheet_id) AS (
  VALUES
    (1, 'REPLACE_WITH_ROW_ID_FOR_PDF_PAGE_1'),
    (2, 'REPLACE_WITH_ROW_ID_FOR_PDF_PAGE_2'),
    (3, 'REPLACE_WITH_ROW_ID_FOR_PDF_PAGE_3'),
    (4, 'REPLACE_WITH_ROW_ID_FOR_PDF_PAGE_4'),
    (5, 'REPLACE_WITH_ROW_ID_FOR_PDF_PAGE_5'),
    (6, 'REPLACE_WITH_ROW_ID_FOR_PDF_PAGE_6')
),
selected_sheets AS (
  SELECT c.qa_page, s.answer_version,
         s.snapshot::jsonb AS original_snapshot,
         s.effective_snapshot::jsonb AS effective_snapshot
  FROM chosen c
  JOIN public.nafes_scan_sheets s ON s.id = c.sheet_id::uuid
),
safe AS (
  SELECT r.qa_page, r.answer_version, v.snapshot_kind,
    CASE WHEN v.doc IS NULL THEN NULL ELSE jsonb_build_object(
      'omr_policy', v.doc->'omr_policy',
      'model', v.doc->'model',
      'identity_valid', v.doc->'identity_valid',
      'markers_ok', v.doc->'markers_ok',
      'marker_confidence', v.doc->'marker_confidence',
      'total', v.doc->'total',
      'reader_error_present', COALESCE(length(v.doc->>'omr_reader_error') > 0, false),
      'answers', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'question', a->'question',
          'selected', a->'selected',
          'marked', a->'marked',
          'status', CASE WHEN a->>'status' IN
            ('clear','blank','multiple','ambiguous','uncertain')
            THEN a->>'status' ELSE 'missing_or_unrecognized' END,
          -- Hide grade outcomes while preserving scan failure categories.
          'state', CASE WHEN a->>'state' IN ('blank','multiple','uncertain')
            THEN a->>'state'
            WHEN a->>'state' IN ('correct','incorrect') THEN 'resolved'
            ELSE 'missing_or_unrecognized' END,
          'confidence', a->'confidence',
          'reader', a->'reader',
          'reviewed_manually', a->'reviewed_manually',
          -- No correct answer is exported; only whether a valid key existed.
          'key_present', CASE WHEN jsonb_typeof(a->'correct_index') = 'number'
            THEN (a->>'correct_index')::numeric BETWEEN 0 AND 3
              AND trunc((a->>'correct_index')::numeric) = (a->>'correct_index')::numeric
            ELSE false END
        ) ORDER BY answer_ordinal)
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(v.doc->'answers') = 'array'
            THEN v.doc->'answers' ELSE '[]'::jsonb END
        ) WITH ORDINALITY AS answers(a, answer_ordinal)
      ), '[]'::jsonb)
    ) END AS payload
  FROM selected_sheets r
  CROSS JOIN LATERAL (
    VALUES ('snapshot', r.original_snapshot),
           ('effective_snapshot', r.effective_snapshot)
  ) AS v(snapshot_kind, doc)
)
SELECT jsonb_agg(jsonb_build_object(
  'qa_page', qa_page,
  'answer_version', answer_version,
  'snapshot_kind', snapshot_kind,
  'payload', payload
) ORDER BY qa_page, snapshot_kind) AS omr_qa_export
FROM safe;
