import fs from 'node:fs';
import path from 'node:path';
// Only application resources and diagrams are public website assets.
const root=process.cwd(),out=path.join(root,'_site');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const file of fs.readdirSync(root)){
  if(/\.(html|css|js)$/.test(file)&&fs.statSync(path.join(root,file)).isFile())fs.copyFileSync(path.join(root,file),path.join(out,file));
}
const assets=path.join(root,'question-bank','assets');
if(fs.existsSync(assets)){
  const dest=path.join(out,'question-bank','assets');fs.mkdirSync(dest,{recursive:true});
  for(const file of fs.readdirSync(assets)){
    if(!/^[a-f0-9]{64}\.png$/.test(file))throw new Error(`Unexpected public asset: ${file}`);
    fs.copyFileSync(path.join(assets,file),path.join(dest,file));
  }
}
for(const file of ['index.html','exam.html','simulation.html','question-media.js'])if(!fs.existsSync(path.join(out,file)))throw new Error(`Missing public page: ${file}`);
console.log('Prepared application pages and reviewed diagrams.');
