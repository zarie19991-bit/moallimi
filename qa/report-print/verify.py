"""Validate actual Chromium PDF pagination, not just CSS declarations."""
import json,re,sys
from pathlib import Path
import fitz
folder=Path(sys.argv[1]);baseline='--baseline' in sys.argv
results=[]
for name in ['general','subject','official','absentees','remedial']:
 doc=fitz.open(folder/f'{name}.pdf');meta=json.loads((folder/f'{name}.json').read_text());texts=[p.get_text() for p in doc];issues=[];spanning=0
 for i,p in enumerate(doc):
  if abs(p.rect.width-595.28)>2 or abs(p.rect.height-841.89)>2:issues.append(f'page {i+1}: not A4 portrait')
  if len(texts[i].strip())<10:issues.append(f'page {i+1}: blank')
  # Render the actual printed pages as evidence.
  p.get_pixmap(matrix=fitz.Matrix(1,1)).save(folder/f'{name}-page-{i+1:02}.png')
 for key in meta.get('groups',[]):
  start=[i for i,t in enumerate(texts) if key+'START' in t];end=[i for i,t in enumerate(texts) if key+'END' in t]
  if len(start)!=1 or start!=end:issues.append(f'{key}: related section split across pages {start}/{end}')
 for table in meta['tables']:
  occupied=set()
  for key in table['rows']:
   start=[i for i,t in enumerate(texts) if key+'START' in t];end=[i for i,t in enumerate(texts) if key+'END' in t]
   if len(start)!=1 or len(end)!=1 or start!=end:issues.append(f'{key}: missing, duplicated, or split row {start}/{end}')
   occupied.update(start+end)
  if len(occupied)>1:spanning+=1
  for i in occupied:
   if table['id']+'HEAD' not in texts[i]:issues.append(f"{table['id']}: header missing on page {i+1}")
 if name=='subject' and spanning==0:issues.append('stress table did not span pages')
 results.append(dict(report=name,pages=len(doc),spanning_tables=spanning,issues=issues,passed=not issues))
(folder/'pdf-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))
if not baseline and any(not r['passed'] for r in results):sys.exit(1)
