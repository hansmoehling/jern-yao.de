(function () {
  'use strict';
  const L=window.JYLocale,tr=text=>L.t(text),escape=value=>String(value??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let apiBase='';
  try{const url=new URL(window.JY_API_BASE||'',window.location.href);if(window.JY_API_BASE&&(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))apiBase=url.href.replace(/\/$/,'');}catch(_){/* Keep unavailable configuration visible. */}
  const uuid=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,'0')).join('');
  // Three 240-second worker attempts plus retry delays and queue/HTTP overhead.
  const POLL_BUDGET_MS=20*60*1000;
  function validationMessage(data){
    if(!Array.isArray(data?.issues))return '';
    const known={inline_drawing_diameters:'Walzdraht-Ø vor dem Vorzug muss größer als der Draht-Ø an der Presse sein',curve_state_mismatch:'Lieferzustand passt nicht zur ausgewählten Fließkurve',curve_not_for_material:'Kein belegter Fließkurvenansatz für diesen Werkstoff',unknown_material:'Werkstoff aus der Werkstoffliste bestimmen','dimension-range':'Geometriemaße müssen endlich sein und im zulässigen Bereich bis 1000 mm liegen.','empty-cone':'Mindestens ein Kegeldurchmesser muss größer als null sein.','empty-solid':'Die Abzüge entfernen das gesamte Bauteilvolumen.','disconnected_solid':'Die Grundkörper bilden kein zusammenhängendes Teil.','disconnected-solid':'Die Grundkörper bilden kein zusammenhängendes Teil.','element-limit':'Höchstens 32 Geometrie- und Beschnittelemente sind zulässig.'};
    const messages=data.issues.slice(0,8).map(issue=>{
      if(Object.hasOwn(known,issue?.code))return tr(known[issue.code]);
      if(issue?.code==='invalid_positive_number'&&['d0','rodDiameter','rm'].includes(issue.path))return tr(fieldLabels[issue.path])+': '+tr('Bitte eine positive Zahl innerhalb des zulässigen Bereichs eingeben.');
      if(issue?.code==='invalid_selection'&&['materialState','wirePreparation'].includes(issue.path))return tr(fieldLabels[issue.path])+': '+tr('Bitte die strukturierte Geometrie und den Drahtprozess prüfen.');
      return '';
    }).filter(Boolean);
    return [...new Set(messages)].join(' ');
  }
  async function fingerprint(file,note,language,policy,materialChoice=null){
    const bytes=file?await file.arrayBuffer():new Uint8Array();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
    return JSON.stringify([hash,file?.name||'',note,language,policy,materialChoice]);
  }
  async function request(path,options={}){
    if(!apiBase)throw new Error('Die Zeichnungsanalyse ist gerade nicht verfügbar.');
    const {language=L.language,...requestOptions}=options;
    const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),90000);
    try{
      const response=await fetch(apiBase+path+(path.includes('?')?'&':'?')+'language='+encodeURIComponent(language),{...requestOptions,signal:controller.signal,credentials:'omit',cache:'no-store'});
      let data;try{data=await response.json();}catch(_){data=null;}
      if(!response.ok){const validation=[400,422].includes(response.status)?validationMessage(data):'';const error=new Error(validation||(response.status===413?'Die Datei ist für die Übertragung zu groß. Bitte verwenden Sie eine Datei bis 15 MB.':response.status===429?'Im Moment kommen viele Anfragen an. Bitte versuchen Sie es in wenigen Minuten erneut.':response.status===400||response.status===415||response.status===422?path==='/geometry-preview'?'Bitte die strukturierte Geometrie und den Drahtprozess prüfen.':'Bitte prüfen Sie Ihre Angaben und das Dateiformat.':response.status===503?'Die Zeichnungsanalyse ist gerade nicht verfügbar.':'Die Übertragung konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.'));error.status=response.status;throw error;}
      if(!data||typeof data!=='object')throw new Error('Die Antwort konnte nicht gelesen werden. Bitte versuchen Sie es erneut.');
      return data;
    }catch(error){if(error.name==='AbortError')throw new Error('Die Antwort dauert länger als erwartet. Bitte versuchen Sie es erneut; dabei verwenden wir dieselbe Anfragenkennung.');if(error instanceof TypeError)throw new Error('Die Verbindung konnte nicht hergestellt werden. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.');throw error;}
    finally{window.clearTimeout(timer);}
  }
  const fieldLabels={material:'Werkstoff',materialState:'Lieferzustand',curveId:'Fließkurvenansatz',d0:'Draht-Ø an der Presse',kD:'Kopfdurchmesser',kSW:'Kopfschlüsselweite',kH:'Kopfhöhe',sD:'Körperdurchmesser',sL:'Körperlänge',iSW:'Innenantrieb-Schlüsselweite',iT:'Innenantriebstiefe',nD:'Napfinnendurchmesser',nT:'Napftiefe',mM:'Gewinde-Nenndurchmesser',mSW:'Mutternschlüsselweite',mH:'Mutternhöhe',mLoch:'Lochdurchmesser',mFlansch:'Flanschdurchmesser',mFlanschH:'Flanschhöhe',masse:'Teilmasse',rm:'Drahtzugfestigkeit Rm an der Presse',wirePreparation:'Vormaterial / Vorzug',rodDiameter:'Walzdraht-Ø vor dem Vorzug'};
  function processingMessage(data){
    if(!['queued','processing','failed'].includes(data?.status))return '';
    const info=data.processingInfo,code=info?.failureCode;
    return [code==='model_output_limit'?'Die KI-Antwort wurde zu umfangreich und konnte nicht vollständig abgeschlossen werden.':['model_timeout','service_timeout'].includes(code)?'Die KI-Auswertung hat das Zeitlimit erreicht.':'',info?.retrying===true?'Die Auswertung wird automatisch erneut versucht.':''].filter(Boolean).map(tr).join(' ');
  }
  const h=value=>escape(tr(String(value??''))),readable=value=>typeof value==='string'||typeof value==='number'?String(value):'';
  function resultHTML(data,canChooseMachine){
    const proposal=data.proposal||{},parts=[];
    if(data.answer)parts.push('<div class="preview-answer formatted-answer">'+(window.JYAnswerFormat?window.JYAnswerFormat.html(data.answer):escape(data.answer))+'</div>');
    if(Array.isArray(proposal.input)&&proposal.input.length)parts.push('<h3>'+h('Aus Ihren Angaben')+'</h3><dl class="preview-facts">'+proposal.input.map(item=>'<div><dt>'+h(fieldLabels[item.field]||item.field)+'</dt><dd>'+escape(readable(item.value))+' '+escape(item.unit==='count'?'':readable(item.unit))+'</dd></div>').join('')+'</dl>');
    if(Array.isArray(proposal.stages)&&proposal.stages.length)parts.push('<h3>'+h('Vorschlag zur Stadienfolge')+'</h3><ol>'+proposal.stages.map(stage=>'<li>'+escape(window.JYConcept?.stageText?window.JYConcept.stageText(stage,L.language):tr(stage.operation))+(Number.isFinite(stage.force_t)?' · '+escape(stage.force_t.toLocaleString(window.JYI18N.numberLocale(L.language),{maximumFractionDigits:2}))+' t':' · '+h('Kraft noch offen'))+'</li>').join('')+'</ol>');
    if(Array.isArray(proposal.machines)&&proposal.machines.length){
      parts.push('<h3>'+h('Maschinen zum Konzept')+'</h3>');
      for(const machine of proposal.machines){
        const qualitative=machine.selectionBasis==='qualitative';
        parts.push('<section class="preview-machine"><h4>'+escape(machine.model)+'</h4><p>'+h(qualitative?'Kandidat aus dem Stadienkonzept':{ok:'Passend zur Vorauswahl',knapp:'Einzelne Punkte vertiefen',offen:'Klärung nötig',nein:'Grenze überschritten'}[machine.status]||machine.status)+'</p>');
        if(qualitative&&typeof machine.reason==='string'&&machine.reason.trim())parts.push('<p class="machine-reason">'+escape(machine.reason)+'</p>');
        if(canChooseMachine?.(machine.model))parts.push('<button type="button" class="quote-button" data-preview-model="'+escape(machine.model)+'" aria-label="'+h('Angebot anfragen')+' · '+escape(machine.model)+'">'+h('Angebot anfragen')+'</button>');
        if(window.JY_SHOW_PRICES!==false&&Number.isFinite(machine.priceEUR))parts.push('<p>'+h('Richtpreis')+' '+escape(machine.priceEUR.toLocaleString(window.JYI18N.numberLocale(L.language)))+' €</p>');
        if(window.JY_SHOW_PRICES!==false&&Array.isArray(machine.priceRangeEUR)&&machine.priceRangeEUR.length===2&&machine.priceRangeEUR.every(Number.isFinite))parts.push('<p>'+h('Preisspanne')+' '+machine.priceRangeEUR.map(value=>escape(value.toLocaleString(window.JYI18N.numberLocale(L.language)))+' €').join(' – ')+'</p>');
        if(machine.concept&&window.JYConcept)parts.push(window.JYConcept.html(machine.concept,L.language));
        if(Array.isArray(machine.openPoints)&&machine.openPoints.length)parts.push('<ul>'+machine.openPoints.map(point=>'<li><strong>'+h(point.owner)+':</strong> '+h(point.detail)+'</li>').join('')+'</ul>');
        parts.push('</section>');
      }
    }
    for(const [label,items]of [['Annahmen im Konzept',proposal.assumptions],['Das möchten wir noch wissen',data.questions]])if(Array.isArray(items)&&items.length)parts.push('<h3>'+h(label)+'</h3><ul>'+items.map(item=>'<li>'+h(readable(item))+'</li>').join('')+'</ul>');
    if(Array.isArray(data.sources)&&data.sources.length){parts.push('<h3>'+h('Grundlagen & Quellen')+'</h3><ul>');for(const source of data.sources){let url;try{const candidate=new URL(source.url);if(['https:','http:'].includes(candidate.protocol))url=candidate.href;}catch(_){}const label=escape(typeof source==='string'?source:source.label||source.id||'');parts.push('<li>'+(url?'<a target="_blank" rel="noopener noreferrer" href="'+escape(url)+'">'+label+'</a>':label)+'</li>');}parts.push('</ul>');}
    return parts.join('');
  }
  function create({button,progress,status,result,refresh,getFile=()=>null,getGeometry,getNote=()=>'',getMaterialChoice=()=>null,showWhenEmpty=false,canChooseMachine,onChooseMachine,onInvalidate,onResult}){
    const geometryMode=typeof getGeometry==='function';
    let version=0,lastFile,lastNote,lastGeometry,lastMaterial,lastLanguage,timer=null,receipt=null,latest=null,busy=false,paused=false,suspended=false,blocked=false,pollDeadline=0,key='',signature='',error='';
    const terminal=data=>['ready','needs_info','failed'].includes(data?.status);
    const active=()=>busy||receipt&&!terminal(latest)&&!paused;
    function fileError(){const file=getFile();if(!file)return '';if(!/\.(pdf|png|jpe?g|webp)$/i.test(file.name))return 'Für die KI-Auswertung wählen Sie bitte eine PDF-, PNG-, JPG- oder WebP-Datei.';if(!file.size)return 'Die ausgewählte Datei ist leer. Bitte wählen Sie die Zeichnung erneut aus.';if(file.size>15*1024*1024)return 'Die Datei ist für die Übertragung zu groß. Bitte verwenden Sie eine Datei bis 15 MB.';return '';}
    function render(){
      const file=getFile(),input=geometryMode?getGeometry():file,pending=!!active();button.hidden=geometryMode||showWhenEmpty?false:!file;button.disabled=!input||!apiBase||!!fileError()||pending;progress.hidden=suspended||!pending;refresh.hidden=suspended||!receipt;refresh.disabled=busy;
      const labels=geometryMode?{queued:'Geometrie zur Ausarbeitung angenommen.',processing:'Das Stadienkonzept wird ausgearbeitet. Das benötigt etwas Zeit.',ready:'Stadienkonzept ausgearbeitet.',needs_info:'Das Stadienkonzept braucht noch Angaben.',failed:'Das Stadienkonzept konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.'}:{queued:'Zeichnung zur Analyse angenommen.',processing:'Die Zeichnungsanalyse benötigt etwas Zeit. Wir prüfen Maße, Umformschritte und passende Maschinen.',ready:'Zeichnungsanalyse abgeschlossen.',needs_info:'Die Zeichnungsanalyse braucht noch Angaben.',failed:'Die Zeichnungsanalyse konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.'};
      status.textContent=[tr(error||fileError()||(input&&!apiBase?'Die Zeichnungsanalyse ist gerade nicht verfügbar.':'')||(busy&&!receipt?(geometryMode?'Geometrie wird übertragen …':'Zeichnung wird übertragen …'):labels[latest?.status]||'')),processingMessage(latest),receipt?tr('Anfrage')+': '+receipt.id:''].filter(Boolean).join(' · ');status.dataset.originalText='';status.hidden=suspended||!status.textContent;status.dataset.state=error||fileError()||latest?.status==='failed'?'error':'ready';
      result.hidden=suspended||!latest||!terminal(latest);result.dataset.originalText='';result.innerHTML=result.hidden?'':resultHTML(latest,canChooseMachine);
    }
    function update(){
      const file=getFile(),input=geometryMode?getGeometry():file;
      // The host also returns null for an inactive tab or temporarily invalid
      // edit. Hide/detach its output, but keep the accepted job until a new valid
      // snapshot can be compared. Late responses never repopulate that host.
      if(!input){if(!suspended){suspended=true;onInvalidate?.();}render();return;}
      const returning=suspended;suspended=false;
      const note=getNote(),geometry=geometryMode?JSON.stringify(input):null,material=JSON.stringify(getMaterialChoice()),language=L.language;
      if(file!==lastFile||note!==lastNote||geometry!==lastGeometry||material!==lastMaterial||language!==lastLanguage){version++;window.clearTimeout(timer);if(latest?.status==='failed'){signature='';key='';}receipt=latest=null;busy=false;paused=false;blocked=false;pollDeadline=0;error='';lastFile=file;lastNote=note;lastGeometry=geometry;lastMaterial=material;lastLanguage=language;onInvalidate?.();}
      else if(returning){if(latest)onResult?.(latest);if(receipt&&!terminal(latest)&&!blocked){paused=false;pollDeadline=Date.now()+POLL_BUDGET_MS;schedule();}}
      render();
    }
    function schedule(){window.clearTimeout(timer);if(receipt&&!terminal(latest)&&!paused&&!blocked&&Date.now()<pollDeadline)timer=window.setTimeout(()=>poll(),4000);}
    async function poll(){
      if(!receipt||busy)return;const run=version,identity=receipt;busy=true;render();
      try{const data=await request('/status?'+new URLSearchParams({id:identity.id,token:identity.token}));if(run!==version)return;if(data.kind&&data.kind!=='preview')throw new Error('Die Antwort konnte nicht gelesen werden. Bitte versuchen Sie es erneut.');latest=data;if(!suspended)onResult?.(data);error='';}
      catch(problem){if(run!==version)return;error=problem.message;if([401,403,404].includes(problem.status))blocked=true;}
      finally{if(run===version){busy=false;paused=(blocked||Date.now()>=pollDeadline)&&!terminal(latest);if(paused&&!error)error='Die Auswertung läuft noch. Sie können den Stand erneut abrufen.';render();schedule();}}
    }
    async function start(){
      update();const geometry=geometryMode?getGeometry():null;if(active()||!apiBase||fileError()||!(geometryMode?geometry:getFile()))return;
      const run=version,file=getFile(),note=getNote(),materialChoice=getMaterialChoice(),language=L.language,failed=latest?.status==='failed';receipt=latest=null;paused=false;blocked=false;busy=true;error='';render();
      try{
        const policy=window.JY_SHOW_PRICES===false?'technical-only':'with-prices';
        const current=geometryMode?JSON.stringify([geometry,note,language,policy]):await fingerprint(file,note,language,policy,materialChoice);if(run!==version)return;
        if(signature!==current||failed){signature=current;key=uuid();}
        let body,headers;
        if(geometryMode){body=JSON.stringify({...geometry,note,language,idempotency_key:key,pricePolicy:policy});headers={'Content-Type':'application/json'};}
        else{body=new FormData();body.append('datei',file,file.name);body.append('notiz',note);body.append('language',language);body.append('idempotency_key',key);if(materialChoice)body.append('materialChoice',JSON.stringify(materialChoice));if(policy==='technical-only')body.append('pricePolicy',policy);}
        const data=await request(geometryMode?'/geometry-preview':'/preview',{method:'POST',body,headers,language});if(run!==version)return;
        if(typeof data.id!=='string'||!data.id||typeof data.token!=='string'||!data.token||data.kind!=='preview')throw new Error('Der Eingang konnte nicht eindeutig bestätigt werden. Bitte versuchen Sie es erneut.');
        receipt={id:data.id,token:data.token};latest=data;pollDeadline=Date.now()+POLL_BUDGET_MS;if(!suspended)onResult?.(data);
      }catch(problem){if(run===version)error=problem.message;}
      finally{if(run===version){busy=false;render();schedule();}}
    }
    function resume(){update();if(suspended||busy||!receipt||terminal(latest)||blocked)return;paused=false;pollDeadline=Date.now()+POLL_BUDGET_MS;return poll();}
    result.addEventListener('click',event=>{if(suspended)return;const action=event.target.closest('button[data-preview-model]'),model=action?.dataset.previewModel;if(model&&canChooseMachine?.(model)&&latest?.proposal?.machines?.some(machine=>machine.model===model))onChooseMachine?.(model);});
    button.addEventListener('click',start);refresh.addEventListener('click',()=>{if(suspended)return;paused=false;blocked=false;pollDeadline=Date.now()+POLL_BUDGET_MS;return poll();});
    window.addEventListener?.('focus',resume);window.document?.addEventListener?.('visibilitychange',()=>{if(!window.document.hidden)return resume();});update();
    return {update,start};
  }
  window.JYDrawingPreview={apiBase,request,fingerprint,uuid,create};
})();
