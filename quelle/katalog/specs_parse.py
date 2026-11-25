import pdfplumber, re, json, glob, sys, pathlib
from collections import Counter
HIER=pathlib.Path(__file__).resolve().parent
# Aufruf: python3 specs_parse.py <Ordner mit den Katalog-PDFs von https://www.jernyao.com/files/>
# Zellen kommen aus den Tabellenlinien der PDFs: Zeilen sind die Bänder zwischen den durchgehenden
# waagrechten Linien, Spalten die senkrechten Linien innerhalb des Bandes. Ein Wert gilt für alle
# Modelle, deren Kopfzelle unter seiner (ggf. verbundenen) Zelle liegt. Zweizeilige Zellen werden
# zusammengesetzt, etwa «1&1/8» über «(M27)» oder «60x20» über «0».
KAT=sys.argv[1] if len(sys.argv)>1 else '.'
FAM={'BF':'JBF','BP':'JBP','NP':'JNP','PF':'JPF','NF':'JNF','NFL':'JNF','NFP':'JNFP','NFPL':'JNFP','NFR':'JNFR','NFRL':'JNFR'}
MODEL_RE=re.compile(r'^(\d{1,2})B(\d)S([A-Z]*)$')
FIELDS=[('stations',['FORGING STATION','模數']),('cutoff_dia',['CUT-OFF DIA','切斷直徑']),('cutoff_len',['CUT-OFF LENGTH','切斷長度']),
 ('ko',['KICK-OUT','後托']),('pko',['P.K.O','P .K.O','前托']),('quill',['QUILL','切模']),('pitch',['PITCH','中心距離']),('die_hole',['DIE HOLE','母模']),
 ('punch_hole',['PUNCH','公模束']),('stroke',['RAM','滑板行程']),('power',['FORGING POWER','壓造力']),('size_inch',['(INCH)']),('size',['SIZE','尺寸','規格']),
 ('max_len',['MAX.L','最長長度']),('prod_wrench',['WRENCH','板手套筒']),('prod_setscrew',['SET SCREW','止付螺絲']),('min_len_hex',['HEX','外六角']),('min_len_socket',['SOCKET','強力']),('min_len',['MIN.L','最短長度']),
 ('open_upset',['OPEN','UPSET','鍛粗','母夾']),('output',['OUTPUT','產能']),('motor_hp',['MOTOR','馬達']),('weight',['WT','重量'])]
def field_of(label):
    L=label.upper()
    for f,keys in FIELDS:
        if any(k in L for k in keys): return f
    return None
def cluster(vals,tol=2.5):
    out=[]
    for v in sorted(vals):
        if out and v-out[-1][-1]<=tol: out[-1].append(v)
        else: out.append([v])
    return [sum(c)/len(c) for c in out]
def mitte(w,a,b): return (w[a]+w[b])/2
def zelltext(toks):
    # Lesereihenfolge: Zeile für Zeile, links nach rechts; ohne Zwischenraum zusammensetzen
    zeilen=[]; frei=[]
    for t in toks:   # gleicher Text zweimal in einer Zeile derselben Zelle (verbundene Zelle, Wert je Spalte gedruckt): einmal nehmen
        if not any(u['text']==t['text'] and abs(u['top']-t['top'])<3 for u in frei): frei.append(t)
    for t in sorted(frei,key=lambda w:w['top']):
        if zeilen and abs(zeilen[-1][0]-t['top'])<=3: zeilen[-1][1].append(t)
        else: zeilen.append([t['top'],[t]])
    return ''.join(''.join(w['text'] for w in sorted(z,key=lambda w:w['x0'])) for _,z in zeilen)
DB={}; log=[]
for f in sorted(glob.glob(KAT+'/*.pdf')):
    key=f.split('/')[-1][:-4]; fam=FAM[key.split('-')[0]]
    pdf=pdfplumber.open(f)
    for pi,p in enumerate(pdf.pages):
        ws=p.extract_words(x_tolerance=1.5, y_tolerance=2)
        mods=sorted([w for w in ws if w['top']<135 and MODEL_RE.match(w['text'])],key=lambda w:w['x0'])
        if not mods: continue
        models=[(f"{fam}-{w['text']}", mitte(w,'x0','x1')) for w in mods]
        V=[e for e in p.edges if e['orientation']=='v']; H=[e for e in p.edges if e['orientation']=='h']
        yh=mitte(mods[0],'top','bottom')
        vx=[e['x0'] for e in V if e['top']-1<=yh<=e['bottom']+1]
        xl=max(x for x in vx if x<models[0][1]-5); xr=min(x for x in vx if x>models[-1][1]+5)
        # durchgehende Zeilenlinien im Wertebereich
        ylin=[]
        for y in cluster([e['top'] for e in H]):
            segs=sorted((max(e['x0'],xl),min(e['x1'],xr)) for e in H if abs(e['top']-y)<=2.5 and e['x1']>xl and e['x0']<xr)
            L=0; cur=None
            for a,b in segs:
                if cur is None or a>cur[1]:
                    if cur: L+=cur[1]-cur[0]
                    cur=[a,b]
                else: cur[1]=max(cur[1],b)
            if cur: L+=cur[1]-cur[0]
            if L>=0.85*(xr-xl): ylin.append(y)
        baender=[(a,b) for a,b in zip(ylin,ylin[1:]) if a>yh]
        for y0,y1 in baender:
            ym=(y0+y1)/2
            inband=[w for w in ws if y0<mitte(w,'top','bottom')<y1]
            labs=[w for w in inband if mitte(w,'x0','x1')<xl]; vals=[w for w in inband if mitte(w,'x0','x1')>xl]
            lab=' '.join(w['text'] for w in sorted(labs,key=lambda w:(round(w['top']),w['x0'])))
            if not vals: continue
            seps=cluster([e['x0'] for e in V if e['top']-1<=ym<=e['bottom']+1 and e['x0']>=xl-3])
            zellen=[(a,b) for a,b in zip(seps,seps[1:]) if b-a>6]
            fld=field_of(lab)
            texte={}
            for a,b in zellen:
                t=zelltext([w for w in vals if a<mitte(w,'x0','x1')<b])
                if t: texte[(a,b)]=t
            if fld is None and texte and all(re.match(r'^M\d',t) for t in texte.values()): fld='size_mm'
            if fld is None:
                log.append((key,pi,round(ym),lab,list(texte.values())[:6])); continue
            for (a,b),t in texte.items():
                for m,x in models:
                    if a<x<b: DB.setdefault(m,{'katalog':key}).setdefault(fld,t)
            ohne=[m for m,x in models if not any(a<x<b for (a,b) in texte)]
            if ohne: log.append((key,pi,round(ym),fld,'ohne Wert',ohne))
        for m,_ in models: DB.setdefault(m,{'katalog':key})['seite']=pi+1
json.dump(DB,open(HIER/'specs_roh.json','w'),ensure_ascii=False,indent=1)
print('Modelle',len(DB)); print('Hinweise:',len(log))
for l in log: print('  ',l)
c=Counter(k for v in DB.values() for k in v); print(sorted(c.items(),key=lambda t:-t[1]))
