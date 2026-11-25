const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),I=require('../i18n.js');

test('legacy archive and short Manual routes preserve language, query and fragment on the same site',()=>{
 for(const route of ['archiv/konfigurator-v1.html','manual/index.html']){
  const html=fs.readFileSync(path.join(root,route),'utf8');
  assert(Buffer.byteLength(html)<4096,'redirect stays a small link, not a second application');
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for(const language of I.supported){
   const search='?lang='+language+'&source=old%20link&return=https%3A%2F%2Fexample.invalid',hash='#teil';
   const link={},document={documentElement:{},getElementById:id=>{assert.equal(id,'manual-link');return link}};
   let replaced;
   const window={location:{search,hash,replace:value=>{replaced=value}}};
   vm.runInNewContext(script,{window,document,URLSearchParams});
   assert.equal(replaced,'/manual/konfigurator-v1.html'+search+hash);
   assert.equal(link.href,replaced);assert.equal(link.textContent,I.t('Manual · Manuelle Auslegung',language));
   assert.equal(document.documentElement.lang,I.htmlLang(language));
  }
 }
});

test('Manual is the built application and five-language navigation uses its new public path',()=>{
 const main=fs.readFileSync(path.join(root,'index.html'),'utf8'),manual=fs.readFileSync(path.join(root,'manual/konfigurator-v1.html'),'utf8');
 assert(main.includes('data-language-link href="/manual/konfigurator-v1.html">Manual · Manuelle Auslegung</a>'));
 assert(!main.includes('href="/archiv/konfigurator-v1.html"'));
 assert(manual.includes('<title>Expertenkonfigurator · Jern Yao</title>'));
 assert(manual.includes('<h1>Expertenkonfigurator</h1>'));
 assert(manual.includes('name="iTyp"'),'the real interactive sizing form was built');
 for(const language of I.supported){
  for(const key of ['Manual · Manuelle Auslegung','Expertenkonfigurator','Expertenkonfigurator · Jern Yao']){
   if(language!=='de')assert.notEqual(I.t(key,language),key);
  }
 }
});

test('renaming the application does not alter either original historical archive',()=>{
 const originals={
  'archiv/konfigurator-v1-original-6ef51db.html':'e30299cd6e75976008c1a01213025238061c9817578f9e018e7a431e677e036b',
  'archiv/stand-beim-abruf.html':'44079f7b8fdd3bb1a38f0d04c23371190e507154fbf1f7dae74ebfaaa9cbd05e'
 };
 // Git normalizes these text files to LF; Windows checkouts may use CRLF.
 for(const [file,digest]of Object.entries(originals))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')).digest('hex'),digest,file);
});
