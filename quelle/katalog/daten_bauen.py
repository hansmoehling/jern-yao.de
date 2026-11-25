import json, re, csv, sys, pathlib
HIER=pathlib.Path(__file__).resolve().parent
# Aufruf: python3 daten_bauen.py <JernYao_Richtpreise_2026.csv>  (CSV liegt im Projektordner, nicht im Repo)
PREISE=sys.argv[1] if len(sys.argv)>1 else 'JernYao_Richtpreise_2026.csv'
S=json.load(open(HIER/'specs_roh.json'))
P={}
for r in csv.DictReader(open(PREISE,encoding='utf-8-sig'),delimiter=';'):
    P[r['modell']]={'richtpreis_eur':int(r['richtpreis_eur']),'von_eur':int(r['von_eur']),'bis_eur':int(r['bis_eur'])}
def num(s):
    if s is None: return None
    s=str(s).replace('Φ','').replace(',','.').strip()
    m=re.match(r'^(\d+(?:\.\d+)?)$',s); return float(m.group(1)) if m else None
def rng(s):
    if s is None: return None
    m=re.match(r'^(\d+(?:\.\d+)?)~(\d+(?:\.\d+)?)$',str(s))
    if m: return [float(m.group(1)),float(m.group(2))]
    v=num(s); return [None,v] if v is not None else None
def dxl(s):
    m=re.match(r'^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$',str(s or ''))
    return [float(m.group(1)),float(m.group(2))] if m else None
def ou(s):
    v=[float(x) for x in re.findall(r'Φ(\d+(?:\.\d+)?)',str(s or ''))]
    return v[0] if v else None   # Öffnung der Transferzange; bei «JSΦ15 ISΦ20» der JS-Wert
def oi(s):
    v=[float(x) for x in re.findall(r'Φ(\d+(?:\.\d+)?)',str(s or ''))]
    return v[1] if len(v)>1 else None   # zweiter Transfertyp IS
def psi(s):
    m=re.match(r'^[ψφ](\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$',str(s or ''))
    return [float(m.group(1)),float(m.group(2))] if m else None
def ko(s):
    m=re.match(r'^(\d+(?:\.\d+)?)(?:\((\d+(?:\.\d+)?)\))?$',str(s or ''))
    return (float(m.group(1)), float(m.group(2)) if m.group(2) else None) if m else (None,None)
FAMNAME={'JBF':'Bolzenpresse','JBP':'Teilepresse Langhub','JNP':'Teilepresse','JPF':'Mutternteilepresse','JNF':'Mutternpresse','JNFR':'Mutternpresse, Buchsenabschnitt','JNFP':'Mutternpresse, Buchsenabschnitt'}
out=[]
for m,d in S.items():
    fam=m.split('-')[0]; k,kr=ko(d.get('ko'))
    p=P.get(m,{})
    size=d.get('size') or d.get('size_mm')
    if size and re.match(r'^\d+x\d+',size): size=None
    sm=re.search(r'\((M\d+)\)',size or '') or re.match(r'^(M\d+)$',size or '')
    out.append(dict(m=m, f=fam, fn=FAMNAME[fam]+(' Langhub' if fam in('JNF','JNFR','JNFP') and m.endswith(('SL','SXL')) else ''),
        st=int(d['stations']), cd=num(d.get('cutoff_dia')), cl=rng(d.get('cutoff_len')), ko=k, kor=kr, pko=num(d.get('pko')),
        die=dxl(d.get('die_hole')), pun=dxl(d.get('punch_hole')), q=dxl(d.get('quill')), pi=num(d.get('pitch')), rs=num(d.get('stroke')),
        pw=num(d.get('power')), ou=ou(d.get('open_upset')), oi=oi(d.get('open_upset')), ps=psi(d.get('size')) or psi(d.get('prod_wrench')), out=num(d.get('output')), hp=num(d.get('motor_hp')), wt=num(d.get('weight')),
        ml=num(d.get('max_len')), sz=(sm.group(1) if sm else None), kat=d['katalog'], s=d.get('seite'),
        rp=p.get('richtpreis_eur'), lo=p.get('von_eur'), hi=p.get('bis_eur')))
miss=[o['m'] for o in out if o['rp'] is None or o['cd'] is None or o['cl'] is None or o['pw'] is None or o['die'] is None]
print(len(out),'Modelle; unvollständig:',miss[:10], len(miss))
keep=['m','f','st','cd','cl','ko','kor','pko','die','pun','q','pi','rs','pw','ou','oi','out','ml','sz','ps','hp','wt','kat','s','rp','lo','hi']
out=[{k:o[k] for k in keep if o.get(k) is not None} for o in out]
json.dump(out,open(HIER.parent/'maschinen.json','w'),ensure_ascii=False,separators=(',',':'))
print((HIER.parent/'maschinen.json').stat().st_size,'Bytes')
