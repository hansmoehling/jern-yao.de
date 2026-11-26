(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JYAxialChain=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  const positive=x=>finite(x)&&x>0;
  const counter=(chain,prefix)=>Math.max(chain.idCounters?.[prefix]||0,...[...(chain.segments||[]),...(chain.recesses||[]),...(chain.trimming||[])].map(x=>Number(x?.id?.match(new RegExp('^'+prefix+'(\\d+)$'))?.[1])||0));
  function allocateId(chain,prefix){chain.idCounters={...chain.idCounters,[prefix]:counter(chain,prefix)+1};return prefix+chain.idCounters[prefix];}
  function retainIds(chain,other){const next=clone(chain);next.idCounters=Object.fromEntries(['S','I','T'].map(p=>[p,Math.max(counter(chain,p),counter(other,p))]));return next;}
  function ranges(chain){let a=0;return chain.segments.map(s=>{const item={...s,a,b:a+s.length};a=item.b;return item;});}
  function totalLength(chain){return chain.segments.reduce((a,s)=>a+s.length,0);}
  function area(s,atEnd=false){return s.shape==='hex'?Math.sqrt(3)/2*s.acrossFlats**2:Math.PI/4*(atEnd&&s.shape==='cone'?s.diameterEnd:s.diameter)**2;}
  function suggestedParting(chain){const rows=ranges(chain);let best=0,p=rows[0]?.b||0;for(let i=0;i<rows.length-1;i++){const jump=area(rows[i],true)-area(rows[i+1]);if(jump>best){best=jump;p=rows[i].b;}}return p;}
  function validate(chain){
    const errors=[],ids=new Set();
    if(!chain||chain.version!==1||!Array.isArray(chain.segments)||!Array.isArray(chain.recesses)||chain.trimming!==undefined&&!Array.isArray(chain.trimming)||chain.flipped!==undefined&&typeof chain.flipped!=='boolean')return ['Ungültige Aufbaukette.'];
    if([...chain.segments,...chain.recesses,...(chain.trimming||[])].some(s=>!s||typeof s!=='object'||Array.isArray(s)))return ['Ungültige Aufbaukette.'];
    if(chain.idCounters!==undefined&&(!chain.idCounters||typeof chain.idCounters!=='object'||Object.values(chain.idCounters).some(n=>!Number.isSafeInteger(n)||n<0)))return ['Ungültige Aufbaukette.'];
    if(!chain.segments.length)errors.push('Mindestens ein Außenkontursegment anlegen.');
    for(const s of [...chain.segments,...chain.recesses]){
      if(!(chain.segments.includes(s)?/^S[1-9][0-9]*$/:/^I[1-9][0-9]*$/).test(s.id)||ids.has(s.id))errors.push('Jedes Segment benötigt eine eindeutige Kennung.');ids.add(s.id);
      if(!['cylinder','cone','hex'].includes(s.shape))errors.push('Nicht unterstützte Segmentform.');
      if(!positive(s.length))errors.push('Segmentlänge muss positiv sein.');
      if(s.shape==='hex'?!positive(s.acrossFlats):s.shape==='cone'?!finite(s.diameter)||!finite(s.diameterEnd)||Math.min(s.diameter,s.diameterEnd)<0||Math.max(s.diameter,s.diameterEnd)<=0:!positive(s.diameter))errors.push('Segmentdurchmesser oder Schlüsselweite fehlt.');
      for(const key of ['offsetX','offsetY'])if(s[key]!=null&&!finite(s[key]))errors.push('Achsversatz muss eine endliche Zahl sein.');
      for(const key of ['diameter','diameterEnd','acrossFlats','length','offsetX','offsetY'])if(finite(s[key])&&Math.abs(s[key])>1000)errors.push('Einzelmaße dürfen 1000 mm nicht überschreiten.');
    }
    const L=totalLength(chain);
    if(!finite(chain.parting)||chain.parting<0||chain.parting>L)errors.push('Trennkante muss innerhalb des Teils liegen.');
    if(L>1000)errors.push('Gesamtlänge darf 1000 mm nicht überschreiten.');
    for(const s of chain.recesses){
      if(!['A','B','boundary'].includes(s.from))errors.push('Beginn der Innenkontur eindeutig auswählen.');
      const anchor=s.from==='A'?0:s.from==='B'?L:ranges(chain).find(x=>x.id===s.after)?.b;
      const end=s.from==='B'?anchor-s.length:anchor+s.length;
      if(!finite(anchor)||end<0||end>L)errors.push('Innenkontur muss innerhalb der Gesamtlänge liegen.');
      if(s.bottomShape==='cone'){
        const tip=s.diameter/2/Math.tan(s.bottomAngle*Math.PI/360);
        if(s.shape!=='cylinder'||!positive(s.bottomAngle)||s.bottomAngle>=180||!finite(tip)||tip>s.length)errors.push('Kegelgrund passt nicht in die Gesamttiefe.');
      }
      if(s.bottomShape!==undefined&&!['flat','cone'].includes(s.bottomShape))errors.push('Bohrungsgrund als flach oder kegelig angeben.');
    }
    for(const t of chain.trimming||[]){
      if(!/^T[1-9][0-9]*$/.test(t.id)||ids.has(t.id))errors.push('Jedes Segment benötigt eine eindeutige Kennung.');ids.add(t.id);
      if(!finite(t.start)||!positive(t.length)||t.start<0||t.start+t.length>L||!finite(t.angleDeg)||!finite(t.distance)||Math.abs(t.angleDeg)>360||Math.abs(t.distance)>1000)errors.push('Beschnittlage und Schnittebene prüfen.');
    }
    if(!errors.length)for(const s of chain.recesses){
      // Check radial containment in each reached outside segment. Imported
      // curved-head openings are explicitly marked because their surface
      // intersection belongs to the documented contour approximation.
      if(s.surfaceIntersection===true)continue;
      const rows=ranges(chain),a=s.from==='A'?0:s.from==='B'?L-s.length:rows.find(x=>x.id===s.after).b,b=a+s.length;
      const tip=s.bottomShape==='cone'?s.diameter/2/Math.tan(s.bottomAngle*Math.PI/360):0;
      const opening=s.from==='B'?b:a;
      const diameterAt=z=>{const depth=Math.abs(z-opening);return s.shape==='cone'?s.diameter+(s.diameterEnd-s.diameter)*depth/s.length:tip&&depth>s.length-tip?s.diameter*(s.length-depth)/tip:s.diameter;};
      for(const outer of rows){
        const lo=Math.max(a,outer.a),hi=Math.min(b,outer.b);if(hi<=lo)continue;
        const split=s.from==='B'?a+tip:b-tip,checks=[lo,hi,...(tip&&split>lo&&split<hi?[split]:[])];
        for(const z of checks){
          const dx=(s.offsetX||0)-(outer.offsetX||0),dy=(s.offsetY||0)-(outer.offsetY||0),od=outer.shape==='cone'?outer.diameter+(outer.diameterEnd-outer.diameter)*(z-outer.a)/outer.length:outer.diameter;
          let fits=true;
          if(s.shape==='hex'){
            const r=s.acrossFlats/Math.sqrt(3),vertices=Array.from({length:6},(_,i)=>{const theta=(30+i*60)*Math.PI/180;return [dx+r*Math.cos(theta),dy+r*Math.sin(theta)];});
            fits=outer.shape==='hex'?vertices.every(([x,y])=>Array.from({length:6},(_,i)=>x*Math.cos(i*Math.PI/3)+y*Math.sin(i*Math.PI/3)).every(v=>v<outer.acrossFlats/2-1e-9)):vertices.every(([x,y])=>Math.hypot(x,y)<od/2-1e-9);
          }else {const radius=diameterAt(z)/2;fits=outer.shape==='hex'?Array.from({length:6},(_,i)=>dx*Math.cos(i*Math.PI/3)+dy*Math.sin(i*Math.PI/3)+radius).every(v=>v<outer.acrossFlats/2-1e-9):Math.hypot(dx,dy)+radius<od/2-1e-9;}
          if(!fits)errors.push('Innenkontur benötigt eine positive Restwand in jedem erreichten Außenkontursegment.');
        }
      }
    }
    return [...new Set(errors)];
  }
  function project(chain){
    const errors=validate(chain);if(errors.length)return {ok:false,errors,spec:null};
    const L=totalLength(chain),p=chain.parting,elements=[];
    const add=(s,a,b,operation)=>{
      // End diameters refer to A -> B. Reversing the part changes that order.
      let dA=s.diameter,dB=s.shape==='cone'?s.diameterEnd:s.diameter;
      if(chain.flipped){const oldA=a;a=L-b;b=L-oldA;[dA,dB]=[dB,dA];}
      const plane=chain.flipped?L-p:p;
      const cuts=a<plane&&b>plane?[[a,plane],[plane,b]]:[[a,b]];
      cuts.forEach(([lo,hi],index)=>{
        const side=hi<=plane?'punch':'die';
        const out={id:s.id+(cuts.length>1?(side==='punch'?'_p':'_d'):''),operation,shape:s.shape,side,start:side==='punch'?plane-hi:lo-plane,length:hi-lo,offsetX:s.offsetX||0,offsetY:s.offsetY||0};
        if(s.shape==='hex')out.acrossFlats=s.acrossFlats;
        else{const at=x=>dA+(dB-dA)*(x-a)/(b-a);out.diameter=side==='punch'?at(hi):at(lo);if(s.shape==='cone')out.diameterEnd=side==='punch'?at(lo):at(hi);}
        elements.push(out);
      });
    };
    ranges(chain).forEach(s=>add(s,s.a,s.b,'add'));
    chain.recesses.forEach(s=>{
      const b=s.from==='B'?L:s.from==='A'?s.length:ranges(chain).find(x=>x.id===s.after).b+s.length,a=b-s.length;
      if(s.shape==='cylinder'&&s.bottomShape==='cone'){
        const tip=s.diameter/2/Math.tan(s.bottomAngle*Math.PI/360);
        if(s.from==='B'){
          add({...s,id:s.id+'_tip',shape:'cone',diameter:0,diameterEnd:s.diameter},a,a+tip,'subtract');
          if(s.length>tip)add({...s,id:s.id+'_cyl'},a+tip,b,'subtract');
        }else{
          if(s.length>tip)add({...s,id:s.id+'_cyl'},a,b-tip,'subtract');
          add({...s,id:s.id+'_tip',shape:'cone',diameter:s.diameter,diameterEnd:0},b-tip,b,'subtract');
        }
        return;
      }
      // A centre goes from its open diameter towards the bottom. B is reversed.
      const next=s.from==='B'&&s.shape==='cone'?{...s,diameter:s.diameterEnd,diameterEnd:s.diameter}:s;
      add(next,a,b,'subtract');
    });
    const trimming=[];
    for(const t of chain.trimming||[]){
      let a=t.start,b=t.start+t.length;
      if(!finite(a)||!positive(t.length)||a<0||b>L||!finite(t.angleDeg)||!finite(t.distance))return {ok:false,errors:['Beschnittlage und Schnittebene prüfen.'],spec:null};
      if(chain.flipped){const old=a;a=L-b;b=L-old;}
      const plane=chain.flipped?L-p:p,cuts=a<plane&&b>plane?[[a,plane],[plane,b]]:[[a,b]];
      cuts.forEach(([lo,hi],i)=>{const side=hi<=plane?'punch':'die';trimming.push({id:t.id+'_'+i,side,start:side==='punch'?plane-hi:lo-plane,length:hi-lo,angleDeg:t.angleDeg,distance:t.distance});});
    }
    if(elements.length+trimming.length>32)return {ok:false,errors:['Höchstens 32 Geometrie- und Beschnittelemente sind zulässig.'],spec:null};
    return {ok:true,errors:[],spec:{version:1,coordinateSystem:'tool-parting-plane',elements,trimming}};
  }
  function parse(text){
    if(typeof text!=='string')throw new Error('Kurzschreibweise als Text eingeben.');
    // Semicolon/newline-separated chains may use decimal commas. In comma-
    // separated shorthand, decimal values use a point to avoid ambiguity.
    const decimalComma=/[;\n]/.test(text)||(text.match(/[x×]/gi)||[]).length===1;if(decimalComma)text=text.replace(/(\d),(?=\d)/g,'$1.');
    const tokens=text.split(decimalComma?/[;\n]+/:/[,]+/).map(x=>x.trim()).filter(Boolean),segments=[];
    for(const token of tokens){
      const m=token.match(/^(?:(SW|K))?(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?\s*[x×]\s*(\d+(?:\.\d+)?)$/i);
      if(!m)throw new Error('Kurzschreibweise: 12×6, 8×30, K8/6×2, SW13×5.');
      const shape=m[1]?.toUpperCase()==='SW'?'hex':m[1]?.toUpperCase()==='K'?'cone':'cylinder';
      if(shape==='cone'&&!m[3]||shape!=='cone'&&m[3])throw new Error('Kegel benötigt Anfangs- und Enddurchmesser.');
      const s={id:'S'+(segments.length+1),shape,length:Number(m[4]),offsetX:0,offsetY:0};
      if(shape==='hex')s.acrossFlats=Number(m[2]);else{s.diameter=Number(m[2]);if(shape==='cone')s.diameterEnd=Number(m[3]);}
      segments.push(s);
    }
    const chain={version:1,segments,recesses:[],parting:0,flipped:false,trimming:[]};chain.parting=suggestedParting(chain);
    const errors=validate(chain);if(errors.length)throw new Error(errors[0]);return chain;
  }
  function addSegment(chain,index=chain.segments.length){
    if(!Number.isInteger(index)||index<0||index>chain.segments.length)throw new Error('Einfügeposition liegt außerhalb der Aufbaukette.');
    const next=clone(chain),previous=next.segments[Math.max(0,index-1)];
    const s=previous?clone(previous):{shape:'cylinder',length:1,diameter:1,offsetX:0,offsetY:0};s.id=allocateId(next,'S');
    if(previous?.shape==='cone')s.diameter=previous.diameterEnd;
    next.segments.splice(index,0,s);return next;
  }
  function setEnd(chain,id,end){const next=clone(chain),s=ranges(next).find(x=>x.id===id);if(!s||!finite(end)||end<=s.a)throw new Error('Endposition muss hinter dem Segmentanfang liegen.');next.segments.find(x=>x.id===id).length=end-s.a;return next;}
  function remove(chain,id){
    const next=retainIds(chain,chain);
    if(next.recesses.some(s=>s.from==='boundary'&&s.after===id))throw new Error('Innenkontur zuerst einer anderen Segmentgrenze zuordnen.');
    next.segments=next.segments.filter(s=>s.id!==id);next.recesses=next.recesses.filter(s=>s.id!==id);next.trimming=(next.trimming||[]).filter(s=>s.id!==id);
    return next;
  }
  function scale(chain,factor){
    if(!positive(factor))throw new Error('Leitmaß muss positiv sein.');
    const next=clone(chain);
    for(const s of [...next.segments,...next.recesses,...(next.trimming||[])])for(const key of ['diameter','diameterEnd','acrossFlats','length','offsetX','offsetY','start','distance'])if(finite(s[key]))s[key]*=factor;
    next.parting*=factor;if(finite(next.leadDiameterMm))next.leadDiameterMm*=factor;
    const errors=validate(next);if(errors.length)throw new Error(errors[0]);return next;
  }
  function fromTemplate(template,leadDiameter=template.leadDiameterMm){
    if(!positive(template.leadDiameterMm)||!positive(leadDiameter))throw new Error('Leitmaß muss positiv sein.');
    const next=clone(template.chain);next.modelNotes=[...new Set([...(next.modelNotes||[]),...(template.notes||[])])];next.templateId=template.id;next.leadDiameterMm=template.leadDiameterMm;
    return scale(next,leadDiameter/template.leadDiameterMm);
  }
  function volume(chain){return ranges(chain).reduce((v,s)=>v+(s.shape==='cone'?Math.PI*s.length/12*(s.diameter**2+s.diameter*s.diameterEnd+s.diameterEnd**2):area(s)*s.length),0);}
  return Object.freeze({ranges,totalLength,suggestedParting,validate,project,parse,addSegment,setEnd,remove,scale,fromTemplate,allocateId,retainIds,volume,clone});
});
