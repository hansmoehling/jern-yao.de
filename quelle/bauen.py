from pathlib import Path
import json,importlib.util
Q=Path(__file__).resolve().parent

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

def build():
    research=Q/'werkstoffe-recherche.json'
    if research.exists() and (Q/'werkstoffe_bauen.py').exists():
        spec=importlib.util.spec_from_file_location('materialbuild',Q/'werkstoffe_bauen.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);module.build()
    build_i18n()
    replacements={
        '/*DATEN*/':json.dumps(json.loads((Q/'maschinen.json').read_text(encoding='utf-8-sig')),ensure_ascii=False,separators=(',',':')),
        '/*PRAXIS*/':json.dumps(json.loads((Q/'praxis.json').read_text(encoding='utf-8-sig')),ensure_ascii=False,separators=(',',':')),
        '/*ENGINE*/':(Q/'engine.js').read_text(encoding='utf-8-sig'),
        '/*CONCEPT_UI*/':(Q/'concept-ui.js').read_text(encoding='utf-8-sig'),
        '/*I18N*/':(Q/'i18n.js').read_text(encoding='utf-8-sig'),
        '/*I18N_BROWSER*/':(Q/'i18n-browser.js').read_text(encoding='utf-8-sig')
    }
    for source,target,ui,token in [('vorlage.html','index.html','ui.js','/*UI*/'),('archiv-vorlage.html','archiv/konfigurator-v1.html','archiv-ui.js','/*ARCHIVE_UI*/')]:
        text=(Q/source).read_text(encoding='utf-8-sig')
        values={**replacements,token:(Q/ui).read_text(encoding='utf-8-sig')}
        for key,value in values.items():
            assert key in text,(source,key)
            text=text.replace(key,value)
        (Q.parent/target).write_text(text,encoding='utf-8')
        print(target,len(text.encode('utf-8')),'bytes')
    not_found=(Q/'404-vorlage.html').read_text(encoding='utf-8')
    for key in ['/*I18N*/','/*I18N_BROWSER*/']:not_found=not_found.replace(key,replacements[key])
    (Q.parent/'404.html').write_text(not_found,encoding='utf-8')
if __name__=='__main__':build()
