(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./engine.js'):root.JYK);if(typeof module==='object'&&module.exports)module.exports=api;else root.JYStandardPreview=api;})(typeof window==='object'?window:globalThis,function(defaultEngine){
  'use strict';
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite=x=>typeof x==='number'&&Number.isFinite(x),positive=x=>finite(x)&&x>0;
  const num=x=>Number(x.toFixed(4));let serial=0;
  function render({input={},analysis={},material,translate=x=>x,format,engine=defaultEngine}={}){
    const tr=x=>translate(x),h=x=>esc(tr(x)),fmt=x=>finite(x)?esc(format?format(x):x.toLocaleString('de-DE',{maximumFractionDigits:3})):'—';
    const w=analysis.werte||{},isNut=input.typ==='mutter',notes=[],dimensions=[];
    const calculated=!analysis.fehlt?.length;
    // Display the calculator's numbers verbatim. This module never integrates
    // silhouette strips or computes an alternative volume, mass or blank.
    const measures='<dl class="geometry-measures"><div><dt>'+h('Volumen (Rechenergebnis)')+'</dt><dd>'+fmt(calculated?w.V:null)+' mm³</dd></div><div><dt>'+h('Masse Fertigteil')+'</dt><dd>'+fmt(calculated?w.masse:null)+' g</dd></div><div><dt>'+h('Abschnittlänge')+'</dt><dd>'+fmt(calculated?w.L0:null)+' mm</dd></div></dl>';
    const materialName=typeof material==='string'?material:material?.sourceName||material?.id||analysis.werkstoff?.sourceName||analysis.werkstoff?.id;
    const materialLine=materialName?'<p class="klein">'+h('Werkstoff')+': '+esc(materialName)+'</p>':'';
    let svg='',g=null;
    if(isNut){
      const n=analysis.nutGeometry;
      if(n?.valid&&positive(input.mSW)&&positive(n.totalHeight)){
        const H=n.totalHeight,sw=input.mSW,flange=positive(input.mFlansch)?input.mFlansch:0,c=flange?input.mFlanschH:0;
        const outer=[[0,sw/2],[H-c,sw/2],...(flange?[[H-c,flange/2],[H,flange/2]]:[[H,sw/2]])];
        svg=draw({L:H,maxD:n.maxDiameter,outer,front:{shape:input.nutShape==='square'?'square':'hex',sw,flange,hole:n.holeDiameter},holes:[{id:'nut-bore',points:[[0,n.holeDiameter/2],[H,n.holeDiameter/2]]}],headLength:H});
        dimensions.push(['Schlüsselweite','SW '+fmt(sw)+' mm'],['Höhe',fmt(H)+' mm'],['Bohrungs-Ø','Ø'+fmt(n.holeDiameter)+' mm']);
        if(flange)dimensions.push(['Bund','Ø'+fmt(flange)+' × '+fmt(c)+' mm']);
        notes.push(...(n.assumptions||[]));
      }else notes.push(input.nutShape==='cap'?'Hutmutter: Außenhöhe und Schlüsselweite reichen nicht für eine vollständige Schnittkontur.':'Für die Mutternvorschau Außenmaße und Bohrung ergänzen.');
    }else{
      const profile=['trilobular','duo-taptite'].includes(input.threadFamily)||input.kopfForm==='krallen'||input.kopfTyp==='krallen';
      // Reuse the same geometry helper as the engine. A profile area or a
      // named drive size cannot be reverse-engineered into an exact contour.
      try{g=engine?.boltGeometry?.(input);}catch{g=null;}
      if(g&&!g.error){
        const outer=[];
        for(let i=0;i<=48&&g.headHeight>0;i++){const z=g.headHeight*i/48;outer.push([z,g.wallAt(g.headHeight-z)/2]);}
        let from=0;
        for(const s of g.segments){
          const start=from,end=from+s.length,tipStart=g.tip?g.shaftLength-g.tip.length:Infinity;
          const at=z=>g.tip&&z>=tipStart?g.shaftDiameterAt(z)/2:s.diameter/2;
          outer.push([g.headHeight+start,at(start)]);
          if(tipStart>start&&tipStart<end)outer.push([g.headHeight+tipStart,s.diameter/2]);
          outer.push([g.headHeight+end,at(end)]);from=end;
        }
        const holes=[],drive=analysis.antrieb;
        const driveType=drive?.family||input.iTyp;
        if(driveType==='hex'&&positive(input.iSW)&&positive(input.iT))holes.push({id:'head-drive',points:[[0,input.iSW/2],[input.iT,input.iSW/2]]});
        else if(driveType&&driveType!=='none')notes.push('Das Innenprofil ist ohne maßhaltige Kontur nur als Bezeichnung dargestellt.');
        if(positive(input.nD)&&positive(input.nT))holes.push({id:'head-cavity',points:[[0,input.nD/2],[input.nT,input.nD/2]]});
        const end=g.cavity;
        if(end?.volume>0){
          const a=g.totalLength-end.depth,b=g.totalLength-end.cylinderDepth,r=end.diameter/2;
          let points=[[a,r],[g.totalLength,r]];
          if(end.bottom==='cone')points=[[a,0],[b,r],[g.totalLength,r]];
          if(end.bottom==='round'){points=Array.from({length:25},(_,i)=>{const z=a+(b-a)*i/24;return [z,Math.sqrt(Math.max(0,r*r-(b-z)**2))];});points.push([g.totalLength,r]);}
          holes.push({id:'shaft-end-bore',points});dimensions.push(['Bohrung am Schaftende','Ø'+fmt(end.diameter)+' × '+fmt(end.depth)+' mm']);
        }
        notes.push(...(end?.notes||[]));
        const shape=['sechskant','abgratet','sechskant_bund'].includes(g.type)?'hex':'circle';
        svg=draw({L:g.totalLength,maxD:Math.max(g.headDiameter,g.shaftMax),outer,holes,headLength:g.headHeight,approximate:profile,front:{shape,sw:input.kSW,diameter:g.headHeight?g.headDiameter:g.segments[0].diameter,flange:g.type==='sechskant_bund'?input.flangeDiameter??input.dc:0,drive:driveType==='hex'?input.iSW:null,driveLabel:driveType&&driveType!=='none'?tr(drive?.label||input.iSize||'Innenantrieb'):''}});
        if(g.headHeight)dimensions.push(['Kopf','Ø'+fmt(g.headDiameter)+' × '+fmt(g.headHeight)+' mm']);
        dimensions.push(['Schaft',g.segments.map(s=>'Ø'+fmt(s.diameter)+' × '+fmt(s.length)+' mm').join(' · ')]);
        if(g.tip)dimensions.push(['Spitze','Ø'+fmt(g.tip.diameter)+' × '+fmt(g.tip.length)+' mm']);
        if(profile)notes.push('Hüllkontur dargestellt; die tatsächliche Profilform ist nicht aus der Querschnittsfläche ableitbar.');
      }else notes.push(g?.error||'Für die Teilevorschau Kopf- und Schaftmaße ergänzen.');
    }
    if(svg)notes.unshift('Schnitt und Stirnansicht zeigen das Rechenmodell. Gewindegänge, kleine Fasen und Radien sind nicht dargestellt.');
    return '<section class="standard-preview" aria-label="'+h('Teilevorschau')+'"><h2>'+h('Teilevorschau')+'</h2>'+(svg?'<div class="geometry-sketch">'+svg+'</div>':'')+materialLine+(dimensions.length?'<dl class="geometry-measures">'+dimensions.map(([name,value])=>'<div><dt>'+h(name)+'</dt><dd>'+value+'</dd></div>').join('')+'</dl>':'')+measures+(notes.length?'<ul class="klein standard-preview-notes">'+[...new Set(notes)].map(note=>'<li>'+h(note)+'</li>').join('')+'</ul>':'')+'</section>';

    function draw({L,maxD,outer,holes=[],front,headLength=0,approximate=false}){
      if(!positive(L)||!positive(maxD)||outer.some(p=>p.some(x=>!finite(x))))return '';
      const scale=Math.min(385/L,125/maxD),x=z=>num(35+z*scale),y=r=>num(110-r*scale),radius=maxD/2*scale;
      const points=top=>top.concat(top.slice().reverse().map(([z,r])=>[z,-r])).map(([z,r])=>x(z)+','+y(r)).join(' ');
      const id='standard-preview-clip-'+(++serial),outline=points(outer),cx=535,cy=110;
      const poly=(sides,sw)=>Array.from({length:sides},(_,i)=>{const angle=(sides===4?45:30)+i*360/sides,r=sw/(2*Math.cos(Math.PI/sides))*scale;return num(cx+r*Math.cos(angle*Math.PI/180))+','+num(cy+r*Math.sin(angle*Math.PI/180));}).join(' ');
      let face='';
      if(front.flange)face+='<circle cx="'+cx+'" cy="'+cy+'" r="'+num(front.flange/2*scale)+'" fill="#c1d8e9" stroke="#24394d"/>';
      if(['hex','square'].includes(front.shape)&&positive(front.sw))face+='<polygon points="'+poly(front.shape==='square'?4:6,front.sw)+'" fill="#c1d8e9" stroke="#24394d"/>';
      else face+='<circle cx="'+cx+'" cy="'+cy+'" r="'+num((front.diameter||maxD)/2*scale)+'" fill="#c1d8e9" stroke="#24394d"'+(approximate?' stroke-dasharray="4 3"':'')+'/>';
      if(positive(front.hole))face+='<circle cx="'+cx+'" cy="'+cy+'" r="'+num(front.hole/2*scale)+'" fill="white" stroke="#24394d"/>';
      if(positive(front.drive))face+='<polygon points="'+poly(6,front.drive)+'" fill="white" stroke="#24394d"/>';
      const dim=(a,b,ypos,text)=>'<path d="M'+x(a)+' '+ypos+' H'+x(b)+' M'+x(a)+' '+(ypos-4)+' V'+(ypos+4)+' M'+x(b)+' '+(ypos-4)+' V'+(ypos+4)+'" fill="none" stroke="#526a80"/><text x="'+num((x(a)+x(b))/2)+'" y="'+(ypos+16)+'" text-anchor="middle" font-size="12">'+esc(text)+'</text>';
      return '<svg viewBox="0 0 620 270" role="img" aria-label="'+h('Längsschnitt und Stirnansicht des Rechenmodells')+'"><title>'+h('Längsschnitt und Stirnansicht des Rechenmodells')+'</title><defs><clipPath id="'+id+'"><polygon points="'+outline+'"/></clipPath></defs><text x="35" y="22" font-size="13">'+h('Längsschnitt A → B')+'</text><text x="535" y="22" text-anchor="middle" font-size="13">'+h('Stirnansicht A')+'</text><polygon data-preview="outer" points="'+outline+'" fill="#c1d8e9" stroke="#24394d"'+(approximate?' stroke-dasharray="5 3"':'')+'/>'+holes.map(hole=>'<polygon data-preview="'+hole.id+'" data-start-mm="'+num(hole.points[0][0])+'" data-end-mm="'+num(hole.points.at(-1)[0])+'" points="'+points(hole.points)+'" fill="white" stroke="#24394d" clip-path="url(#'+id+')"/>').join('')+'<path d="M20 110 H440" stroke="#8094a4" stroke-dasharray="5 4"/>'+face+'<path d="M'+(cx-radius-9)+' 110 H'+(cx+radius+9)+' M535 '+(cy-radius-9)+' V'+(cy+radius+9)+'" stroke="#8094a4" stroke-dasharray="5 4"/>'+dim(0,L,207,tr('Gesamtlänge')+' '+String(format?format(L):num(L))+' mm')+(headLength>0&&headLength<L?dim(0,headLength,241,tr('Kopf'))+dim(headLength,L,241,tr('Schaft')):'')+(front.driveLabel?'<text x="535" y="205" text-anchor="middle" font-size="12">'+esc(front.driveLabel)+'</text>':'')+'</svg>';
    }
  }
  return Object.freeze({render});
});
