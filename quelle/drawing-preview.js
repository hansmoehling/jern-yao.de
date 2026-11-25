(function () {
  'use strict';
  const L=window.JYLocale,tr=text=>L.t(text),escape=value=>String(value??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let apiBase='';
  try{const url=new URL(window.JY_API_BASE||'',window.location.href);if(window.JY_API_BASE&&(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))apiBase=url.href.replace(/\/$/,'');}catch(_){/* Keep unavailable configuration visible. */}
  const uuid=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,'0')).join('');
  async function fingerprint(file,note,language,policy){
    const bytes=file?await file.arrayBuffer():new Uint8Array();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
    return JSON.stringify([hash,file?.name||'',note,language,policy]);
  }
  async function request(path,options={}){
    if(!apiBase)throw new Error('Die Zeichnungsanalyse ist gerade nicht verfügbar.');
    const {language=L.language,...requestOptions}=options;
    const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),90000);
    try{
      const response=await fetch(apiBase+path+(path.includes('?')?'&':'?')+'language='+encodeURIComponent(language),{...requestOptions,signal:controller.signal,credentials:'omit',cache:'no-store'});
      let data;try{data=await response.json();}catch(_){data=null;}
      if(!response.ok){const error=new Error(response.status===413?'Die Datei ist für die Übertragung zu groß. Bitte verwenden Sie eine Datei bis 15 MB.':response.status===429?'Im Moment kommen viele Anfragen an. Bitte versuchen Sie es in wenigen Minuten erneut.':response.status===400||response.status===415||response.status===422?'Bitte prüfen Sie Ihre Angaben und das Dateiformat.':response.status===503?'Die Zeichnungsanalyse ist gerade nicht verfügbar.':'Die Übertragung konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.');error.status=response.status;throw error;}
      if(!data||typeof data!=='object')throw new Error('Die Antwort konnte nicht gelesen werden. Bitte versuchen Sie es erneut.');
      return data;
    }catch(error){if(error.name==='AbortError')throw new Error('Die Antwort dauert länger als erwartet. Bitte versuchen Sie es erneut; dabei verwenden wir dieselbe Anfragenkennung.');if(error instanceof TypeError)throw new Error('Die Verbindung konnte nicht hergestellt werden. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.');throw error;}
    finally{window.clearTimeout(timer);}
  }
  const fieldLabels={material:'Werkstoff',materialState:'Lieferzustand',curveId:'Fließkurvenansatz',d0:'Draht-Ø an der Presse',kD:'Kopfdurchmesser',kSW:'Kopfschlüsselweite',kH:'Kopfhöhe',sD:'Körperdurchmesser',sL:'Körperlänge',iSW:'Innenantrieb-Schlüsselweite',iT:'Innenantriebstiefe',nD:'Napfinnendurchmesser',nT:'Napftiefe',mM:'Gewinde-Nenndurchmesser',mSW:'Mutternschlüsselweite',mH:'Mutternhöhe',mLoch:'Lochdurchmesser',mFlansch:'Flanschdurchmesser',mFlanschH:'Flanschhöhe',masse:'Teilmasse',rm:'Drahtzugfestigkeit Rm an der Presse',wirePreparation:'Vormaterial / Vorzug',rodDiameter:'Walzdraht-Ø vor dem Vorzug'};
  const h=value=>escape(tr(String(value??''))),readable=value=>typeof value==='string'||typeof value==='number'?String(value):'';
  function resultHTML(data,canChooseMachine){
    const proposal=data.proposal||{},parts=[];
    if(data.answer)parts.push('<div class="preview-answer">'+escape(data.answer)+'</div>');
    if(Array.isArray(proposal.input)&&proposal.input.length)parts.push('<h3>'+h('Aus Ihren Angaben')+'</h3><dl class="preview-facts">'+proposal.input.map(item=>'<div><dt>'+h(fieldLabels[item.field]||item.field)+'</dt><dd>'+escape(readable(item.value))+' '+escape(item.unit==='count'?'':readable(item.unit))+'</dd></div>').join('')+'</dl>');
    if(Array.isArray(proposal.stages)&&proposal.stages.length)parts.push('<h3>'+h('Vorschlag zur Stadienfolge')+'</h3><ol>'+proposal.stages.map(stage=>'<li>'+h(stage.operation)+(Number.isFinite(stage.force_t)?' · '+escape(stage.force_t.toLocaleString(window.JYI18N.numberLocale(L.language),{maximumFractionDigits:2}))+' t':' · '+h('Kraft noch offen'))+'</li>').join('')+'</ol>');
    if(Array.isArray(proposal.machines)&&proposal.machines.length){
      parts.push('<h3>'+h('Maschinen zum Konzept')+'</h3>');
      for(const machine of proposal.machines){
        parts.push('<section class="preview-machine"><h4>'+escape(machine.model)+'</h4><p>'+h({ok:'Passend zur Vorauswahl',knapp:'Einzelne Punkte vertiefen',offen:'Klärung nötig',nein:'Grenze überschritten'}[machine.status]||machine.status)+'</p>');
        if(canChooseMachine?.(machine.model))parts.push('<button type="button" class="quote-button" data-preview-model="'+escape(machine.model)+'" aria-label="'+h('Angebot anfragen')+' · '+escape(machine.model)+'">'+h('Angebot anfragen')+'</button>');
        if(window.JY_SHOW_PRICES!==false&&Number.isFinite(machine.priceEUR))parts.push('<p>'+h('Richtpreis')+' '+escape(machine.priceEUR.toLocaleString(window.JYI18N.numberLocale(L.language)))+' €</p>');
        if(machine.concept&&window.JYConcept)parts.push(window.JYConcept.html(machine.concept,L.language));
        if(Array.isArray(machine.openPoints)&&machine.openPoints.length)parts.push('<ul>'+machine.openPoints.map(point=>'<li><strong>'+h(point.owner)+':</strong> '+h(point.detail)+'</li>').join('')+'</ul>');
        parts.push('</section>');
      }
    }
    for(const [label,items]of [['Annahmen im Konzept',proposal.assumptions],['Das möchten wir noch wissen',data.questions]])if(Array.isArray(items)&&items.length)parts.push('<h3>'+h(label)+'</h3><ul>'+items.map(item=>'<li>'+h(readable(item))+'</li>').join('')+'</ul>');
    if(Array.isArray(data.sources)&&data.sources.length){parts.push('<h3>'+h('Grundlagen & Quellen')+'</h3><ul>');for(const source of data.sources){let url;try{const candidate=new URL(source.url);if(['https:','http:'].includes(candidate.protocol))url=candidate.href;}catch(_){}const label=escape(typeof source==='string'?source:source.label||source.id||'');parts.push('<li>'+(url?'<a target="_blank" rel="noopener noreferrer" href="'+escape(url)+'">'+label+'</a>':label)+'</li>');}parts.push('</ul>');}
    return parts.join('');
  }
  function create({button,progress,status,result,refresh,getFile,getNote,canChooseMachine,onChooseMachine,onInvalidate,onResult}){
    let version=0,lastFile,lastNote,timer=null,receipt=null,latest=null,busy=false,paused=false,polls=0,key='',signature='',error='';
    const terminal=data=>['ready','needs_info','failed'].includes(data?.status);
    const active=()=>busy||receipt&&!terminal(latest)&&!paused;
    function fileError(){const file=getFile();if(!file)return '';if(!/\.(pdf|png|jpe?g|webp)$/i.test(file.name))return 'Für die KI-Auswertung wählen Sie bitte eine PDF-, PNG-, JPG- oder WebP-Datei.';if(!file.size)return 'Die ausgewählte Datei ist leer. Bitte wählen Sie die Zeichnung erneut aus.';if(file.size>15*1024*1024)return 'Die Datei ist für die Übertragung zu groß. Bitte verwenden Sie eine Datei bis 15 MB.';return '';}
    function render(){
      const file=getFile(),pending=!!active();button.hidden=!file;button.disabled=!file||!apiBase||!!fileError()||pending;progress.hidden=!pending;refresh.hidden=!receipt;refresh.disabled=busy;
      const labels={queued:'Zeichnung zur Analyse angenommen.',processing:'Die Zeichnungsanalyse benötigt etwas Zeit. Wir prüfen Maße, Umformschritte und passende Maschinen.',ready:'Zeichnungsanalyse abgeschlossen.',needs_info:'Die Zeichnungsanalyse braucht noch Angaben.',failed:'Die Zeichnungsanalyse konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.'};
      status.textContent=tr(error||fileError()||(file&&!apiBase?'Die Zeichnungsanalyse ist gerade nicht verfügbar.':'')||(busy&&!receipt?'Zeichnung wird übertragen …':labels[latest?.status]||''));status.dataset.originalText='';status.hidden=!status.textContent;status.dataset.state=error||fileError()||latest?.status==='failed'?'error':'ready';
      result.hidden=!latest||!terminal(latest);result.dataset.originalText='';result.innerHTML=result.hidden?'':resultHTML(latest,canChooseMachine);
    }
    function update(){const file=getFile(),note=getNote();if(file!==lastFile||note!==lastNote){version++;window.clearTimeout(timer);receipt=latest=null;busy=false;paused=false;polls=0;error='';lastFile=file;lastNote=note;onInvalidate?.();}render();}
    function schedule(){window.clearTimeout(timer);if(receipt&&!terminal(latest)&&polls<75)timer=window.setTimeout(()=>poll(),4000);}
    async function poll(){
      if(!receipt||busy)return;const run=version,identity=receipt;busy=true;render();
      try{const data=await request('/status?'+new URLSearchParams({id:identity.id,token:identity.token}));if(run!==version)return;if(data.kind&&data.kind!=='preview')throw new Error('Die Antwort konnte nicht gelesen werden. Bitte versuchen Sie es erneut.');latest=data;onResult?.(data);error='';polls++;}
      catch(problem){if(run!==version)return;error=problem.message;polls++;if([401,403,404].includes(problem.status))polls=75;}
      finally{if(run===version){busy=false;paused=polls>=75&&!terminal(latest);if(paused&&!error)error='Die Auswertung läuft noch. Sie können den Stand erneut abrufen.';render();schedule();}}
    }
    async function start(){
      update();if(active()||!apiBase||fileError()||!getFile())return;
      const run=version,file=getFile(),note=getNote(),language=L.language,failed=latest?.status==='failed';receipt=latest=null;paused=false;busy=true;error='';render();
      try{
        const current=await fingerprint(file,note,language,window.JY_SHOW_PRICES===false?'technical-only':'with-prices');if(run!==version)return;
        if(signature!==current||failed){signature=current;key=uuid();}
        const body=new FormData();body.append('datei',file,file.name);body.append('notiz',note);body.append('language',language);body.append('idempotency_key',key);if(window.JY_SHOW_PRICES===false)body.append('pricePolicy','technical-only');
        const data=await request('/preview',{method:'POST',body,language});if(run!==version)return;
        if(typeof data.id!=='string'||!data.id||typeof data.token!=='string'||!data.token||data.kind!=='preview')throw new Error('Der Eingang konnte nicht eindeutig bestätigt werden. Bitte versuchen Sie es erneut.');
        receipt={id:data.id,token:data.token};latest=data;onResult?.(data);polls=0;
      }catch(problem){if(run===version)error=problem.message;}
      finally{if(run===version){busy=false;render();schedule();}}
    }
    result.addEventListener('click',event=>{const action=event.target.closest('button[data-preview-model]'),model=action?.dataset.previewModel;if(model&&canChooseMachine?.(model)&&latest?.proposal?.machines?.some(machine=>machine.model===model))onChooseMachine?.(model);});
    button.addEventListener('click',start);refresh.addEventListener('click',()=>{polls=0;paused=false;return poll();});update();
    return {update,start};
  }
  window.JYDrawingPreview={apiBase,request,fingerprint,uuid,create};
})();
