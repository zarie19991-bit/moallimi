#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
مرجع مستقل لقراءة ورقة التظليل OMR الخاصة بمنصة معلّمي.
الخوارزمية:
1) grayscale + Otsu
2) استخراج المربعات السوداء الصغيرة ذات الشكل المربع
3) اختيار علامات المحاذاة الأربع هندسيًا
4) Homography من قالب 180x112 إلى الصورة
5) قياس مركز الدائرة مقابل الحلقة المحلية
6) عتبات تكيفية median + MAD
7) تصدير CSV + صورة تشخيصية

الاستخدام:
  python tools/omr_cv_reader.py input.jpg --csv result.csv --annotated annotated.jpg
"""

from __future__ import annotations
import argparse, csv, json, math
from pathlib import Path
import cv2
import numpy as np

TEMPLATE_MARKERS=np.float32([[4,4],[176,4],[4,108],[176,108]])
RIGHTS=[171,128,85,42]
OFFSETS=[7.5,15.5,23.5,31.5]
LETTERS=["أ","ب","ج","د"]

def clamp(v,a,b): return max(a,min(b,v))

def detect_markers(gray: np.ndarray):
    h,w=gray.shape
    y0,y1=int(h*.40),int(h*.78)
    roi=gray[y0:y1,:]
    otsu,bw=cv2.threshold(roi,0,255,cv2.THRESH_BINARY_INV+cv2.THRESH_OTSU)
    contours,_=cv2.findContours(bw,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    cands=[]
    for cnt in contours:
        x,y,cw,ch=cv2.boundingRect(cnt); y+=y0
        area=float(cv2.contourArea(cnt))
        if not (6<=cw<=max(30,int(w*.04)) and 6<=ch<=max(30,int(w*.04))): continue
        ratio=cw/max(ch,1)
        if not .65<=ratio<=1.5: continue
        fill=area/max(1,cw*ch)
        if fill<.68: continue
        peri=cv2.arcLength(cnt,True)
        approx=cv2.approxPolyDP(cnt,.05*peri,True)
        if len(approx)>6: continue
        cands.append(dict(x=x+cw/2,y=y+ch/2,w=cw,h=ch,area=area,fill=fill,verts=len(approx)))

    # العلامات الحقيقية صغيرة وصلبة نسبيًا. لا نعتمد على ترتيب ثابت فقط.
    small=[c for c in cands if c["area"]<=max(220,w*w*.00028) and c["fill"]>=.72]
    best=None
    target=172/104
    for i,a in enumerate(small):
        for j,b in enumerate(small):
            if j==i: continue
            # صف علوي
            if a["x"]>=b["x"]: continue
            if abs(a["y"]-b["y"])>h*.035: continue
            dx_top=b["x"]-a["x"]
            if dx_top<w*.45: continue
            for k,c in enumerate(small):
                if k in (i,j): continue
                for l,d in enumerate(small):
                    if l in (i,j,k): continue
                    if c["x"]>=d["x"]: continue
                    if abs(c["y"]-d["y"])>h*.035: continue
                    if (c["y"]+d["y"])/2 <= (a["y"]+b["y"])/2: continue
                    dx_bot=d["x"]-c["x"]
                    dy=((c["y"]+d["y"])-(a["y"]+b["y"]))/2
                    if dy<h*.14 or dy>h*.45: continue
                    if abs(a["x"]-c["x"])>w*.08 or abs(b["x"]-d["x"])>w*.08: continue
                    if max(dx_top,dx_bot)/max(1,min(dx_top,dx_bot))>1.25: continue
                    aspect=((dx_top+dx_bot)/2)/dy
                    err=abs(math.log(aspect/target))
                    if err>.40: continue
                    edge_bonus=(a["x"]<w*.25)+(c["x"]<w*.25)+(b["x"]>w*.70)+(d["x"]>w*.70)
                    score=(1-err)+edge_bonus*.12+sum(x["fill"] for x in (a,b,c,d))*.08
                    if best is None or score>best[0]:
                        best=(score,a,b,c,d,otsu,err)
    if best is None:
        raise RuntimeError("لم يتم العثور على أربع علامات محاذاة موثوقة.")
    _,tl,tr,bl,br,otsu,err=best
    pts=np.float32([[tl["x"],tl["y"]],[tr["x"],tr["y"]],[bl["x"],bl["y"]],[br["x"],br["y"]]])
    return pts,float(otsu),float(err),small

def map_points(markers: np.ndarray):
    H=cv2.getPerspectiveTransform(TEMPLATE_MARKERS,markers)
    out=[]
    for i in range(60):
        block,row=divmod(i,15); y=20+row*5.45; right=RIGHTS[block]
        q=[]
        for off in OFFSETS:
            v=H@np.array([right-off,y,1.0],dtype=float)
            q.append((float(v[0]/v[2]),float(v[1]/v[2])))
        out.append(q)
    return out,H

def mean_annulus(gray,cx,cy,r,inner=0.0):
    h,w=gray.shape
    x0=max(0,int(cx-r-2));x1=min(w,int(cx+r+3))
    y0=max(0,int(cy-r-2));y1=min(h,int(cy+r+3))
    yy,xx=np.ogrid[y0:y1,x0:x1]
    dd=(xx-cx)**2+(yy-cy)**2
    mask=(dd<=r*r)&(dd>=inner*inner)
    if not np.any(mask): return 255.0
    return float(gray[y0:y1,x0:x1][mask].mean())

def read_bubbles(gray,markers,total=60,start_no=1):
    pts,_=map_points(markers)
    span=(np.linalg.norm(markers[1]-markers[0])+np.linalg.norm(markers[3]-markers[2]))/2
    radius=clamp(float(span)*.0082,3.2,7.5)
    raw=[]
    for i in range(min(total,60)):
        ev=[]
        for cx,cy in pts[i]:
            center=mean_annulus(gray,cx,cy,radius*.55)
            ring=mean_annulus(gray,cx,cy,radius*1.55,radius*1.05)
            ev.append(dict(score=(ring-center)/255.0,center=center,ring=ring,x=cx,y=cy))
        raw.append(ev)

    vals=np.array([e["score"] for row in raw for e in row],dtype=float)
    base=float(np.median(vals))
    mad=float(np.median(np.abs(vals-base)))
    possible=clamp(base+max(.018,mad*2.4),.012,.032)
    definite=clamp(base+max(.028,mad*3.5),.025,.052)
    sep_thr=clamp(max(.024,mad*2.2),.020,.042)

    rows=[]
    for i,ev in enumerate(raw):
        order=sorted(enumerate(ev),key=lambda z:z[1]["score"],reverse=True)
        top,second=order[0],order[1]
        defs=[j for j,e in order if e["score"]>=definite]
        poss=[j for j,e in order if e["score"]>=possible]
        separation=top[1]["score"]-second[1]["score"]
        if top[1]["score"]<possible:
            status,selected="blank",None
        elif len(defs)>1:
            status,selected="multiple",top[0]
        elif len(poss)>1 or top[1]["score"]<definite or separation<sep_thr:
            status,selected="ambiguous",top[0]
        else:
            status,selected="clear",top[0]
        confidence=(
            min(1.0,.94+(top[1]["score"]-definite)*.45+separation*.30)
            if status=="clear" else
            .96 if status=="blank" else
            min(.79,.5+max(0,top[1]["score"]-possible)*6+max(0,separation)*4)
        )
        rows.append(dict(
            question=start_no+i,status=status,selected=selected,
            selected_letter=LETTERS[selected] if selected is not None else "",
            confidence=round(float(confidence),3),
            top_score=round(float(top[1]["score"]),4),
            second_score=round(float(second[1]["score"]),4),
            separation=round(float(separation),4),
            threshold=round(float(definite),4),
            score_A=round(float(ev[0]["score"]),4),score_B=round(float(ev[1]["score"]),4),
            score_C=round(float(ev[2]["score"]),4),score_D=round(float(ev[3]["score"]),4),
            points=[(e["x"],e["y"]) for e in ev]
        ))
    calibration=dict(baseline=round(base,4),mad=round(mad,4),possible=round(possible,4),definite=round(definite,4),separation=round(sep_thr,4))
    return rows,calibration,radius

def annotate(img,markers,rows,out_path):
    vis=img.copy()
    for p in markers:
        cv2.circle(vis,(int(round(p[0])),int(round(p[1]))),10,(0,255,0),2)
    for row in rows:
        for j,(x,y) in enumerate(row["points"]):
            if row["selected"]==j and row["status"]=="clear":
                color=(0,255,0)
            elif row["status"] in ("ambiguous","multiple") and row["selected"]==j:
                color=(0,165,255)
            else:
                color=(255,0,0)
            cv2.circle(vis,(int(round(x)),int(round(y))),5,color,1)
        x,y=row["points"][0]
        cv2.putText(vis,str(row["question"]),(int(x)-28,int(y)+4),cv2.FONT_HERSHEY_SIMPLEX,.28,(20,20,20),1,cv2.LINE_AA)
    cv2.imwrite(str(out_path),vis)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--total",type=int,default=60)
    ap.add_argument("--start",type=int,default=1)
    ap.add_argument("--csv",default="omr_read.csv")
    ap.add_argument("--annotated",default="omr_annotated.jpg")
    ap.add_argument("--json",default="omr_summary.json")
    args=ap.parse_args()

    img=cv2.imread(args.image)
    if img is None: raise SystemExit("تعذر فتح الصورة.")
    if img.shape[1]>img.shape[0]:
        img=cv2.rotate(img,cv2.ROTATE_90_CLOCKWISE)
    gray=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
    markers,otsu,geom_err,_=detect_markers(gray)
    rows,calibration,radius=read_bubbles(gray,markers,args.total,args.start)

    with open(args.csv,"w",newline="",encoding="utf-8-sig") as f:
        fields=[k for k in rows[0].keys() if k!="points"]
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
        for r in rows:w.writerow({k:v for k,v in r.items() if k!="points"})

    annotate(img,markers,rows,Path(args.annotated))
    summary={
        "image":str(args.image),"size":[int(img.shape[1]),int(img.shape[0])],
        "markers":markers.round(1).tolist(),"otsu_threshold":round(otsu,1),
        "geometry_error":round(geom_err,4),"bubble_radius_px":round(radius,2),
        "calibration":calibration,
        "counts":{s:sum(r["status"]==s for r in rows) for s in ["clear","blank","multiple","ambiguous"]},
        "reader":"opencv-otsu-homography-center-ring-v1"
    }
    Path(args.json).write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__=="__main__":
    main()
