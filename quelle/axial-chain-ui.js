(function(global){
  'use strict';
  const escape=x=>String(x??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const numeric=x=>String(x).trim()===''?null:Number(String(x).replace(',','.'));
  function create({root,view,translate:tr=x=>x,evaluate,onChange,templates=[]}){
    const C=global.JYAxialChain,h=x=>escape(tr(x)),fmt=x=>x==null?'—':Number(x).toLocaleString(global.JYI18N?.numberLocale(global.JYLocale?.language)||'de-DE',{maximumFractionDigits:3});
    let chain={version:1,segments:[],recesses:[],trimming:[],parting:0,flipped:false},options={},history=[],active='',editing=false,lastResult=null;
    const remember=()=>{history.push(C.clone(chain));if(history.length>30)history.shift();};
    const changed=()=>{refresh();onChange?.();};
    const showError=error=>{const message=root.querySelector('#chain-message');if(message)message.textContent=tr(error.message||error);};
    const replace=next=>{chain=C.retainIds(next,chain);editing=false;};
    const field=(label,key,value,id,kind='segment')=>'<label class="feld"><span>'+h(label)+'</span><input type="text" inputmode="decimal" data-chain-kind="'+kind+'" data-chain-id="'+id+'" data-chain-field="'+key+'" value="'+escape(value)+'"></label>';
    const select=(label,key,value,id,choices,kind='segment')=>'<label class="feld"><span>'+h(label)+'</span><select data-chain-kind="'+kind+'" data-chain-id="'+id+'" data-chain-field="'+key+'">'+choices.map(([v,l])=>'<option value="'+v+'"'+(v===value?' selected':'')+'>'+h(l)+'</option>').join('')+'</select></label>';
    const shapes=[['cylinder','Zylinder'],['cone','Kegelstumpf'],['hex','Sechskant']];
    function row(s,inside=false){
      const kind=inside?'recess':'segment',r=C.ranges(chain).find(x=>x.id===s.id);
      let controls=select('Form','shape',s.shape,s.id,shapes,kind);
      if(inside)controls+=select('Beginn','from',s.from==='boundary'?'after:'+s.after:s.from,s.id,[['A','Stirnfläche A'],['B','Stirnfläche B'],...chain.segments.map(x=>['after:'+x.id,tr('Nach Segment')+' '+x.id])],kind);
      controls+=field(inside?'Gesamttiefe in mm':'Länge in mm','length',s.length,s.id,kind);
      controls+=s.shape==='hex'?field('Schlüsselweite in mm','acrossFlats',s.acrossFlats,s.id,kind):field(inside?'Öffnungs-Ø in mm':'Durchmesser in mm','diameter',s.diameter,s.id,kind);
      if(s.shape==='cone')controls+=field(inside?'Ø am Grund innen in mm':'End-Ø in mm','diameterEnd',s.diameterEnd,s.id,kind);
      if(!inside)controls+=field('Endposition ab A in mm','end',r?.b,s.id,kind);
      if(inside&&s.shape==='cylinder')controls+=select('Bohrungsgrund','bottomShape',s.bottomShape||'flat',s.id,[['flat','Flach'],['cone','Kegelgrund']],kind)+(s.bottomShape==='cone'?field('Grundwinkel in Grad','bottomAngle',s.bottomAngle,s.id,kind):'');
      return '<article class="geometry-element'+(active===s.id?' chain-active':'')+'" data-chain-row="'+s.id+'"><header><strong>'+s.id+' · '+h(inside?'Innenkontur':'Außenkontur')+'</strong><div>'+(inside?'':'<button type="button" data-chain-up="'+s.id+'" aria-label="'+h('Nach oben')+' '+s.id+'">↑</button><button type="button" data-chain-down="'+s.id+'" aria-label="'+h('Nach unten')+' '+s.id+'">↓</button><button type="button" data-chain-insert="'+s.id+'">+</button>')+'<button type="button" data-chain-remove="'+s.id+'">'+h('Entfernen')+'</button></div></header>'+(!inside?'<p class="klein" data-chain-range="'+s.id+'">'+fmt(r?.a)+' → '+fmt(r?.b)+' mm '+h('ab A')+'</p>':'')+'<div class="felder">'+controls+'</div><details><summary>'+h('Achsversatz')+'</summary><div class="felder">'+field('Versatz X in mm','offsetX',s.offsetX||0,s.id,kind)+field('Versatz Y in mm','offsetY',s.offsetY||0,s.id,kind)+'</div></details></article>';
    }
    function panels(){
      root.dataset.originalText='';root.innerHTML='<p>'+h('Das Teil entsteht von Stirnfläche A nach B. Jedes Segment schließt an das vorige an.')+'</p><div class="felder"><label class="feld voll"><span>'+h('Vorlage')+'</span><select id="chain-template"><option value="">'+h('Eigenes Teil')+'</option>'+templates.map(t=>'<option value="'+escape(t.id)+'"'+(t.id===chain.templateId?' selected':'')+'>'+h(t.label)+'</option>').join('')+'</select></label>'+(chain.leadDiameterMm?'<label class="feld"><span>'+h('Leitmaß Ø in mm')+'</span><input id="chain-lead-diameter" type="text" inputmode="decimal" value="'+escape(chain.leadDiameterMm)+'"></label>':'')+'<label class="feld voll"><span>'+h('Kurzschreibweise')+'</span><input id="chain-shorthand" placeholder="12×6, 8×30, K8/6×2, SW13×5"></label></div><p id="chain-message" role="status"></p><h3>'+h('Außenkontur A → B')+'</h3>'+chain.segments.map(s=>row(s)).join('')+'<div class="knoepfe"><button type="button" class="knopf zwei" data-chain-add="segment">'+h('Segment hinzufügen')+'</button><button type="button" class="knopf zwei" data-chain-undo'+(!history.length?' disabled':'')+'>'+h('Rückgängig')+'</button></div><h3>'+h('Innenkonturen')+'</h3>'+chain.recesses.map(s=>row(s,true)).join('')+'<button type="button" class="knopf zwei" data-chain-add="recess">'+h('Innenkontur hinzufügen')+'</button><h3>'+h('Werkzeugtrennkante')+'</h3><div class="felder"><label class="feld voll"><span>'+h('Trennkante nach Segment')+'</span><select id="chain-parting"><option value="custom">'+h('Eigene Position')+'</option>'+C.ranges(chain).map(s=>'<option value="'+s.b+'"'+(s.b===chain.parting?' selected':'')+'>'+s.id+' · '+fmt(s.b)+' mm</option>').join('')+'</select></label>'+field('Position ab A in mm','parting',chain.parting,'','chain')+'</div><label class="check"><input type="checkbox" id="chain-flip"'+(chain.flipped?' checked':'')+'>'+h('Teil umdrehen')+'</label><details><summary>'+h('Beschnitt')+'</summary><p>'+h('Schnittebenen mit Winkel um die Teilachse und Abstand von der Achse.')+'</p>'+(chain.trimming||[]).map(t=>'<article class="geometry-element"><header><strong>'+t.id+'</strong><button type="button" data-chain-trim-remove="'+t.id+'">'+h('Entfernen')+'</button></header><div class="felder">'+field('Beginn ab A in mm','start',t.start,t.id,'trim')+field('Beschnittlänge in mm','length',t.length,t.id,'trim')+field('Winkel in Grad','angleDeg',t.angleDeg,t.id,'trim')+field('Ebenenabstand in mm','distance',t.distance,t.id,'trim')+'</div></article>').join('')+'<button type="button" class="knopf zwei" data-chain-add="trim">'+h('Schnittebene hinzufügen')+'</button></details>';
    }
    function summary(){
      return [tr('Aufbaukette A → B'),...C.ranges(chain).map(s=>s.id+': '+fmt(s.a)+' → '+fmt(s.b)+' mm · '+(s.shape==='hex'?'SW '+fmt(s.acrossFlats):'Ø '+fmt(s.diameter)+(s.shape==='cone'?' → '+fmt(s.diameterEnd):''))),...chain.recesses.map(s=>s.id+': '+tr('Innenkontur')+' '+(s.from==='A'?'A':s.from==='B'?'B':s.after)+' · '+tr('Gesamttiefe in mm')+' '+fmt(s.length)+(s.bottomShape==='cone'?' · '+fmt(s.bottomAngle)+'°':'')),tr('Werkzeugtrennkante')+': '+fmt(chain.parting)+' mm '+tr('ab A'),...(chain.flipped?[tr('Teil umgedreht')]:[]),...(chain.modelNotes||[]).map(tr)];
    }
    function sketch(spec){
      let lo=-10,hi=10,r=8;
      for(const e of spec.elements){const end=e.start+e.length;if(e.side==='punch')lo=Math.min(lo,-end);else hi=Math.max(hi,end);r=Math.max(r,Math.abs(e.offsetX)+Math.max(e.diameter||0,e.diameterEnd||0,e.acrossFlats||0)/2);}
      const scale=Math.min(476/(hi-lo),160/(r*2)),x=z=>42+(z-lo)*scale;
      const rects=C.ranges(chain).map(s=>{const a=chain.flipped?chain.parting-s.b:s.a-chain.parting,b=chain.flipped?chain.parting-s.a:s.b-chain.parting;return '<rect x="'+x(a)+'" y="40" width="'+((b-a)*scale)+'" height="170" fill="'+(active===s.id?'#e9a432':'transparent')+'" fill-opacity="0.18" stroke="'+(active===s.id?'#ad6a00':'transparent')+'" data-chain-select="'+s.id+'" tabindex="0" role="button" aria-label="'+h('Segment auswählen')+' '+s.id+'" style="cursor:pointer"/>';}).join('');
      return global.JYGeometryWizard.sketch(spec,tr).replace('</svg>',rects+'</svg>');
    }
    function refresh(nextOptions){
      if(nextOptions)options=nextOptions;
      const p=C.project(chain),result=p.ok?evaluate(p.spec,options):{valid:false,errors:p.errors.map(message=>({message}))};lastResult=result;
      const measure=(value,bounds)=>Number.isFinite(value)?fmt(value):Array.isArray(bounds)&&bounds.every(Number.isFinite)?bounds.map(fmt).join(' … '):'—';
      const metrics=result.valid?'<dl class="geometry-measures"><div><dt>'+h(chain.modelNotes?.length?'Modellvolumen':'Volumen')+'</dt><dd>'+measure(result.volumeMm3,result.volumeBoundsMm3)+' mm³</dd></div><div><dt>'+h('Masse')+'</dt><dd>'+measure(result.massG,result.massBoundsG)+' g</dd></div><div><dt>'+h('Abschnittlänge')+'</dt><dd>'+measure(result.blankLengthMm,result.blankLengthBoundsMm)+' mm</dd></div></dl>':'';
      const messages=[...(chain.modelNotes||[]),...(result.warnings||[]).map(x=>x.message)];
      if(options.densityStatus==='reference-steel-density'&&result.valid)messages.push('Gewicht mit Stahl-Bezugsdichte 7,85 g/cm³; Näherungswert, keine belegte Chargendichte.');
      view.dataset.originalText='';view.innerHTML='<h2>'+h('Teilaufbau')+'</h2>'+(p.ok?'<div class="geometry-sketch">'+sketch(p.spec)+'</div>':'')+'<div class="chain-boundaries">'+C.ranges(chain).map(s=>'<button type="button" class="knopf zwei" data-chain-boundary="'+s.id+'" aria-pressed="'+(s.b===chain.parting)+'">'+s.id+' · '+fmt(s.b)+' mm</button>').join('')+'</div>'+metrics+(messages.length?'<ul class="klein chain-model-notes">'+messages.map(x=>'<li>'+h(x)+'</li>').join('')+'</ul>':'')+(!result.valid?'<ul role="status">'+(result.errors||[]).map(x=>'<li>'+h(x.message)+'</li>').join(''):'')+'<details><summary>'+h('Geometrieübersicht')+'</summary><pre class="klein" style="white-space:pre-wrap">'+escape([...summary(),...(p.ok?global.JYGeometryWizard.summary(p.spec,tr,fmt):[])].join('\n'))+'</pre></details>';
      for(const s of C.ranges(chain)){const range=root.querySelector('[data-chain-range="'+s.id+'"]');if(range)range.textContent=fmt(s.a)+' → '+fmt(s.b)+' mm '+tr('ab A');const end=root.querySelector('[data-chain-id="'+s.id+'"][data-chain-field="end"]');if(end&&global.document?.activeElement!==end)end.value=s.b;const length=root.querySelector('[data-chain-id="'+s.id+'"][data-chain-field="length"]');if(length&&global.document?.activeElement!==length)length.value=s.length;}
      return result;
    }
    root.addEventListener('click',event=>{
      const b=event.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-chain-undo')){if(history.length){replace(history.pop());panels();changed();}return;}
      remember();
      try{
      if(b.dataset.chainAdd==='segment')chain=C.addSegment(chain);
      else if(b.dataset.chainAdd==='recess'){const id=C.allocateId(chain,'I'),first=chain.segments[0];chain.recesses.push({id,shape:'cone',from:'A',length:Math.min(1,C.totalLength(chain)/2),diameter:Math.min(2,(first?.diameter||first?.acrossFlats||4)/2),diameterEnd:0,offsetX:0,offsetY:0});}
      else if(b.dataset.chainAdd==='trim'){const id=C.allocateId(chain,'T');(chain.trimming??=[]).push({id,start:0,length:C.totalLength(chain),angleDeg:0,distance:1});}
      else if(b.dataset.chainRemove||b.dataset.chainTrimRemove)chain=C.remove(chain,b.dataset.chainRemove||b.dataset.chainTrimRemove);
      else if(b.dataset.chainInsert)chain=C.addSegment(chain,chain.segments.findIndex(s=>s.id===b.dataset.chainInsert)+1);
      else if(b.dataset.chainUp||b.dataset.chainDown){const i=chain.segments.findIndex(s=>s.id===(b.dataset.chainUp||b.dataset.chainDown)),j=i+(b.dataset.chainUp?-1:1);if(j>=0&&j<chain.segments.length)[chain.segments[i],chain.segments[j]]=[chain.segments[j],chain.segments[i]];}
      else if(b.hasAttribute('data-chain-trim-clear'))chain.trimming=[];
      else{history.pop();return;}
      if(chain.parting>C.totalLength(chain))chain.parting=C.suggestedParting(chain);editing=false;panels();changed();
      }catch(error){history.pop();showError(error);}
    });
    function input(event){
      const n=event.target,key=n.dataset.chainField;if(!key)return;
      if(!editing){remember();editing=true;}
      const kind=n.dataset.chainKind;
      const target=kind==='chain'?chain:(kind==='trim'?chain.trimming:kind==='recess'?chain.recesses:chain.segments).find(s=>s.id===n.dataset.chainId);
      if(!target)return;active=target.id||active;
      try{
        if(key==='end')chain=C.setEnd(chain,target.id,numeric(n.value));
        else if(key==='from'&&n.value.startsWith('after:')){target.from='boundary';target.after=n.value.slice(6);}
        else target[key]=n.tagName==='SELECT'?n.value:numeric(n.value);
        if(key==='shape'){
          if(target.shape==='hex')target.acrossFlats??=target.diameter||1;else target.diameter??=target.acrossFlats||1;
          if(target.shape==='cone')target.diameterEnd??=kind==='recess'?0:target.diameter;
        }
        if(key==='bottomShape'&&target.bottomShape==='cone')target.bottomAngle??=120;
        if(n.tagName==='SELECT')panels();changed();
      }catch(error){if(key==='end'){target.length=null;changed();}showError(error);}
    }
    root.addEventListener('input',event=>{if(event.target.tagName!=='SELECT')input(event);});
    root.addEventListener('focusout',()=>{editing=false;});
    root.addEventListener('change',event=>{
      const n=event.target;
      if(n.dataset.chainField){if(n.tagName==='SELECT')input(event);return;}
      if(n.id==='chain-shorthand'){try{const parsed=C.parse(n.value);remember();replace(parsed);panels();changed();}catch(e){showError(e);}return;}
      if(n.id==='chain-template'&&n.value){const t=templates.find(x=>x.id===n.value);if(t){try{const next=C.fromTemplate(t);remember();replace(next);panels();changed();}catch(e){showError(e);}}return;}
      if(n.id==='chain-lead-diameter'){try{const next=C.scale(chain,numeric(n.value)/chain.leadDiameterMm);remember();replace(next);panels();changed();}catch(e){showError(e);}return;}
      if(n.id==='chain-parting'&&n.value!=='custom'){remember();chain.parting=Number(n.value);panels();changed();return;}
      if(n.id==='chain-flip'){remember();chain.flipped=n.checked;changed();}
    });
    root.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.dataset.chainKind==='segment'){event.preventDefault();remember();const index=chain.segments.findIndex(s=>s.id===event.target.dataset.chainId)+1;chain=C.addSegment(chain,index);active=chain.segments[index].id;editing=false;panels();changed();root.querySelector('[data-chain-id="'+active+'"][data-chain-field="length"]')?.focus();}});
    const selectSegment=event=>{const b=event.target.closest('[data-chain-boundary],[data-chain-select]');if(!b)return;active=b.dataset.chainBoundary||b.dataset.chainSelect;if(b.dataset.chainBoundary){remember();chain.parting=C.ranges(chain).find(s=>s.id===active).b;panels();changed();}else{panels();refresh();}root.querySelector('[data-chain-row="'+active+'"]')?.scrollIntoView({block:'nearest',behavior:'smooth'});};
    view.addEventListener('click',selectSegment);
    view.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.dataset.chainSelect){event.preventDefault();selectSegment(event);}});
    panels();refresh();
    return {getSpec:()=>C.project(chain).spec,getChain:()=>C.clone(chain),getFeatures:()=>[],featureSummary:summary,summary,refresh,isComplete:()=>C.project(chain).ok&&lastResult?.valid===true,rerender(){panels();return refresh();},setChain(next){const errors=C.validate(next);if(errors.length)throw new Error(errors[0]);remember();replace(next);panels();changed();}};
  }
  global.JYAxialChainUI={create};
})(typeof window==='object'?window:globalThis);
