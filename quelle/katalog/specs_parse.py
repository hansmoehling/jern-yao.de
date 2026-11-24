import pdfplumber, re, json, glob, statistics, sys, pathlib
HIER=pathlib.Path(__file__).resolve().parent
# Aufruf: python3 specs_parse.py <Ordner mit den Katalog-PDFs von https://www.jernyao.com/files/>
KAT=sys.argv[1] if len(sys.argv)>1 else '.'
FAM={'BF':'JBF','BP':'JBP','NP':'JNP','PF':'JPF','NF':'JNF','NFL':'JNF','NFP':'JNFP','NFPL':'JNFP','NFR':'JNFR','NFRL':'JNFR'}
MODEL_RE=re.compile(r'^(\d{1,2})B(\d)S([A-Z]*)$')
VAL_RE=re.compile(r'^(Φ?\d[\d.,/~x()&]*|x\d[\d.]*|~\d[\d.]*|M\d+[\d.]*|\(M\d+\)|#\d[\d,/]*|--|[\d/&]+\(M\d+\))$')
FIELDS=[('stations',['FORGING STATION','模數']),('cutoff_dia',['CUT-OFF DIA','切斷直徑']),('cutoff_len',['CUT-OFF LENGTH','切斷長度']),
 ('ko',['KICK-OUT','後托']),('pko',['P.K.O','P .K.O','前托']),('quill',['QUILL','切模']),('pitch',['PITCH','中心距離']),('die_hole',['DIE HOLE','母模']),
 ('punch_hole',['PUNCH','公模束']),('stroke',['RAM','滑板行程']),('power',['FORGING POWER','壓造力']),('size',['SIZE','尺寸']),('size_inch',['(INCH)']),
 ('max_len',['MAX.L','最長長度']),('min_len_hex',['HEX','外六角']),('min_len_socket',['SOCKET','強力']),('min_len',['MIN.L','最短長度']),
 ('open_upset',['OPEN','UPSET','鍛粗','母夾']),('output',['OUTPUT','產能']),('motor_hp',['MOTOR','馬達']),('weight',['WT','重量'])]
def field_of(label):
    L=label.upper()
    for f,keys in FIELDS:
        if any(k in L for k in keys): return f
    return None
def join_vals(tokens):
    out=[]
    for t in sorted(tokens,key=lambda w:w['x0']):
        tx=t['text']
        if out:
            p=out[-1]['text']; gap=t['x0']-out[-1]['x1']
            num_prev=bool(re.match(r'^\d+(\.\d+)?$',p))
            if (p.endswith('x') and re.match(r'^\d',tx)) or (p.endswith('~') and re.match(r'^\d',tx)) \
               or (tx.startswith('x') and re.match(r'^x\d',tx) and re.match(r'^\d',p) and gap<10) \
               or (tx.startswith('~') and gap<10) \
               or (tx.startswith('(M') and gap<8) \
               or (re.match(r'^\(\d+(\.\d+)?\)$',tx) and num_prev and gap<14) \
               or (re.match(r'^\d+$',tx) and p in ('1&1/8','1&1/4','1&3/8')):
                out[-1]={'text':p+tx,'x0':out[-1]['x0'],'x1':t['x1']}; continue
        out.append(dict(text=tx,x0=t['x0'],x1=t['x1']))
    return out
def size_of(m): return int(MODEL_RE.match(m.split('-')[1]).group(1))
def assign(vals, models):
    # models: list of (code, xc); vals: list of dict text,x0,x1
    vc=[((v['x0']+v['x1'])/2, v['text']) for v in vals]
    n=len(models)
    if len(vc)==n: return {m:t for (m,_),(_,t) in zip(models,vc)}
    if len(vc)==1: return {m:vc[0][1] for m,_ in models}
    groups={}
    for m,x in models: groups.setdefault(size_of(m),[]).append((m,x))
    gc={g:statistics.mean(x for _,x in ms) for g,ms in groups.items()}
    per={g:[] for g in groups}
    for x,t in vc:
        g=min(gc,key=lambda g:abs(gc[g]-x)); per[g].append((x,t))
    res={}
    for g,ms in groups.items():
        vs=sorted(per[g])
        if not vs: continue
        if len(vs)==len(ms): res.update({m:t for (m,_),(_,t) in zip(ms,vs)})
        elif len(vs)==1: res.update({m:vs[0][1] for m,_ in ms})
        else:
            for m,x in ms: res[m]=min(vs,key=lambda v:abs(v[0]-x))[1]
    return res
DB={}; log=[]
for f in sorted(glob.glob(KAT+'/*.pdf')):
    key=f.split('/')[-1][:-4]; fam=FAM[key.split('-')[0]]
    pdf=pdfplumber.open(f)
    for pi,p in enumerate(pdf.pages):
        ws=p.extract_words(x_tolerance=1.5, y_tolerance=2)
        mods=[(w,MODEL_RE.match(w['text'])) for w in ws if w['top']<135 and MODEL_RE.match(w['text'])]
        if not mods: continue
        models=[(f"{fam}-{w['text']}", (w['x0']+w['x1'])/2) for w,_ in sorted(mods,key=lambda t:t[0]['x0'])]
        hdr_bottom=max(w['bottom'] for w,_ in mods)
        body=[w for w in ws if w['top']>hdr_bottom+2 and w['top']<515]
        # Zeilen clustern
        body.sort(key=lambda w:w['top']); rows=[]
        for w in body:
            if rows and abs(rows[-1][0]-w['top'])<=3.5: rows[-1][1].append(w)
            else: rows.append([w['top'],[w]])
        parsed=[]
        for y,toks in rows:
            vals=[t for t in toks if VAL_RE.match(t['text']) and t['x0']>150]
            labs=[t for t in toks if t not in vals]
            parsed.append(dict(y=y,label=' '.join(t['text'] for t in sorted(labs,key=lambda w:w['x0'])),vals=join_vals(vals)))
        for i,r in enumerate(parsed):
            if not r['vals']: continue
            lab=r['label']; fld=field_of(lab) if lab else None
            if fld is None or fld in ('size_inch',) and not lab.strip().upper().startswith('(INCH'):
                # Nachbarzeilen ohne Werte als Label nehmen
                near=[q for q in parsed if q is not r and not q['vals'] and abs(q['y']-r['y'])<=10 and field_of(q['label'])]
                if near: fld=field_of(min(near,key=lambda q:abs(q['y']-r['y']))['label'])
            if lab.strip().upper()=='(MM)' and any(v['text'].startswith('M') for v in r['vals']): fld='size_mm'
            if fld is None:
                log.append((key,pi,round(y),lab,[v['text'] for v in r['vals']][:6])); continue
            a=assign(r['vals'],models)
            for m,t in a.items():
                DB.setdefault(m,{'katalog':key}).setdefault(fld,t)
        for m,_ in models: DB.setdefault(m,{'katalog':key})['seite']=pi+1
json.dump(DB,open(HIER/'specs_roh.json','w'),ensure_ascii=False,indent=1)
print('Modelle',len(DB)); print('nicht zugeordnete Zeilen:',len(log))
for l in log[:20]: print('  ',l)
from collections import Counter
c=Counter(k for v in DB.values() for k in v); print(sorted(c.items(),key=lambda t:-t[1]))
