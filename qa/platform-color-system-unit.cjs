const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'platform-color-system.css'),'utf8');
const tk=fs.readFileSync(path.join(root,'tamakkun-design-system.css'),'utf8');
const teacher=fs.readFileSync(path.join(root,'teacher.html'),'utf8');
const analysis=fs.readFileSync(path.join(root,'analysis.html'),'utf8');
const manifest=fs.readFileSync(path.join(root,'production-files.txt'),'utf8');

function rgb(hex){hex=hex.replace('#','');return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255)}
function lin(c){return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)}
function lum(hex){const [r,g,b]=rgb(hex).map(lin);return .2126*r+.7152*g+.0722*b}
function contrast(a,b){const x=lum(a),y=lum(b),hi=Math.max(x,y),lo=Math.min(x,y);return (hi+.05)/(lo+.05)}
function expectAA(name,fg,bg,min=4.5){const ratio=contrast(fg,bg);assert.ok(ratio>=min,`${name}: contrast ${ratio.toFixed(2)} < ${min}`);return ratio}

const ratios={
  navyOnWhite:expectAA('navy on white','#16324F','#FFFFFF'),
  tealOnWhite:expectAA('teal on white','#0F766E','#FFFFFF'),
  mutedOnWhite:expectAA('muted on white','#64748B','#FFFFFF'),
  successOnWhite:expectAA('success on white','#15803D','#FFFFFF'),
  amberOnSoft:expectAA('amber on soft','#B45309','#FFFBEB'),
  dangerOnSoft:expectAA('danger on soft','#B42318','#FFF1F2'),
  darkText:expectAA('dark text','#E8EEF5','#0B1220'),
  darkMuted:expectAA('dark muted','#A8B3C3','#0B1220'),
  darkTeal:expectAA('dark teal','#2DD4BF','#0B1220'),
  darkBlue:expectAA('dark blue','#60A5FA','#0B1220'),
  darkAmber:expectAA('dark amber','#FBBF24','#0B1220')
};

assert.match(css,/prefers-color-scheme:dark/);
assert.match(css,/prefers-reduced-motion:reduce/);
assert.match(css,/outline:3px solid var\(--pv-focus\)/);
assert.match(css,/object-fit:contain!important/);
assert.match(css,/clip-path:none!important/);
assert.match(css,/aspect-ratio:auto!important/);
assert.match(css,/moallimi-logo-full/);
assert.match(tk,/--tk-brand-900:#[0-9a-f]{6}/);
assert.match(tk,/--tk-brand-700:#0f766e/);
assert.match(tk,/prefers-color-scheme:dark/);
assert.match(teacher,/moallimi-logo-final\.webp\?v=[^"']+/);
assert.match(analysis,/moallimi-logo-final\.webp\?v=[^"']+/);
assert.doesNotMatch(teacher,/moallimi-logo-ui\.png/);
assert.doesNotMatch(analysis,/moallimi-logo-ui\.png/);
assert.match(manifest,/platform-color-system\.css/);

console.log('PASS: color system AA contrast, dark mode, reduced motion and full-logo rendering.',ratios);
