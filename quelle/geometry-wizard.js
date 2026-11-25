(function (global) {
  'use strict';
  const STEPS=['Stempelseite','Beschnitt','Werkzeugtrennkante','Matrizenseite','Exzentrizität und Übersicht'];
  const SHAPES={cylinder:'Zylinder',cone:'Kegelstumpf',hex:'Sechskant'};
  const escape=value=>String(value??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const number=value=>{if(value===null||value===undefined||String(value).trim()==='')return null;const n=Number(String(value).replace(',','.'));return Number.isFinite(n)?n:null;};
  const copy=value=>JSON.parse(JSON.stringify(value));
  function specFrom(elements,trim){
    const spec={version:1,coordinateSystem:'tool-parting-plane',elements:elements.map(item=>{
      const next={id:item.id,operation:item.operation,shape:item.shape,side:item.side};
      for(const key of ['start','length','offsetX','offsetY'])next[key]=number(item[key]);
      for(const key of item.shape==='hex'?['acrossFlats']:item.shape==='cone'?['diameter','diameterEnd']:['diameter'])next[key]=number(item[key]);
      return next;
    }),trimming:[]};
    if(trim.mode!=='none'){
      const angles=trim.mode==='hex'?[0,60,120,180,240,300]:[number(trim.angleDeg)];
      spec.trimming=angles.map((angle,index)=>({id:'trim-'+index,side:trim.side,start:number(trim.start),length:number(trim.length),angleDeg:angle,distance:trim.mode==='hex'?(number(trim.acrossFlats)===null?null:number(trim.acrossFlats)/2):number(trim.distance)}));
    }
    return spec;
  }
  function summary(spec,tr=x=>x,fmt=x=>String(x??'—')){
    const lines=[tr('Werkzeugtrennkante')+': z = 0 mm'];
    for(const side of ['punch','die']){
      lines.push(tr(side==='punch'?'Stempelseite':'Matrizenseite')+':');
      for(const item of spec.elements.filter(e=>e.side===side)){
        const size=item.shape==='hex'?'SW '+fmt(item.acrossFlats):'Ø '+fmt(item.diameter)+(item.shape==='cone'?' → '+fmt(item.diameterEnd):'');
        lines.push('  '+item.id+' · '+tr(item.operation==='add'?'Körper':'Aussparung')+' · '+tr(SHAPES[item.shape])+' · '+size+' mm · '+tr('Abstand von Trennkante')+' '+fmt(item.start)+' mm · L '+fmt(item.length)+' mm · X '+fmt(item.offsetX)+' / Y '+fmt(item.offsetY)+' mm');
      }
    }
    if(spec.trimming?.length){lines.push(tr('Beschnitt')+':');for(const item of spec.trimming)lines.push('  '+tr(item.side==='punch'?'Stempelseite':'Matrizenseite')+' · '+tr('Abstand von Trennkante')+' '+fmt(item.start)+' mm · L '+fmt(item.length)+' mm · '+fmt(item.angleDeg)+'° · '+tr('Ebenenabstand')+' '+fmt(item.distance)+' mm');}
    return lines;
  }
  function sectionIntervals(spec,z){
    const at=e=>{const depth=e.side==='punch'?-z:z;if(depth<e.start||depth>e.start+e.length)return null;
      if(e.shape==='hex'){let lo=-Infinity,hi=Infinity;for(let i=0;i<6;i++){const a=i*Math.PI/3,c=Math.cos(a),s=Math.sin(a),edge=e.acrossFlats/2+c*e.offsetX+s*e.offsetY;if(Math.abs(c)<1e-10){if(edge<0)return null;}else if(c>0)hi=Math.min(hi,edge/c);else lo=Math.max(lo,edge/c);}return hi>lo?[lo,hi]:null;}
      const radius=(e.shape==='cone'?e.diameter+(e.diameterEnd-e.diameter)*(depth-e.start)/e.length:e.diameter)/2;
      if(Math.abs(e.offsetY)>=radius)return null;const half=Math.sqrt(radius*radius-e.offsetY*e.offsetY);return [e.offsetX-half,e.offsetX+half];};
    const union=values=>{const out=[];for(const pair of values.filter(Boolean).sort((a,b)=>a[0]-b[0])){const last=out[out.length-1];if(last&&pair[0]<=last[1])last[1]=Math.max(last[1],pair[1]);else out.push(pair.slice());}return out;};
    let solid=union(spec.elements.filter(e=>e.operation==='add').map(at));
    const cuts=union(spec.elements.filter(e=>e.operation==='subtract').map(at));
    for(const trim of spec.trimming||[]){const depth=trim.side==='punch'?-z:z;if(depth<trim.start||depth>trim.start+trim.length)continue;const c=Math.cos(trim.angleDeg*Math.PI/180);if(Math.abs(c)<1e-10){if(trim.distance<0)cuts.push([-Infinity,Infinity]);}else cuts.push(c>0?[trim.distance/c,Infinity]:[-Infinity,trim.distance/c]);}
    for(const [a,b]of cuts)solid=solid.flatMap(([lo,hi])=>b<=lo||a>=hi?[[lo,hi]]:[[lo,Math.min(hi,a)],[Math.max(lo,b),hi]].filter(([l,h])=>h>l));
    return solid;
  }
  // The drawing samples a real Y=0 section; volume/mass come only from the
  // independent geometry model, never from these display-resolution strips.
  function sketch(spec,tr=x=>x){
    const items=spec.elements.filter(e=>Number.isFinite(e.start)&&e.start>=0&&Number.isFinite(e.length)&&e.length>0&&Number.isFinite(e.offsetX)&&Number.isFinite(e.offsetY)&&(e.shape==='cone'?Number.isFinite(e.diameter)&&Number.isFinite(e.diameterEnd)&&e.diameter>=0&&e.diameterEnd>=0&&Math.max(e.diameter,e.diameterEnd)>0:Number.isFinite(e.shape==='hex'?e.acrossFlats:e.diameter)&&(e.shape==='hex'?e.acrossFlats:e.diameter)>0));
    let lo=-10,hi=10,r=8;
    for(const e of items){const end=e.start+e.length;if(e.side==='punch')lo=Math.min(lo,-end);else hi=Math.max(hi,end);r=Math.max(r,Math.abs(e.offsetX)+Math.max(e.diameter||0,e.diameterEnd||0,e.acrossFlats||0)/2);}
    const width=560,height=250,pad=42,scale=Math.min((width-pad*2)/(hi-lo),(height-90)/(r*2)),x=z=>pad+(z-lo)*scale,y=v=>height/2-v*scale;
    const clean={...spec,elements:items,trimming:(spec.trimming||[]).filter(e=>['start','length','distance','angleDeg'].every(key=>Number.isFinite(e[key])))},dz=(hi-lo)/280,paths=[];
    for(let z=lo;z<hi;z+=dz)for(const [a,b]of sectionIntervals(clean,z+dz/2))paths.push('M'+x(z).toFixed(2)+','+y(b).toFixed(2)+'h'+(dz*scale+.08).toFixed(2)+'v'+((b-a)*scale).toFixed(2)+'h-'+(dz*scale+.08).toFixed(2)+'z');
    return '<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+escape(tr('Schnittskizze X–Z, Y = 0'))+'"><title>'+escape(tr('Schnittskizze X–Z, Y = 0'))+'</title><text x="18" y="24" fill="#203d66" font-size="13">'+escape(tr('Stempelseite'))+' z &lt; 0</text><text x="542" y="24" text-anchor="end" fill="#203d66" font-size="13">'+escape(tr('Matrizenseite'))+' z &gt; 0</text><path d="'+paths.join(' ')+'" fill="#8db5df"/><line x1="20" y1="125" x2="540" y2="125" stroke="#8798ae" stroke-dasharray="7 4"/><line x1="'+x(0)+'" x2="'+x(0)+'" y1="38" y2="210" stroke="#c3511b" stroke-width="2"/><text x="'+x(0)+'" y="232" text-anchor="middle" fill="#a34016" font-size="12">z = 0</text></svg>';
  }
  function create({root,view=root,onChange,translate=x=>x,evaluate}){
    let elements=[],trim={mode:'none',side:'punch',start:0,length:'',acrossFlats:'',angleDeg:0,distance:''},step=0,serial=0,options={};
    const features={punch:{kind:'none',complete:false}};
    const tr=s=>translate(s),h=s=>escape(tr(s)),fmt=n=>n==null?'—':Number(n).toLocaleString(global.JYI18N?.numberLocale(global.JYLocale?.language)||'de-DE',{maximumFractionDigits:3});
    const getSpec=()=>specFrom(elements,trim);
    const isComplete=()=>Object.values(features).every(feature=>feature.kind==='none'||feature.complete);
    const getFeatures=()=>features.punch.kind==='claw'?[{side:'punch',type:'claw-head',contourComplete:features.punch.complete}]:[];
    const featureSummary=()=>features.punch.kind==='claw'?[tr('Stempelseite')+': '+tr('Krallenkopf / Umspritz-Mitnahmeprofil')+' · '+tr(features.punch.complete?'Krallenkontur vollständig modelliert':'Krallenkontur nicht vollständig modelliert')]:[];
    const field=(label,value,key,id,kind='element')=>'<label class="feld"><span>'+h(label)+'</span><input type="text" inputmode="decimal" data-geometry-field="'+key+'" data-geometry-kind="'+kind+'"'+(id?' data-element="'+escape(id)+'"':'')+' value="'+escape(value)+'"></label>';
    const select=(label,value,key,id,choices,kind='element')=>'<label class="feld"><span>'+h(label)+'</span><select data-geometry-field="'+key+'" data-geometry-kind="'+kind+'"'+(id?' data-element="'+escape(id)+'"':'')+'>'+choices.map(([v,l])=>'<option value="'+v+'"'+(v===value?' selected':'')+'>'+h(l)+'</option>').join('')+'</select></label>';
    function sideEditor(side){
      const rows=elements.filter(e=>e.side===side).map(e=>{
        const recess=e.shape==='cone'&&e.operation==='subtract';
        const shapes=Object.entries(SHAPES).map(([key,label])=>[key,key==='cone'&&e.operation==='subtract'?'Körner / konische Vertiefung':label]);
        const dimensions=e.shape==='hex'?field('Schlüsselweite in mm',e.acrossFlats,'acrossFlats',e.id):recess?field('Öffnungs-Ø außen in mm',e.diameterEnd,'diameterEnd',e.id)+field('Ø am Grund innen in mm',e.diameter,'diameter',e.id):field(e.shape==='cone'?'Ø trennkantenseitig in mm':'Durchmesser in mm',e.diameter,'diameter',e.id)+(e.shape==='cone'?field('Ø stirnseitig in mm',e.diameterEnd,'diameterEnd',e.id):'');
        return '<div class="geometry-element"><header><strong>'+escape(e.id)+' · '+h(e.operation==='add'?'Körper':'Aussparung')+'</strong><button type="button" data-geometry-remove="'+e.id+'" aria-label="'+h('Element entfernen')+' '+e.id+'">'+h('Entfernen')+'</button></header><div class="felder">'+select('Operation',e.operation,'operation',e.id,[['add','Körper hinzufügen'],['subtract','Aussparung abziehen']])+select('Form',e.shape,'shape',e.id,shapes)+field('Abstand von Trennkante in mm',e.start,'start',e.id)+field('Länge in mm',e.length,'length',e.id)+dimensions+'</div></div>';
      }).join('');
      const feature=side==='punch'?select('Kopf- / Mitnahmeform',features.punch.kind,'kind',side,[['none','Keine besondere'],['claw','Krallenkopf / Umspritz-Mitnahmeprofil']],'feature')+(features.punch.kind==='claw'?'<label class="check"><input type="checkbox" data-geometry-field="complete" data-geometry-kind="feature" data-element="punch"'+(features.punch.complete?' checked':'')+'>'+h('Krallenkontur ist durch die Geometrieelemente beschrieben')+'</label>':''):'';
      return feature+rows+'<div class="knoepfe"><button type="button" class="knopf zwei" data-geometry-add="'+side+'" data-operation="add"'+(elements.length>=32?' disabled':'')+'>'+h('Körper hinzufügen')+'</button><button type="button" class="knopf zwei" data-geometry-add="'+side+'" data-operation="subtract"'+(elements.length>=32?' disabled':'')+'>'+h('Aussparung abziehen')+'</button></div>';
    }
    function panels(){
      let body='';
      if(step===0||step===3)body=sideEditor(step===0?'punch':'die');
      if(step===1)body='<div class="felder">'+select('Beschnitt',trim.mode,'mode',null,[['none','Kein Beschnitt'],['hex','Sechskantbeschnitt'],['plane','Beschnittebene']],'trim')+(trim.mode==='none'?'':select('Werkzeugseite',trim.side,'side',null,[['punch','Stempelseite'],['die','Matrizenseite']],'trim')+field('Abstand von Trennkante in mm',trim.start,'start',null,'trim')+field('Beschnittlänge in mm',trim.length,'length',null,'trim')+(trim.mode==='hex'?field('Schlüsselweite nach Beschnitt in mm',trim.acrossFlats,'acrossFlats',null,'trim'):field('Winkel der Ebenennormale in Grad',trim.angleDeg,'angleDeg',null,'trim')+field('Ebenenabstand in mm',trim.distance,'distance',null,'trim')))+'</div>';
      if(step===2){const extent=side=>Math.max(0,...getSpec().elements.filter(e=>e.operation==='add'&&e.side===side).map(e=>(e.start||0)+(e.length||0)));body='<p>'+h('Werkzeugtrennkante')+': <strong>z = 0 mm</strong></p><dl class="geometry-measures"><div><dt>'+h('Länge auf Stempelseite')+'</dt><dd>'+fmt(extent('punch'))+' mm</dd></div><div><dt>'+h('Länge auf Matrizenseite')+'</dt><dd>'+fmt(extent('die'))+' mm</dd></div></dl><p class="klein">'+h('Die Längen und Abstände jeder Seite beziehen sich auf diese Trennkante.')+'</p>';}
      if(step===4)body=elements.map(e=>'<div class="geometry-element"><header><strong>'+escape(e.id)+' · '+h(e.side==='punch'?'Stempelseite':'Matrizenseite')+' · '+h(e.operation==='add'?'Körper':'Aussparung')+'</strong></header><div class="felder">'+field('Versatz X in mm',e.offsetX,'offsetX',e.id)+field('Versatz Y in mm',e.offsetY,'offsetY',e.id)+'</div></div>').join('')+'<p class="klein">'+h('Versätze beziehen sich auf die Werkzeugachse. X und Y dürfen positiv oder negativ sein.')+'</p>';
      root.dataset.originalText='';root.innerHTML='<nav class="geometry-steps" aria-label="'+h('Geometrieschritte')+'">'+STEPS.map((label,index)=>'<button type="button" data-geometry-step="'+index+'"'+(step===index?' aria-current="step"':'')+'>'+h(label)+'</button>').join('')+'</nav><h3>'+h(STEPS[step])+'</h3>'+body+'<div class="knoepfe">'+(step?'<button type="button" class="knopf zwei" data-geometry-step="'+(step-1)+'">'+h('Zurück')+'</button>':'')+(step<4?'<button type="button" class="knopf zwei" data-geometry-step="'+(step+1)+'">'+h('Weiter')+'</button>':'')+'</div>';
    }
    function refresh(nextOptions){
      if(nextOptions)options=nextOptions;
      const spec=getSpec(),result=evaluate?.(spec,options),range=(single,bounds,unit)=>single!=null?fmt(single)+' '+unit:Array.isArray(bounds)?fmt(bounds[0])+'–'+fmt(bounds[1])+' '+unit:tr('nicht belegt');
      const complete=isComplete();
      const metrics=result?.valid?'<dl class="geometry-measures"><div><dt>'+h(complete?'Volumen':'Volumen der Grundgeometrie')+'</dt><dd>'+range(result.volumeMm3,result.volumeBoundsMm3,'mm³')+'</dd></div><div><dt>'+h('Masse Fertigteil')+'</dt><dd>'+(complete?range(result.massG,result.massBoundsG,'g'):h('Kontur noch unvollständig'))+'</dd></div><div><dt>'+h('Abschnittlänge')+'</dt><dd>'+(complete?range(result.blankLengthMm,result.blankLengthBoundsMm,'mm'):h('Kontur noch unvollständig'))+'</dd></div><div><dt>'+h('Volumenberechnung')+'</dt><dd>'+h(result.volumeStatus==='exact'?'analytisch':'Intervall')+'</dd></div></dl>':'';
      const densityNote=complete&&result?.valid&&options.densityStatus==='reference-steel-density'?'<p class="klein">'+h('Gewicht mit Stahl-Bezugsdichte 7,85 g/cm³; Näherungswert')+'</p>':'';
      const texts=items=>[...new Set((items||[]).map(item=>typeof item==='string'?item:item.message).filter(Boolean))],errors=texts(result?.errors),warnings=texts(result?.warnings);
      view.dataset.originalText='';view.innerHTML='<h2>'+h('Teilaufbau')+'</h2><div class="geometry-sketch">'+sketch(spec,tr)+'</div><p class="klein">'+h('Schnittskizze X–Z, Y = 0')+'</p>'+metrics+densityNote+(errors.length?'<ul class="geometry-issues" role="status">'+errors.map(text=>'<li>'+h(text)+'</li>').join('')+'</ul>':'')+(warnings.length?'<details><summary>'+h('Rechenbasis und offene Punkte')+'</summary><ul class="klein">'+warnings.map(text=>'<li>'+h(text)+'</li>').join('')+'</ul></details>':'')+'<details'+(step===4?' open':'')+'><summary>'+h('Geometrieübersicht')+'</summary><pre class="klein" style="white-space:pre-wrap">'+escape([...summary(spec,tr,fmt),...featureSummary()].join('\n'))+'</pre></details>';
      return result;
    }
    function changed(){if(onChange)onChange();else refresh();}
    root.addEventListener('click',event=>{
      const action=event.target.closest('button');if(!action)return;
      if(action.dataset.geometryStep!==undefined){step=Math.max(0,Math.min(4,Number(action.dataset.geometryStep)));panels();refresh();return;}
      if(action.dataset.geometryRemove){elements=elements.filter(e=>e.id!==action.dataset.geometryRemove);panels();changed();return;}
      if(action.dataset.geometryAdd&&elements.length<32){elements.push({id:'E'+(++serial),operation:action.dataset.operation==='subtract'?'subtract':'add',shape:'cylinder',side:action.dataset.geometryAdd,start:0,length:'',diameter:'',diameterEnd:'',acrossFlats:'',offsetX:0,offsetY:0});panels();changed();}
    });
    const input=event=>{const node=event.target,key=node.dataset.geometryField;if(!key)return;const target=node.dataset.geometryKind==='trim'?trim:node.dataset.geometryKind==='feature'?features[node.dataset.element]:elements.find(e=>e.id===node.dataset.element);if(!target)return;
      const old=target[key];target[key]=node.type==='checkbox'?node.checked:node.value;
      if(old!==target[key]&&node.dataset.geometryKind==='element'){
        if(key==='shape'&&target.shape==='cone'&&target.operation==='subtract'){target.diameterEnd=target.diameter;target.diameter=0;}
        else if(key==='operation'&&target.shape==='cone'){const diameter=target.diameter;target.diameter=target.diameterEnd;target.diameterEnd=diameter;}
      }
      if(node.tagName==='SELECT')panels();changed();};
    root.addEventListener('input',input);root.addEventListener('change',event=>{if(event.target.tagName==='SELECT')input(event);});
    panels();refresh();
    return {getSpec,getFeatures,refresh,isComplete,featureSummary,rerender(){panels();return refresh();},summary:()=>[...summary(getSpec(),tr,fmt),...featureSummary()],setElements(value){elements=copy(value);serial=elements.length;panels();changed();}};
  }
  const api={create,specFrom,summary,sketch,sectionIntervals};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(global)global.JYGeometryWizard=api;
})(typeof window==='object'?window:globalThis);
