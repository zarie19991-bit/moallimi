# Offline eight-sheet OMR test (Windows)

**Safe scope:** This runs only the read-only `readOmrJpeg` function from the development branch. It does not use Supabase, publish tests, calculate grades, read student identities, or upload photos. No Replit billing.

1. Download the branch source ZIP from `https://github.com/zarie19991-bit/moallimi/tree/fix/omr-no-zero-on-read-failure` using Code → Download ZIP. Extract.
2. Install the **free** Deno runtime once: open Windows Terminal and run `winget install DenoLand.Deno` (see official Deno documentation). Reopen Explorer/Terminal afterward.
3. On your computer select exactly the **eight original .jpg images** and drag all eight onto `run-eight-local.cmd` at the extracted repository root (not onto Replit or GitHub). The JPEG decoder may be downloaded from npm on first use.
4. The program creates local `omr-eight-result.csv` (**480 question rows**) and `omr-eight-result.json`. Open the CSV and compare each of the 480 selected letters with its image. Share the anonymized CSV in ChatGPT to compare it with the eight images already attached to this conversation.
5. **Never use a numeric grade from this tool:** this is a reading-only diagnostic, not an answer-key validation or authority to publish students' results.

If a photo fails geometric verification, all 60 answer cells are marked `reader_failed`, with no score. The diagnostic report never includes student names or files' original filenames.

**Release gate:** this local test is *not* the independent real-ground-truth acceptance test or proof of the ≥99% threshold. Keep the production grader unchanged pending independent review.
