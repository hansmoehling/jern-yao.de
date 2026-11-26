from pathlib import Path
import json,importlib.util,re
Q=Path(__file__).resolve().parent

def embed_defaults(text, marker, path):
    payload=json.dumps(json.loads((Q/path).read_text(encoding='utf-8')),ensure_ascii=False,separators=(',',':'))
    pattern=r'/\*'+marker+r'_BEGIN\*/[\s\S]*?/\*'+marker+r'_END\*/'
    text,count=re.subn(pattern,lambda _: '/*'+marker+'_BEGIN*/'+payload+'/*'+marker+'_END*/',text)
    assert count==1,(marker,count)
    return text

def build_i18n():
    catalog={}
    for file in sorted(Q.glob('i18n-*.json')):
        rows=json.loads(file.read_text(encoding='utf-8-sig'))
        for key,values in rows.items():
            assert len(values)==4 and all(isinstance(v,str) and v.strip() for v in values),(file,key)
            key=' '.join(key.split())
            catalog[key]=values
    runtime=(Q/'i18n-runtime.js').read_text(encoding='utf-8-sig')
    (Q/'i18n.js').write_text(runtime.replace('/*CATALOG*/',json.dumps(catalog,ensure_ascii=False,separators=(',',':'))),encoding='utf-8')
    return catalog

def manual_redirect():
    # Keep shared links and the short /manual/ entry usable, including language and anchors.
    return '''<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Manual · Jern Yao</title><meta name="robots" content="noindex, nofollow">
<link rel="canonical" href="https://jern-yao.de/manual/konfigurator-v1.html"></head>
<body><p><a id="manual-link" href="/manual/konfigurator-v1.html">Manual · Manuelle Auslegung</a></p>
<script>
(function () {
  const target = '/manual/konfigurator-v1.html' + window.location.search + window.location.hash;
  const labels = {de:'Manual · Manuelle Auslegung',it:'Manual · Dimensionamento manuale',sl:'Manual · Ročno dimenzioniranje',en:'Manual · Manual sizing',zh:'Manual · 手动选型'};
  const language = (new URLSearchParams(window.location.search).get('lang') || 'de').toLowerCase().split('-')[0];
  const link = document.getElementById('manual-link');
  document.documentElement.lang = language === 'zh' ? 'zh-Hans' : (Object.hasOwn(labels, language) ? language : 'de');
  link.textContent = labels[language] || labels.de; link.href = target;
  window.location.replace(target);
})();
</script>
<noscript><p>Manual: <a href="/manual/konfigurator-v1.html?lang=de">Deutsch</a> · <a href="/manual/konfigurator-v1.html?lang=it">Italiano</a> · <a href="/manual/konfigurator-v1.html?lang=sl">Slovenščina</a> · <a href="/manual/konfigurator-v1.html?lang=en">English</a> · <a href="/manual/konfigurator-v1.html?lang=zh">中文</a></p></noscript>
</body></html>
'''

def build():
    research=Q/'werkstoffe-recherche.json'
    if research.exists() and (Q/'werkstoffe_bauen.py').exists():
        spec=importlib.util.spec_from_file_location('materialbuild',Q/'werkstoffe_bauen.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);module.build()
    build_i18n()
    norms=[]
    for file in sorted((Q/'normen').glob('*.json')):
        value=json.loads(file.read_text(encoding='utf-8-sig'))
        if isinstance(value,dict) and value.get('id') and 'groessen' in value:
            norms.append(value)
    norm_library={'schemaVersion':1,'version':'2026-11-26','families':norms,'threads':json.loads((Q/'normen/gewinde.json').read_text(encoding='utf-8')),'materials':json.loads((Q/'vorbelegung/werkstoff.json').read_text(encoding='utf-8'))}
    (Q/'normen/index.json').write_text(json.dumps({'schemaVersion':1,'version':norm_library['version'],'families':[{'id':n['id'],'edition':n.get('edition'),'file':n['id']+'.json','sizes':len(n.get('groessen',{}))} for n in norms]},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    engine=embed_defaults((Q/'engine.js').read_text(encoding='utf-8-sig'),'RM_PRESETS','vorbelegung/rm.json')
    engine=embed_defaults((Q/'nut-model.js').read_text(encoding='utf-8'),'NUT_THREADS','normen/gewinde.json')+'\n'+engine
    replacements={
        '/*DATEN*/':json.dumps(json.loads((Q/'maschinen.json').read_text(encoding='utf-8-sig')),ensure_ascii=False,separators=(',',':')),
        '/*PRAXIS*/':json.dumps(json.loads((Q/'praxis.json').read_text(encoding='utf-8-sig')),ensure_ascii=False,separators=(',',':')),
        '/*ENGINE*/':engine,
        '/*CONCEPT_UI*/':(Q/'concept-ui.js').read_text(encoding='utf-8-sig'),
        '/*ANSWER_FORMAT*/':(Q/'answer-format.js').read_text(encoding='utf-8-sig'),
        '/*I18N*/':(Q/'i18n.js').read_text(encoding='utf-8-sig'),
        '/*I18N_BROWSER*/':(Q/'i18n-browser.js').read_text(encoding='utf-8-sig')
    }
    for source,target,ui,token in [('vorlage.html','index.html','ui.js','/*UI*/'),('archiv-vorlage.html','manual/konfigurator-v1.html','archiv-ui.js','/*ARCHIVE_UI*/')]:
        text=(Q/source).read_text(encoding='utf-8-sig')
        values={**replacements,token:(Q/ui).read_text(encoding='utf-8-sig')}
        if source == 'vorlage.html':
            values['/*PROGRAMME_CSS*/']=(Q/'programm.css').read_text(encoding='utf-8')
            values['<!--PROGRAMME_SECTION-->']=(Q/'programm.html').read_text(encoding='utf-8')
        if source == 'archiv-vorlage.html':
            values['/*DRAWING_PREVIEW*/']=(Q/'drawing-preview.js').read_text(encoding='utf-8-sig')
            values['/*GEOMETRY_MODEL*/']=(Q/'geometry-model.js').read_text(encoding='utf-8-sig')
            values['/*GEOMETRY_WIZARD*/']=(Q/'geometry-wizard.js').read_text(encoding='utf-8-sig')
            values['/*AXIAL_CHAIN*/']='\n'.join((Q/file).read_text(encoding='utf-8') for file in ['axial-chain.js','axial-chain-ui.js','normen/to-chain.js'])+'\nwindow.JY_CHAIN_TEMPLATES='+json.dumps([json.loads(p.read_text(encoding='utf-8')) for p in sorted((Q/'vorlagen').glob('*.json'))],ensure_ascii=False,separators=(',',':')).replace('</','<\\/')+';'
            values['/*STANDARD_FAMILIES*/']=(Q/'standard-families.js').read_text(encoding='utf-8-sig')
            values['/*NORM_LIBRARY*/']='window.JY_NORM_DATA='+json.dumps(norm_library,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')+';\n'+'\n'.join((Q/'normen'/file).read_text(encoding='utf-8') for file in ['resolver.js','library.js','ui.js'])
            values['/*WIRE_DEFAULTS*/']=embed_defaults((Q/'vorbelegung/draht.js').read_text(encoding='utf-8-sig'),'WIRE_PRESETS','vorbelegung/draht.json')
        for key,value in values.items():
            assert key in text,(source,key)
            text=text.replace(key,value)
        (Q.parent/target).parent.mkdir(parents=True,exist_ok=True)
        (Q.parent/target).write_text(text,encoding='utf-8')
        print(target,len(text.encode('utf-8')),'bytes')
    for target in ['archiv/konfigurator-v1.html','manual/index.html']:
        (Q.parent/target).parent.mkdir(parents=True,exist_ok=True)
        (Q.parent/target).write_text(manual_redirect(),encoding='utf-8')
    not_found=(Q/'404-vorlage.html').read_text(encoding='utf-8')
    for key in ['/*I18N*/','/*I18N_BROWSER*/']:not_found=not_found.replace(key,replacements[key])
    (Q.parent/'404.html').write_text(not_found,encoding='utf-8')
if __name__=='__main__':build()
