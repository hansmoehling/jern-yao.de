(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.JYKvpUI=api;})(typeof window==='object'?window:globalThis,function(root){
  'use strict';
  let nextId=0;
  const CLASSES=['schraube','niet','bolzen','mutter','formteil'];
  const TOPOLOGIES=['kopf-schaft','kopf-schaft-napf','stufenkoerper','huelse','ring','mutter-durchgang','mutter-sackloch','massiv','unbekannt'];
  const MATERIALS=['unlegiert-weich','borstahl','legiert-weich','rostfrei','kupfer','messing','aluminium','unbekannt'];
  const LIMITS={d0:[0.1,100],L0_d0:[0,100],kopfvolumenanteil:[0,1],stauch_h0_d0_max:[0,100],napf_t_d:[0,100],reduktion_max:[0,1],rm:[1,5000],restwand_d:[0,10],stempelpressung:[0,100000]};
  const FEEDBACK=[['','Bitte Rückmeldung auswählen'],['passt','Stadienfolge passt'],['zu_viele_stadien','Zu viele Stadien'],['zu_wenige_stadien','Zu wenige Stadien'],['andere_reihenfolge','Andere Reihenfolge']];
  const OUTCOMES={laeuft:'Betrieb bestätigt',laeuft_mit_muehe:'Betrieb mit Einschränkungen',nicht_machbar:'Dokumentierter Fehlversuch',nur_konzept:'Bestätigter Konzeptfall'};
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const count=x=>Number.isInteger(x)&&x>=1&&x<=20;
  function projectContext(raw){
    if(!object(raw)||!['manual','drawing','structured_geometry'].includes(raw.source)||!object(raw.features)||!object(raw.features.merkmale))return null;
    const f=raw.features;if(!CLASSES.includes(f.klasse)||!TOPOLOGIES.includes(f.topologie))return null;
    const merkmale={};
    for(const [key,[min,max]]of Object.entries(LIMITS))if(Object.hasOwn(f.merkmale,key)){
      const v=f.merkmale[key];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)return null;merkmale[key]=v;
    }
    if(!Object.keys(merkmale).length)return null;
    if(Object.hasOwn(f.merkmale,'werkstoffgruppe')){if(!MATERIALS.includes(f.merkmale.werkstoffgruppe))return null;merkmale.werkstoffgruppe=f.merkmale.werkstoffgruppe;}
    if(raw.predictedStages!=null&&!count(raw.predictedStages))return null;
    return {source:raw.source,features:{klasse:f.klasse,topologie:f.topologie,merkmale},...(raw.predictedStages!=null?{predictedStages:raw.predictedStages}:{})};
  }

  function create({host,endpoint,tr=value=>value,getContext}={}){
    if(!host?.ownerDocument||typeof getContext!=='function'||typeof endpoint!=='string'||!endpoint.trim())throw new TypeError('KVP host, API base and context callback required');
    const doc=host.ownerDocument,view=doc.defaultView||root;
    const base=new URL(endpoint,view.location?.href||'https://jern-yao.de/');
    if(!['https:','http:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)throw new TypeError('KVP endpoint must be an API base URL');
    const url=base.href.replace(/\/+$/,''),id='jy-kvp-'+(++nextId),labels=[];
    const text=(key,params={})=>String(tr(key)).replace(/\{(\w+)\}/g,(match,name)=>Object.hasOwn(params,name)?String(params[name]):match);
    const el=(tag,key,attrs={})=>{const n=doc.createElement(tag);Object.assign(n,attrs);if(key){labels.push([n,key]);n.textContent=text(key);}return n;};
    const section=el('section',null,{className:'kvp-panel'});section.setAttribute('aria-label',text('Erfahrungen und Rückmeldung'));
    const heading=el('h3','Erfahrungen und Rückmeldung');section.append(heading);
    const lookup=el('button','Ähnliche bestätigte Erfahrungen abfragen',{type:'button',className:'knopf zwei'});lookup.dataset.kvpAction='experience';section.append(lookup);
    const experienceStatus=el('p',null,{className:'kvp-status'}),experienceList=el('ul',null,{className:'kvp-cases'});
    experienceStatus.setAttribute('role','status');experienceStatus.setAttribute('aria-live','polite');section.append(experienceStatus,experienceList);
    const fieldset=el('fieldset');fieldset.append(el('legend','Rückmeldung zur Stadienfolge'));
    const consentLabel=el('label',null,{className:'kvp-consent'}),consent=el('input',null,{type:'checkbox',checked:false,id:id+'-consent'});
    consent.dataset.kvpField='consent';consentLabel.append(consent,el('span','Anonyme technische Rückmeldung erlauben'));fieldset.append(consentLabel);
    const privacy=el('p','Nur technische Merkmale speichern; keine Zeichnung, Namen oder Kontaktdaten.',{id:id+'-privacy'});consent.setAttribute('aria-describedby',privacy.id);fieldset.append(privacy);
    const choiceLabel=el('label',null,{className:'feld'}),choice=el('select',null,{id:id+'-feedback'});choice.dataset.kvpField='feedback';choiceLabel.append(el('span','Rückmeldung'),choice);
    for(const [value,key]of FEEDBACK)choice.append(el('option',key,{value}));choice.value='';fieldset.append(choiceLabel);
    const countLabel=el('label',null,{className:'feld'}),actual=el('input',null,{type:'number',min:'1',max:'20',step:'1',value:'',id:id+'-actual'});actual.dataset.kvpField='actualStages';countLabel.append(el('span','Tatsächliche Stadienzahl (optional)'),actual);fieldset.append(countLabel);
    const countError=el('p',null,{id:id+'-count-error'});actual.setAttribute('aria-describedby',countError.id);fieldset.append(countError);
    const send=el('button','Rückmeldung senden',{type:'button',className:'knopf',disabled:true});send.dataset.kvpAction='send';fieldset.append(send);
    const feedbackStatus=el('p',null,{className:'kvp-status'});feedbackStatus.setAttribute('role','status');feedbackStatus.setAttribute('aria-live','polite');fieldset.append(feedbackStatus);
    section.append(fieldset);host.replaceChildren(section);
    let snapshot=null,identity=null,generation=0,sent=null;
    let feedbackMessage=null,experienceMessage=['Erfahrungen werden nur auf Wunsch abgefragt.'],caseRows=[];
    const requests={feedback:null,experience:null};
    const language=()=>{const value=view.JYLocale?.language||doc.documentElement?.lang||'de';return ['de','it','sl','en','zh'].includes(value)?value:'de';};
    const actualCount=()=>actual.value.trim()===''?undefined:/^[1-9]\d?$/.test(actual.value.trim())&&count(Number(actual.value))?Number(actual.value):null;
    const payload=()=>snapshot&&({...snapshot,optIn:true,feedback:choice.value,...(actualCount()!==undefined?{actualStages:actualCount()}:{})});
    function paint(){
      for(const [node,key]of labels)node.textContent=text(key);
      section.setAttribute('aria-label',text('Erfahrungen und Rückmeldung'));
      feedbackStatus.textContent=feedbackMessage?text(...feedbackMessage):'';
      experienceStatus.textContent=experienceMessage?text(...experienceMessage):'';
      countError.textContent=actualCount()===null?text('Bitte eine ganze Stadienzahl von 1 bis 20 angeben.'):'';
      actual.setAttribute('aria-invalid',actualCount()===null?'true':'false');
      feedbackStatus.setAttribute('role',feedbackMessage?.[0]==='Rückmeldung konnte nicht gespeichert werden. Bitte erneut versuchen.'?'alert':'status');
      experienceList.replaceChildren(...caseRows.map(row=>{const node=el('li');node.textContent=text('Fall {id}: {stages} Stadien – {outcome}',{id:row.id,stages:row.stages,outcome:text(OUTCOMES[row.status])});return node;}));
      lookup.disabled=!snapshot||Boolean(requests.experience);
      consent.disabled=choice.disabled=actual.disabled=Boolean(requests.feedback);
      send.disabled=!snapshot||!consent.checked||!FEEDBACK.some(([v])=>v&&v===choice.value)||actualCount()===null||Boolean(requests.feedback)||sent===JSON.stringify(payload());
    }
    function cancel(){for(const key of Object.keys(requests)){requests[key]?.controller?.abort();requests[key]=null;}}
    function refresh({reset=false}={}){
      let raw;try{raw=getContext();}catch{raw=null;}
      const next=projectContext(raw),key=JSON.stringify({context:next,model:typeof raw?.selectedModel==='string'?raw.selectedModel:null});
      if(reset||key!==identity){
        generation++;cancel();identity=key;snapshot=next;sent=null;consent.checked=false;choice.value='';actual.value='';caseRows=[];
        feedbackMessage=null;experienceMessage=[next?'Erfahrungen werden nur auf Wunsch abgefragt.':'Für dieses Ergebnis fehlen noch vergleichbare technische Merkmale.'];
      }else snapshot=next;
      paint();
    }
    async function post(kind,body){
      const Controller=view.AbortController||root.AbortController,controller=Controller?new Controller():null;
      const ticket={generation,controller};requests[kind]=ticket;paint();
      const timer=(view.setTimeout||setTimeout)(()=>controller?.abort(),30000);
      try{
        const response=await view.fetch(url+(kind==='feedback'?'/rueckmeldung':'/erfahrung'),{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',referrerPolicy:'no-referrer',body:JSON.stringify({featureVersion:'kvp-v1',language:language(),...body}),...(controller?{signal:controller.signal}:{})});
        if(!response.ok)throw new Error('request_failed');
        const result=await response.json();
        if(ticket.generation!==generation||requests[kind]!==ticket)return;
        if(kind==='feedback'){
          if(result?.accepted!==true||result.status!=='ungeprueft'||result.knowledgeEligible!==false)throw new Error('confirmation_missing');
          sent=JSON.stringify(body);consent.checked=false;feedbackMessage=['Rückmeldung gespeichert – noch ungeprüft.'];
        }else{
          if(!['ready','missing','pending-approval'].includes(result?.status)||!Array.isArray(result.cases))throw new Error('experience_invalid');
          caseRows=result.status==='ready'?result.cases.slice(0,5).filter(c=>/^F-\d{4,8}$/.test(c?.id)&&Array.isArray(c.stadien)&&count(c.stadien.length)&&Object.hasOwn(OUTCOMES,c.ergebnis?.status)).map(c=>({id:c.id,stages:c.stadien.length,status:c.ergebnis.status})):[];
          experienceMessage=[caseRows.length?'Bestätigte Vergleichsfälle: {count}':'Noch keine bestätigten Vergleichsfälle verfügbar.',{count:caseRows.length}];
        }
      }catch{
        if(ticket.generation===generation&&requests[kind]===ticket){
          if(kind==='feedback')feedbackMessage=['Rückmeldung konnte nicht gespeichert werden. Bitte erneut versuchen.'];
          else{caseRows=[];experienceMessage=['Erfahrungen konnten nicht geladen werden. Bitte erneut versuchen.'];}
        }
      }finally{
        (view.clearTimeout||clearTimeout)(timer);
        if(requests[kind]===ticket){requests[kind]=null;paint();}
      }
    }
    consent.addEventListener('change',paint);choice.addEventListener('change',paint);actual.addEventListener('input',paint);
    send.addEventListener('click',async()=>{
      refresh();if(send.disabled)return;
      feedbackMessage=['Rückmeldung wird gesendet …'];await post('feedback',payload());
    });
    lookup.addEventListener('click',async()=>{
      refresh();if(lookup.disabled)return;
      experienceMessage=['Bestätigte Erfahrungen werden geladen …'];await post('experience',{features:snapshot.features,k:3});
    });
    refresh();
    return Object.freeze({refresh});
  }
  return Object.freeze({create});
});
