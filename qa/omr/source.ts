import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import manifest from "./source-manifest.json";

// Never import index.ts: it starts an Edge server and creates a Supabase client.
// All runtime network requests are denied, and tests supply their own memory DB.
globalThis.fetch = (async () => {
  throw new Error("OMR test isolation: network requests are forbidden.");
}) as typeof fetch;

const root = resolve(import.meta.dir, "../..");
const archive = join(root, manifest.archive);
const bytes = readFileSync(archive);
if (createHash("sha256").update(bytes).digest("hex") !== manifest.sha256) {
  throw new Error("Uploaded source checksum changed. Review provenance before running tests.");
}
const directory = mkdtempSync(join(tmpdir(), "nafes-omr-tests-"));
function unzip(args: string[]) {
  const r = spawnSync("unzip", args, { maxBuffer: 2_000_000 });
  if (r.status !== 0) throw new Error(`Cannot read uploaded source: ${r.stderr}`);
  return r.stdout;
}
const listed = unzip(["-Z1", archive]).toString().trim().split(/\r?\n/).sort();
if (JSON.stringify(listed) !== JSON.stringify([...manifest.members].sort())) {
  throw new Error("Archive membership differs from the audited seven-file snapshot.");
}
const sources: Record<string, string> = {};
for (const member of manifest.members) {
  // Fixed allowlisted members only, no untrusted archive paths or symlinks.
  const out = join(directory, member);
  mkdirSync(dirname(out), { recursive: true });
  sources[member] = unzip(["-p", archive, member]).toString();
  writeFileSync(out, sources[member]);
}
const dependencies: string[] = [];
for (const [member, text] of Object.entries(sources)) {
  for (const match of text.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)) {
    const specifier = match[1];
    if (specifier.startsWith(".")) {
      if (!existsSync(resolve(directory, dirname(member), specifier))) {
        throw new Error(`Missing local dependency: ${member} -> ${specifier}`);
      }
    } else dependencies.push(specifier);
  }
}
const require = createRequire(import.meta.url);
const built = await Bun.build({
  entrypoints: [
    join(directory, "source/omr-server.ts"),
    join(directory, "source/paper-scan.ts"),
  ],
  outdir: join(directory, "compiled"),
  target: "bun",
  format: "esm",
  plugins: [{
    name: "offline-deno-npm-mapping",
    setup(build) {
      build.onResolve({ filter: /^(npm:|jsr:|https?:)/ }, (args) => {
        if (args.path !== "npm:jpeg-js@0.4.4") {
          throw new Error(`External dependency prohibited in isolated OMR tests: ${args.path}`);
        }
        return { path: require.resolve("jpeg-js") };
      });
    },
  }],
});
if (!built.success) throw new Error(built.logs.join("\n"));
export const omr = await import(join(directory, "compiled/omr-server.js"));
export const scan = await import(join(directory, "compiled/paper-scan.js"));
const developmentDir=join(root,"qa/omr/development/source");
const devBuilt=await Bun.build({
  entrypoints:[join(developmentDir,"omr-server.ts"),join(developmentDir,"paper-scan.ts")],
  outdir:join(directory,"development"),target:"bun",format:"esm",
  plugins:[{
    name:"offline-development-npm-mapping",
    setup(build){
      build.onResolve({filter:/^(npm:|jsr:|https?:)/},args=>{
        if(args.path!=="npm:jpeg-js@0.4.4")throw new Error(`Forbidden dependency: ${args.path}`);
        return{path:require.resolve("jpeg-js")};
      });
    },
  }],
});
if(!devBuilt.success)throw new Error(devBuilt.logs.join("\n"));
export const developmentOmr=await import(join(directory,"development/omr-server.js"));
export const developmentScan=await import(join(directory,"development/paper-scan.js"));
export const auditedSource = { sources, dependencies, manifest };
process.on("exit", () => rmSync(directory, { recursive: true, force: true }));
