#!/usr/bin/env python3
"""Create verified sample PDFs from a shared-group analysis JSON.

The application itself uses browser Print → Save as PDF. This helper creates
deterministic samples for package verification when a Chromium binary is not
available in the build environment.
"""
from __future__ import annotations
import argparse, json, math, re
from pathlib import Path
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

W, H = A4
NAVY, BLUE, ORANGE = HexColor("#0c1730"), HexColor("#1740a9"), HexColor("#ff963e")
INK, MUTED, BORDER, PALE = HexColor("#14181f"), HexColor("#5a6373"), HexColor("#dfe4ec"), HexColor("#f3f6fb")


def safe(v, fallback="—"):
    if v is None: return fallback
    s = str(v)
    return fallback if s in {"undefined", "null", "NaN", "Infinity", ""} else s


def percent(v):
    return "—" if v is None else f"{v*100:.1f}%"


def pp(v):
    return "—" if v is None else f"{v*100:.1f} pp"


def wrap(text, width, font="Helvetica", size=8):
    words, lines, line = str(text).split(), [], ""
    for word in words:
        trial = (line + " " + word).strip()
        if canvas.Canvas.stringWidth(trial, font, size) <= width: line = trial
        else:
            if line: lines.append(line)
            line = word
    if line: lines.append(line)
    return lines


def header(c, kicker, title, meta, page, total):
    c.setFillColor(ORANGE); c.setFont("Helvetica-Bold", 7); c.drawString(42, H-42, kicker.upper())
    c.setFillColor(NAVY); c.setFont("Helvetica-Bold", 18 if len(title) > 38 else 22); c.drawString(42, H-68, title)
    c.setFillColor(MUTED); c.setFont("Helvetica", 7.5)
    for i, line in enumerate(meta): c.drawRightString(W-42, H-42-i*10, safe(line, ""))
    c.setStrokeColor(NAVY); c.setLineWidth(1.8); c.line(42, H-82, W-42, H-82)
    c.setStrokeColor(BORDER); c.setLineWidth(.6); c.line(42, 28, W-42, 28)
    c.setFillColor(MUTED); c.setFont("Helvetica", 6.5); c.drawString(42, 17, "TESTPREP · SHARED GROUP PROFILE"); c.drawRightString(W-42, 17, f"PAGE {page} OF {total}")


def label(c, x, y, text):
    c.setFillColor(ORANGE); c.rect(x, y-9, 3, 11, fill=1, stroke=0)
    c.setFillColor(NAVY); c.setFont("Helvetica-Bold", 10); c.drawString(x+8, y-7, text)


def card(c, x, y, w, h, title, value, detail=""):
    c.setFillColor(PALE); c.roundRect(x, y-h, w, h, 7, fill=1, stroke=0)
    c.setFillColor(MUTED); c.setFont("Helvetica-Bold", 6); c.drawString(x+10, y-14, title.upper())
    c.setFillColor(BLUE); c.setFont("Helvetica-Bold", 19); c.drawString(x+10, y-36, safe(value))
    c.setFillColor(MUTED); c.setFont("Helvetica", 7); c.drawString(x+10, y-h+10, safe(detail, ""))


def bar(c, x, y, w, title, stat, color=BLUE):
    acc = stat.get("accuracy")
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 7.5); c.drawString(x, y, title)
    c.setFillColor(MUTED); c.setFont("Helvetica", 7); c.drawRightString(x+w, y, f'{stat.get("correct",0)}/{stat.get("administered",0)} · {percent(acc)}')
    c.setFillColor(BORDER); c.roundRect(x, y-10, w, 5, 2.5, fill=1, stroke=0)
    if acc is not None:
        c.setFillColor(color); c.roundRect(x, y-10, max(2, w*max(0,min(1,acc))), 5, 2.5, fill=1, stroke=0)


def simple_table(c, x, y, widths, headers, rows, row_h=15, font=7):
    total = sum(widths)
    c.setFillColor(NAVY); c.rect(x, y-row_h, total, row_h, fill=1, stroke=0)
    xx=x; c.setFillColor(white); c.setFont("Helvetica-Bold", font-1)
    for w,h in zip(widths,headers): c.drawString(xx+4,y-row_h+4,h); xx+=w
    yy=y-row_h
    for idx,row in enumerate(rows):
        yy-=row_h
        c.setFillColor(PALE if idx%2 else white); c.rect(x,yy,total,row_h,fill=1,stroke=0)
        xx=x
        for w,value in zip(widths,row):
            c.setFillColor(INK); c.setFont("Helvetica-Bold" if xx==x else "Helvetica",font)
            text=safe(value)
            if len(text)>45: text=text[:42]+"…"
            c.drawString(xx+4,yy+4,text); xx+=w
        c.setStrokeColor(BORDER); c.setLineWidth(.25); c.line(x,yy,x+total,yy)
    return yy


def draw_report(data, path):
    c=canvas.Canvas(str(path),pagesize=A4,pageCompression=1)
    g,s,p,v=data["group"],data["score_statistics"],data["pooled"],data["variation"]
    meta=[g["group_name"],g["assessment_title"],f'{g["valid_student_count"]} valid · {g["excluded_student_count"]} excluded',safe(g.get("diagnostic_date_range"))]
    header(c,"Group diagnostic","SAT Group Diagnostic Summary",meta,1,3)
    y=H-105; gap=10; cw=(W-84-gap*2)/3
    for i,(title,stat) in enumerate([("Average total score",s["total"]),("Average Reading & Writing",s["reading_writing"]),("Average Math",s["math"])]):
        card(c,42+i*(cw+gap),y,cw,64,title,round(stat["mean"]) if stat["mean"] is not None else "Not provided",f'Range: {safe(stat["min"])}–{safe(stat["max"])} · n={stat["n"]}')
    y-=82; label(c,42,y,"Pooled completion and accuracy"); y-=22
    vals=[("Correct",p["overall"]["correct"]),("Administered",p["overall"]["administered"]),("Answered",p["overall"]["answered"]),("Accuracy",percent(p["overall"]["accuracy"])),("Completion",percent(p["overall"]["completion"]))]
    mw=(W-84-4*6)/5
    for i,(t,val) in enumerate(vals): card(c,42+i*(mw+6),y,mw,46,t,val)
    y-=66; label(c,42,y,"Similarity summary"); y-=22
    status=data["similarity"]; c.setFillColor(HexColor("#fff3e9") if status["level"]=="high" else PALE); c.roundRect(42,y-40,W-84,40,6,fill=1,stroke=0)
    c.setFillColor(NAVY); c.setFont("Helvetica-Bold",12); c.drawString(54,y-17,"Performance similarity: "+status["label"])
    c.setFillColor(MUTED); c.setFont("Helvetica",7); c.drawString(54,y-30,"The shared roadmap remains appropriate; use tiered practice in flagged lessons.")
    y-=55
    stats=[("Total-score SD",s["total"]["sd"]),("R&W SD",s["reading_writing"]["sd"]),("Math SD",s["math"]["sd"]),("Accuracy SD",pp(v["overall_accuracy"]["sd"]))]
    for i,(t,val) in enumerate(stats): card(c,42+i*((W-84-18)/4+6),y,(W-84-18)/4,43,t,val)
    y-=62; label(c,42,y,"Section comparison"); y-=18; bar(c,42,y,W-84,"Reading and Writing",p["sections"]["english"],BLUE); y-=28; bar(c,42,y,W-84,"Math",p["sections"]["math"],ORANGE)
    y-=34; label(c,42,y,"Summarized student snapshot"); y-=16
    rows=[[x["student_name"],safe(x["total_score"],"—"),safe(x["reading_writing_score"],"—"),safe(x["math_score"],"—"),percent(x["overall_accuracy"])] for x in data["student_snapshots"][:10]]
    simple_table(c,42,y,[150,75,75,75,94],["Student","Total","R&W","Math","Accuracy"],rows,14,7)
    c.showPage()

    header(c,"Diagnostic performance","Where the group is ready—and where to teach",[g["group_name"],"Pooled counts drive instruction","Student percentages drive variation"],2,3)
    y=H-110; label(c,42,y,"Module performance"); y-=20
    defs=[("R&W · Module 1","english|module_1",BLUE),("R&W · Module B","english|module_b",BLUE),("Math · Module 1","math|module_1",ORANGE),("Math · Module B","math|module_b",ORANGE)]
    for title,key,col in defs: bar(c,42,y,220,title,p["modules"][key],col); y-=29
    yy=H-130; label(c,322,yy,"Difficulty performance"); yy-=20
    for title,key,col in [("Easy","easy",HexColor("#2b8a64")),("Medium","medium",HexColor("#cf8a18")),("Hard","hard",HexColor("#bd4c32"))]: bar(c,322,yy,231,title,p["difficulties"][key],col); yy-=34
    y=min(y,yy)-12; label(c,42,y,"Group strengths and priorities"); y-=18
    c.setFillColor(PALE); c.roundRect(42,y-190,245,190,7,fill=1,stroke=0); c.roundRect(308,y-190,245,190,7,fill=1,stroke=0)
    c.setFillColor(NAVY); c.setFont("Helvetica-Bold",10); c.drawString(54,y-18,"Strongest shared evidence"); c.drawString(320,y-18,"Highest instructional priorities")
    for side,items,x in [("strength",data["strengths"],54),("priority",data["priority_areas"],320)]:
        iy=y-40
        for item in items[:3]:
            c.setFillColor(INK); c.setFont("Helvetica-Bold",8); c.drawString(x,iy,item["lesson_name"][:32]); iy-=12
            c.setFillColor(MUTED); c.setFont("Helvetica",7); c.drawString(x,iy,f'{item["correct"]}/{item["administered"]} · {percent(item["accuracy"])} · {item["students_represented"]} students'); iy-=24
    y-=212; label(c,42,y,"Important variation flags"); y-=18
    for item in data["variation_flags"][:4]:
        c.setFillColor(HexColor("#fff7ef")); c.roundRect(42,y-36,W-84,32,5,fill=1,stroke=0)
        c.setFillColor(INK); c.setFont("Helvetica-Bold",8); c.drawString(52,y-16,"Mixed readiness in "+item["lesson_name"])
        c.setFillColor(MUTED); c.setFont("Helvetica",7); c.drawString(52,y-27,f'Student accuracy SD {pp(item["accuracy_sd"])} (n={item["accuracy_sd_n"]}). Teach the common core, then use tiered practice.'); y-=42
    c.showPage()

    header(c,"One shared course","Shared Group Roadmap",[g["group_name"],"Fixed 2.0× group time","Not a sum of individual plans"],3,3)
    y=H-106; vals=[("Lessons",len(data["roadmap"]["lesson_sequence"])),("R&W",f'{data["totals"]["english_group_hours"]} h'),("Math",f'{data["totals"]["math_group_hours"]} h'),("Strategy",f'{data["totals"]["strategy_hours"]} h'),("Total",f'{data["totals"]["final_planned_total"]} h'),("Weeks",data["schedule"]["recommended_weeks"])]
    mw=(W-84-25)/6
    for i,(t,val) in enumerate(vals): card(c,42+i*(mw+5),y,mw,44,t,val)
    y-=60; label(c,42,y,"Shared lesson sequence"); y-=15
    rows=[]
    for i,l in enumerate(data["roadmap"]["lesson_sequence"],1):
        lp=p["lessons"][l["lesson_id"]]
        note=("Tiered practice" if l.get("needs_differentiation") else "Shared core")+f' · {lp["correct"]}/{lp["administered"]} ({percent(lp["accuracy"])})'
        rows.append([f'{i}. {l["lesson_name"]}',"R&W" if l["section"]=="english" else "Math",l["priority"].replace("_"," "),l["group_hours"],note])
    y=simple_table(c,42,y,[170,48,70,42,139],["Lesson","Section","Priority","Group h","Rationale / delivery"],rows,13,5.8)
    c.setFillColor(PALE); c.roundRect(42,y-48,W-84,38,6,fill=1,stroke=0); c.setFillColor(INK); c.setFont("Helvetica-Bold",7); c.drawString(52,y-24,"Hours explanation")
    c.setFillColor(MUTED); c.setFont("Helvetica",6.5); c.drawString(52,y-36,"Pooled diagnostic performance is analyzed once. Shared teaching time uses the 2.0 multiplier and is not the sum of student plans.")
    c.showPage(); c.save()


def draw_roadmap(data, path):
    c=canvas.Canvas(str(path),pagesize=A4,pageCompression=1); g=data["group"]; seq=data["roadmap"]["lesson_sequence"]; p=data["pooled"]
    c.setFillColor(NAVY); c.rect(0,0,W,H,fill=1,stroke=0); c.setFillColor(ORANGE); c.setFont("Helvetica-Bold",9); c.drawString(48,H-54,"TESTPREP · ONE GROUP · ONE SHARED COURSE")
    c.setFillColor(white); c.setFont("Helvetica-Bold",38); c.drawString(48,H-190,g["group_name"]); c.drawString(48,H-235,"Shared SAT Roadmap")
    c.setFillColor(HexColor("#d9e3f5")); c.setFont("Helvetica",13); c.drawString(48,H-275,"Pooled instruction, targeted differentiation, measurable progress.")
    for i,(v,t) in enumerate([(g["valid_student_count"],"VALID STUDENTS"),(len(seq),"SHARED LESSONS"),(f'{data["totals"]["final_planned_total"]} h',"ONE COURSE"),(data["similarity"]["label"],"SIMILARITY")]):
        x=48+i*126; c.setFillColor(ORANGE); c.rect(x,80,100,2,fill=1,stroke=0); c.setFillColor(white); c.setFont("Helvetica-Bold",18 if i<3 else 12); c.drawString(x,55,safe(v)); c.setFillColor(HexColor("#b7c6df")); c.setFont("Helvetica",6); c.drawString(x,42,t)
    c.showPage()
    header(c,"Group profile","The instructional starting point",[g["group_name"],f'{g["valid_student_count"]} valid · {g["excluded_student_count"]} excluded',data["similarity"]["label"]],2,4)
    y=H-110; vals=[("Pooled accuracy",percent(p["overall"]["accuracy"])),("Average score",round(data["score_statistics"]["total"]["mean"])),("Group time","2.0×"),("Duration",data["schedule"]["recommended_weeks"]+" weeks")]
    cw=(W-84-24)/4
    for i,(t,val) in enumerate(vals): card(c,42+i*(cw+8),y,cw,58,t,val)
    y-=82; label(c,42,y,"Course allocation"); y-=18
    maxh=max(data["totals"]["english_group_hours"],data["totals"]["math_group_hours"],data["totals"]["strategy_hours"])
    for name,val,col in [("Reading and Writing",data["totals"]["english_group_hours"],BLUE),("Math",data["totals"]["math_group_hours"],ORANGE),("Strategy",data["totals"]["strategy_hours"],HexColor("#2b8a64"))]:
        bar(c,42,y,W-84,name,{"correct":val,"administered":"h","accuracy":val/maxh},col); y-=34
    label(c,42,y,"Strengths and priorities"); y-=18
    rows=[[x["lesson_name"],"Strength",f'{x["correct"]}/{x["administered"]}',percent(x["accuracy"])] for x in data["strengths"]]+[[x["lesson_name"],x["priority"].replace("_"," "),f'{x["correct"]}/{x["administered"]}',f'{x["group_hours"]} h'] for x in data["priority_areas"]]
    y=simple_table(c,42,y,[230,90,70,80],["Area","Status","Pooled","Plan"],rows,20,7.5)-24
    label(c,42,y,"Mixed-readiness delivery"); y-=18
    for item in data["variation_flags"][:5]:
        c.setFillColor(HexColor("#fff7ef")); c.roundRect(42,y-32,W-84,27,5,fill=1,stroke=0); c.setFillColor(INK); c.setFont("Helvetica-Bold",7.5); c.drawString(52,y-17,item["lesson_name"]); c.setFillColor(MUTED); c.setFont("Helvetica",6.5); c.drawRightString(W-52,y-17,"SD "+pp(item["accuracy_sd"])+" · tiered practice"); y-=36
    c.showPage()
    for page_num,chunk in [(3,seq[:14]),(4,seq[14:])]:
        header(c,"Shared lesson sequence",("Teach the highest-need units first" if page_num==3 else "Complete, rehearse, and reassess"),[g["group_name"],f'Lessons {1 if page_num==3 else 15}–{14 if page_num==3 else len(seq)}',"Each lesson appears once"],page_num,4)
        y=H-112; rows=[]
        for i,l in enumerate(chunk,1 if page_num==3 else 15):
            lp=p["lessons"][l["lesson_id"]]; rows.append([f'{i}. {l["lesson_name"]}',"R&W" if l["section"]=="english" else "Math",l["priority"].replace("_"," "),f'{l["group_hours"]} h',("Tiered" if l.get("needs_differentiation") else "Shared")+f' · {percent(lp["accuracy"])}'])
        y=simple_table(c,42,y,[205,55,75,55,80],["Lesson","Section","Priority","Time","Delivery"],rows,30,7.2)-25
        label(c,42,y,"Teaching approach"); y-=22
        notes=["Teach and model the common core concept for the entire group.","Use support, standard, and extension practice in mixed-readiness lessons.","Reassess the highest-priority skills and rebalance only from new evidence."]
        for text in notes:
            c.setFillColor(PALE); c.roundRect(42,y-34,W-84,29,5,fill=1,stroke=0); c.setFillColor(INK); c.setFont("Helvetica-Bold",7.5); c.drawString(52,y-22,"• "+text); y-=39
        if page_num==4:
            c.setFillColor(HexColor("#fff7ef")); c.roundRect(42,y-45,W-84,39,5,fill=1,stroke=0); c.setFillColor(INK); c.setFont("Helvetica-Bold",7.5); c.drawString(52,y-22,"One shared plan · fixed 2.0× group time")
            c.setFillColor(MUTED); c.setFont("Helvetica",6.5); c.drawString(52,y-34,"The course is calculated from pooled performance; it is never the sum or average of individual roadmaps.")
        c.showPage()
    c.save()


def main():
    parser=argparse.ArgumentParser(); parser.add_argument("analysis",type=Path); parser.add_argument("--output-dir",type=Path,required=True); args=parser.parse_args()
    data=json.loads(args.analysis.read_text(encoding="utf-8")); args.output_dir.mkdir(parents=True,exist_ok=True)
    draw_report(data,args.output_dir/"october-2026-trio_three-page-group-report.pdf")
    draw_roadmap(data,args.output_dir/"october-2026-trio_group-roadmap.pdf")


if __name__=="__main__": main()
