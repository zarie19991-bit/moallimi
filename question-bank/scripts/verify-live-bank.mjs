import fs from 'node:fs';
import vm from 'node:vm';

const EDGE = 'https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-exam';
const MODEL_COUNT = 4;
const QUESTION_COUNT = 15;
const CONCURRENCY = 12;

const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['nafes-reading.js', 'nafes-math.js', 'nafes-science.js']) {
  vm.runInContext(fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'), sandbox, { filename: file });
}

const jobs = [];
for (const subject of [sandbox.window.NAFES_READING, sandbox.window.NAFES_MATH, sandbox.window.NAFES_SCIENCE]) {
  for (const outcome of subject.outcomes) {
    outcome.indicators.forEach((indicatorText, index) => {
      for (let model = 1; model <= MODEL_COUNT; model++) {
        jobs.push({
          subject: subject.key,
          outcome: outcome.code,
          indicator: index + 1,
          model,
          indicator_text: indicatorText,
          outcome_title: outcome.title,
        });
      }
    });
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function verify(job) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(EDGE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'preview', ...job }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(`${response.status}: ${body.error || JSON.stringify(body)}`);
      if (body.ready !== true || body.engine !== 'reviewed_question_bank') throw new Error(`wrong engine/readiness: ${JSON.stringify(body)}`);
      if (body.model_count !== MODEL_COUNT) throw new Error(`model count ${body.model_count}`);
      if (body.bank?.approved_count !== QUESTION_COUNT || body.bank?.required_count !== QUESTION_COUNT) throw new Error(`bank count ${JSON.stringify(body.bank)}`);
      if (Array.isArray(body.bank?.issues) && body.bank.issues.length) throw new Error(`bank issues ${body.bank.issues.join(',')}`);
      if ((body.settings?.question_count || 0) !== QUESTION_COUNT) throw new Error(`settings count ${body.settings?.question_count}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(attempt * 350);
    }
  }
  throw new Error(`${job.subject}/${job.outcome}/i${job.indicator}/m${job.model}: ${lastError?.message || lastError}`);
}

const failures = [];
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    try {
      await verify(job);
    } catch (error) {
      failures.push(error.message);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

if (failures.length) {
  console.error(failures.slice(0, 100).join('\n'));
  console.error(`failures=${failures.length}`);
  process.exit(1);
}

console.log(JSON.stringify({
  indicators: jobs.length / MODEL_COUNT,
  models_per_indicator: MODEL_COUNT,
  verified_live_models: jobs.length,
  questions_per_model: QUESTION_COUNT,
  engine: 'reviewed_question_bank',
}));
