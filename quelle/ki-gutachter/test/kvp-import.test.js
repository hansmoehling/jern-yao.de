import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {importKvp,parseCsv,CASE_COLUMNS} from '../../wissen/import_kvp.mjs';
import {similarCases,experienceBand,calibrationProposal,weightProposal,monthlyReport,experience} from '../src/kvp.js';

const directory=new URL('../../wissen/kvp-beispiel/',import.meta.url);
const examples=()=>({casesCsv:readFileSync(new URL('faelle.csv',directory),'utf8'),stagesCsv:readFileSync(new URL('stadien.csv',directory),'utf8'),version:'kvp-beispiel-v1'});
const approved={schemaVersion:1,version:'reviewed-test',freigegeben:true,freigabe:{von:'Hans',am:'2026-11-27'}};
const features=c=>({klasse:c.klasse,topologie:c.topologie,merkmale:c.merkmale});
function realInput(){
  const input=examples();
  input.casesCsv=input.casesCsv.replaceAll('SYN-','F-').replaceAll(';ja;',';nein;').replace(/;synthetisch(?=\r?\n|$)/g,';stadienplan').replaceAll(';nur_konzept;',';laeuft;');
  input.stagesCsv=input.stagesCsv.replaceAll('SYN-','F-');return input;
}
test('the two public examples reproduce the manifest and remain explicitly synthetic',()=>{
  const result=importKvp(examples()),stored=JSON.parse(readFileSync(new URL('manifest.json',directory),'utf8'));
  assert.deepEqual(result,stored);assert.equal(result.cases.length,2);
  assert.deepEqual(result.cases.map(c=>c.id),['SYN-0001','SYN-0002']);
  assert.equal(result.cases[0].merkmale.d0,5.6);assert.equal(result.cases[0].merkmale.L0_d0,43/5.6);
  for(const c of [result,...result.cases]){assert.equal(c.synthetic,true);assert.equal(c.freigegeben,false);assert.equal(c.knowledgeEligible,false);assert.equal(c.freigabe,null);}
  for(const c of result.cases){assert.equal(c.ergebnis.status,'nur_konzept');assert.equal(c.ergebnis.hubzahl_min,undefined);assert.ok(c.stadien.every(s=>s.kennzahlen.kraft_gemessen_kN===undefined));}
});
test('real imports retain dimensions and measured units but never create an approval',()=>{
  const input=realInput();
  input.casesCsv=input.casesCsv.replace(';3;;;;;stadienplan',';3;95;100;95;pieces-per-minute;stadienplan');
  input.stagesCsv=input.stagesCsv.replace('Vorstauchen Kopf;2,2;;;;;;','Vorstauchen Kopf;2,2;;;;;100;120');
  const result=importKvp(input),c=result.cases[0];
  assert.equal(c.synthetic,false);assert.equal(c.knowledgeEligible,false);assert.equal(c.freigabe,null);
  assert.deepEqual(c.throughput,{planned:100,measured:95,plannedBasis:'pieces-per-minute',measuredBasis:'pieces-per-minute'});
  assert.equal(c.stadien[1].kennzahlen.kraft_gemessen_kN,120);assert.equal(c.stadien[1].kennzahlen.kraft_gerechnet_kN,100);
  assert.deepEqual(c.importEvidence.blank,{diameter_mm:5.6,length_mm:43});
  assert.equal(similarCases(c,result.cases,{manifest:approved}).length,0);
  const reviewed={...c,knowledgeEligible:true,freigegeben:true,freigabe:approved.freigabe};
  assert.equal(similarCases(c,[reviewed],{manifest:approved}).length,1);
});
test('CSV parsing handles BOM, decimal comma, quoting and CRLF without accepting extra columns',()=>{
  assert.deepEqual(parseCsv('\uFEFFfall_id;klasse\r\n"F-0001";"schraube"\r\n',CASE_COLUMNS,['fall_id','klasse']),[{fall_id:'F-0001',klasse:'schraube'}]);
  for(const text of ['fall_id;fall_id\nF-0001;F-0001','fall_id;email\nF-0001;private@example.test','fall_id\n"unterminated','fall_id\n"F-0001"oops','fall_id\nF-0001;extra'])assert.throws(()=>parseCsv(text,CASE_COLUMNS,['fall_id']),/csv_/);
});
test('duplicates, station gaps and unknown case links fail instead of inflating the evidence',()=>{
  const input=realInput();
  assert.throws(()=>importKvp({...input,casesCsv:input.casesCsv+input.casesCsv.split('\n')[1]+'\n'}),/duplicate_case/);
  assert.throws(()=>importKvp({...input,stagesCsv:input.stagesCsv+input.stagesCsv.split('\n')[1]+'\n'}),/duplicate_stage/);
  assert.throws(()=>importKvp({...input,stagesCsv:input.stagesCsv.replace('F-0001;1;','F-0999;1;')}),/orphan_stage/);
  assert.throws(()=>importKvp({...input,stagesCsv:input.stagesCsv.split('\n').filter(line=>!line.startsWith('F-0001;2;')).join('\n')}),/learning_stage/);
});
test('numbers, result codes, model names and throughput require unambiguous typed data',()=>{
  const input=realInput();
  for(const [from,to]of [[';5,6;',';NaN;'],[';5,6;',';0;'],[';5,6;',';=5+1;'],[';430;',';430 N/mm2;'],[';JBF-10B3S;',';unknown-model;'],[';laeuft;',';looks good;']])assert.throws(()=>importKvp({...input,casesCsv:input.casesCsv.replace(from,to)}));
  assert.throws(()=>importKvp({...input,casesCsv:input.casesCsv.replace(';3;;;;;stadienplan',';3;;100;;;stadienplan')}),/throughput_incomplete/);
  assert.throws(()=>importKvp({...examples(),casesCsv:examples().casesCsv.replace(';nur_konzept;',';laeuft;')}),/synthetic_outcome/);
  assert.throws(()=>importKvp({...input,casesCsv:input.casesCsv.replace(';nein;',';ja;')}),/case_id/);
});
test('synthetic cases cannot reach retrieval, bands, calibration or monthly statistics even with an accidental approval',async()=>{
  const examplesManifest=importKvp(examples()),raw=examplesManifest.cases[0];
  const cases=Array.from({length:6},(_,i)=>({...raw,id:'F-'+String(i+1).padStart(4,'0'),freigegeben:true,knowledgeEligible:true,freigabe:approved.freigabe,ergebnis:{status:'laeuft'},stadien:[{nr:1,operation:'Planstauchen',kennzahlen:{kraft_gerechnet_kN:100,kraft_gemessen_kN:120}}]}));
  assert.equal(similarCases(raw,cases,{manifest:approved}).length,0);
  assert.equal(experienceBand(raw,cases,{manifest:approved,metric:'stauch_h0_d0_max',literatureValue:2}).n,0);
  assert.deepEqual(calibrationProposal(cases,{manifest:approved}).force,[]);
  assert.equal(monthlyReport(cases,[],[],{manifest:approved,month:'2026-11'}).approvedCases,0);
  const env={SPEICHER:{async get(){return JSON.stringify({...approved,cases});}}};
  assert.equal((await experience(env,{features:features(raw)})).cases.length,0);
  const syntheticSnapshot={...examplesManifest,freigegeben:true,knowledgeEligible:true,freigabe:approved.freigabe};
  const envSynthetic={SPEICHER:{async get(){return JSON.stringify(syntheticSnapshot);}}};
  assert.equal((await experience(envSynthetic,{features:features(raw)})).status,'pending-approval');
});
test('synthetic decisions and bands never become approved learning',async()=>{
  const q=importKvp(examples()).cases[0];
  const decision={id:'D-0001',synthetic:true,freigegeben:true,freigabe:approved.freigabe};
  assert.equal(weightProposal([decision],{manifest:approved}).n,0);
  const band={synthetic:true,freigegeben:true,freigabe:approved.freigabe,context:q,metric:'stauch_h0_d0_max',lower:1,upper:3,literatureValue:2,n:5};
  const env={SPEICHER:{async get(){return JSON.stringify({...approved,cases:[],bands:[band]});}}};
  assert.deepEqual((await experience(env,{features:features(q)})).bands,[]);
});
test('a separate synthetic case container and synthetic feedback stay out of experience and reports',async()=>{
  const c={...importKvp(realInput()).cases[0],freigegeben:true,knowledgeEligible:true,freigabe:approved.freigabe};
  const values=new Map([
    ['kvp:manifest:kvp-v1',JSON.stringify({...approved,casesKey:'kvp:cases:'+approved.version})],
    ['kvp:cases:'+approved.version,JSON.stringify({schemaVersion:1,version:approved.version,synthetic:true,cases:[c]})]
  ]);
  assert.equal((await experience({SPEICHER:{async get(key){return values.get(key);}}},{features:features(c)})).status,'pending-approval');
  const feedback={optIn:true,source:'manual',features:features(c),feedback:'passt',recordedOn:'2026-11-27'};
  for(const marker of [{synthetic:true},{recordType:'synthetic-example'},{id:'SYN-0001'}]){
    const report=monthlyReport([],[],[{...feedback,...marker},feedback],{manifest:approved,month:'2026-11'});
    assert.deepEqual(report.feedback,{n:1,counts:{passt:1}},'normal unreviewed feedback remains countable');
  }
});
test('CLI emits only the draft on stdout and produces no partial JSON for a failed import',()=>{
  const script=fileURLToPath(new URL('../../wissen/import_kvp.mjs',import.meta.url));
  const args=[script,fileURLToPath(new URL('faelle.csv',directory)),fileURLToPath(new URL('stadien.csv',directory)),'kvp-beispiel-v1'];
  const ok=spawnSync(process.execPath,args,{encoding:'utf8'});
  assert.equal(ok.status,0,ok.stderr);assert.deepEqual(JSON.parse(ok.stdout),importKvp(examples()));assert.equal(ok.stderr,'');
  const bad=spawnSync(process.execPath,[...args,'--approve'],{encoding:'utf8'});
  assert.equal(bad.status,1);assert.equal(bad.stdout,'');assert.match(bad.stderr,/KVP-Import abgebrochen/);
});
