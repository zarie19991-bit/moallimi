import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'_site');
const manifestPath=path.join(root,'production-files.txt');

if(!fs.existsSync(manifestPath))throw new Error('Missing production-files.txt');
const files=fs.readFileSync(manifestPath,'utf8')
  .split(/\r?\n/)
  .map(x=>x.trim())
  .filter(x=>x&&!x.startsWith('#'));
const listed=new Set(files);
if(listed.size!==files.length)throw new Error('Duplicate entry in production-files.txt');

for(const file of files){
  if(file.includes('/')||file.includes('\\'))throw new Error(`Production file must be a root asset: ${file}`);
  const src=path.join(root,file);
  if(!fs.existsSync(src)||!fs.statSync(src).isFile())throw new Error(`Missing production file: ${file}`);
}

// Validate local HTML dependencies so a live page cannot silently reference an
// unlisted/obsolete root asset. Dynamic dependencies such as qr-vendor.js are
// listed explicitly in production-files.txt.
for(const file of files.filter(x=>x.endsWith('.html'))){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  const re=/(?:src|href)\s*=\s*["']([^"'#]+)["']/g;
  for(const match of html.matchAll(re)){
    let ref=match[1].trim();
    if(!ref||/^(?:https?:|data:|mailto:|tel:|javascript:)/i.test(ref))continue;
    ref=ref.split('?')[0].replace(/^\.\//,'');
    if(!ref||ref.endsWith('/'))continue;
    if(ref.startsWith('question-bank/assets/'))continue;
    if(!listed.has(ref))throw new Error(`${file} references unlisted production asset: ${ref}`);
  }
}

fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});
for(const file of files)fs.copyFileSync(path.join(root,file),path.join(out,file));

const assets=path.join(root,'question-bank','assets');
if(fs.existsSync(assets)){
  const dest=path.join(out,'question-bank','assets');
  fs.mkdirSync(dest,{recursive:true});
  for(const file of fs.readdirSync(assets)){
    if(!/^[a-f0-9]{64}\.png$/.test(file))throw new Error(`Unexpected public asset: ${file}`);
    fs.copyFileSync(path.join(assets,file),path.join(dest,file));
  }
}

for(const file of ['index.html','teacher.html','student-demo.html','demo-exam.html','create.html','analysis.html','student-papers.html','e.html','exam.html','simulation.html','question-media.js']){
  if(!fs.existsSync(path.join(out,file)))throw new Error(`Missing public page: ${file}`);
}
console.log(`Prepared ${files.length} canonical production files and reviewed diagrams.`);
