(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.JYI18N=api;})(typeof window==='object'?window:typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const catalog=/*CATALOG*/;
const supported=['de','it','sl','en','zh'];
const locales={de:'de-DE',it:'it-IT',sl:'sl-SI',en:'en-GB',zh:'zh-CN'};
const patterns={};
const escaped=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const templates=Object.keys(catalog).filter(key=>/\{[A-Za-z][A-Za-z0-9_]*\}/.test(key)).map(key=>{
 const names=[];let at=0,pattern='^';
 for(const match of key.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)){pattern+=escaped(key.slice(at,match.index))+'([\\s\\S]+?)';names.push(match[1]);at=match.index+match[0].length;}
 return {key,names,pattern:new RegExp(pattern+escaped(key.slice(at))+'$','u')};
}).sort((a,b)=>b.key.replace(/\{[^}]+\}/g,'').length-a.key.replace(/\{[^}]+\}/g,'').length);
const normalizeLanguage=value=>{const s=String(value||'').toLowerCase().replace('_','-').split('-')[0];return supported.includes(s)?s:'de';};
const normal=s=>s.replace(/\s+/g,' ').trim();
function t(value,language='de'){
 if(value===null||value===undefined)return '';
 const text=String(value),lang=normalizeLanguage(language);
 if(lang==='de'||!text)return text;
 const index=supported.indexOf(lang)-1,key=normal(text);
 if(catalog[key])return text.match(/^\s*/)[0]+catalog[key][index]+text.match(/\s*$/)[0];
 for(const template of templates){
  const match=template.pattern.exec(text.trim());if(!match)continue;
  const values=Object.fromEntries(template.names.map((name,i)=>[name,match[i+1]]));
  return catalog[template.key][index].replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g,(_,name)=>['field','feature','operation','location'].includes(name)?t(values[name]||'',lang):(values[name]||''));
 }
 if(!patterns[lang]){
  const keys=Object.keys(catalog).filter(key=>!key.includes('{')).sort((a,b)=>b.length-a.length).map(escaped);
  patterns[lang]=new RegExp('(?<![\\p{L}\\p{N}_])(?:'+keys.join('|')+')(?![\\p{L}\\p{N}_])','gu');
 }
 return text.replace(patterns[lang],match=>catalog[match][index]);
}
return {t,normalizeLanguage,supported,htmlLang:l=>normalizeLanguage(l)==='zh'?'zh-Hans':normalizeLanguage(l),numberLocale:l=>locales[normalizeLanguage(l)],catalog};
});
