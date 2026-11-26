(function(){
'use strict';
const I=window.JYI18N;
let remembered='de';try{remembered=localStorage.getItem('jy-language')||localStorage.getItem('jy-lang')||'de';}catch(_){}
const url=new URL(window.location.href);
let language=I.normalizeLanguage(url.searchParams.get('lang')||remembered);
const sources=new WeakMap(),attributes=new WeakMap();
const autonyms={de:'Deutsch',it:'Italiano',sl:'Slovenščina',en:'English',zh:'简体中文'};
function sourceFor(node,value,map){const old=map.get(node);if(!old||value!==old.last){const next={source:I.source?I.source(value):value,last:value};map.set(node,next);return next;}return old;}
function apply(root=document.documentElement){
 document.documentElement.lang=I.htmlLang(language);
 const visit=node=>{
  if(node.nodeType===3){
   const parent=node.parentElement;
   if(!parent||parent.closest('script,style,textarea,.notranslate,[data-original-text],.message-text,.answer-text'))return;
   const record=sourceFor(node,node.nodeValue,sources);
   if(parent.dataset.jySource!==undefined)record.source=parent.dataset.jySource;
   const translated=I.t(record.source,language);
   if(node.nodeValue!==translated)node.nodeValue=translated;record.last=translated;return;
  }
  if(node.nodeType!==1&&node.nodeType!==9)return;
  if(node.nodeType===1){
   if(node.hasAttribute('data-language'))node.setAttribute('aria-pressed',String(node.getAttribute('data-language')===language));
   if(node.matches('script,style,.notranslate,[data-original-text],.message-text,.answer-text'))return;
   for(const key of ['placeholder','aria-label','title','alt','data-question']){
    if(node.hasAttribute(key)){
     let map=attributes.get(node);if(!map){map={};attributes.set(node,map);}
     const value=node.getAttribute(key);if(!map[key]||value!==map[key].last)map[key]={source:I.source?I.source(value):value,last:value};
     const translated=I.t(map[key].source,language);if(value!==translated)node.setAttribute(key,translated);map[key].last=translated;
    }
   }
   if(node.matches('meta[name="description"]')){
    const record=sourceFor(node,node.content,sources);node.content=I.t(record.source,language);record.last=node.content;
   }
   if(node.matches('a[data-language-link]')){
    const target=new URL(node.getAttribute('href'),window.location.href);target.searchParams.set('lang',language);node.setAttribute('href',target.pathname+target.search+target.hash);
   }
   if(node.hasAttribute('data-language'))node.setAttribute('aria-pressed',String(node.getAttribute('data-language')===language));
  }
  Array.from(node.childNodes||[]).forEach(visit);
 };
 visit(root);
}
function setLanguage(value){
 language=I.normalizeLanguage(value);try{localStorage.setItem('jy-language',language);localStorage.setItem('jy-lang',language);}catch(_){}
 const current=new URL(window.location.href);current.searchParams.set('lang',language);try{window.history.replaceState(null,'',current.href);}catch(_){}
 apply();window.dispatchEvent(new CustomEvent('jy-languagechange',{detail:{language}}));
}
window.JYLocale={get language(){return language;},t:text=>I.t(text,language),apply,setLanguage,autonyms};
document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>setLanguage(button.dataset.language)));
apply();
let scheduled=false;
new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;apply();});}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
