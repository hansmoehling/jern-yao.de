const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=require('../i18n.js'),extra=require('../i18n-geometry-wizard.json');
const languages=['de','it','sl','en','zh'];
const I={...base,t:(key,language)=>language!=='de'&&extra[key]?extra[key][languages.indexOf(language)-1]:base.t(key,language)};
const sandbox={window:{JYI18N:I}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../concept-ui.js'),'utf8'),sandbox);
test('unassigned and incomplete sequences say operation in five languages; assigned candidate stations remain stages',()=>{
 for(const language of languages){
  const stage={number:1,operation:'Example',kind:'single'};
  const assigned=sandbox.window.JYConcept.html({status:'candidate',stages:[stage]},language);
  assert(assigned.includes(I.t('Stadium',language)+' 1:'));assert(!assigned.includes(I.t('Arbeitsschritt',language)+' 1:'));
  for(const concept of [{status:'incomplete',stages:[stage]},{status:'candidate',stages:[{...stage,kind:'unassigned'}]}]){
   const html=sandbox.window.JYConcept.html(concept,language);assert(html.includes(I.t('Arbeitsschritt',language)+' 1:'));assert(!html.includes(I.t('Stadium',language)+' 1:'));
  }
 }
});
