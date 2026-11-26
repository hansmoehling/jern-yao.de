(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JYNormToChain=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function fromBolt(e,g){
    if(!g||g.error)throw new Error(g?.error||'Bauteilmaße für die Übernahme ergänzen.');
    const segments=[],recesses=[],trimming=[],notes=[],add=(shape,length,values)=>{if(length>0)segments.push({id:'S'+(segments.length+1),shape,length,offsetX:0,offsetY:0,...values});};
    const cap=(D,H)=>{const end=(-D+Math.sqrt(3*D*D+8*H*H))/2;add('cone',H,{diameter:end,diameterEnd:D});notes.push('Kugelabschnitt durch einen Kegelstumpf gleichen Außenvolumens ersetzt. Kontur und Innenprofil-Überschneidung im Baukasten prüfen.');};
    if(['zylinder','krallen'].includes(g.type)){
      if(g.type==='krallen')throw new Error('Krallenkontur als einzelne Geometrieelemente übernehmen.');
      add('cylinder',g.headHeight,{diameter:g.headDiameter});
    }else if(g.type==='sechskant')add('hex',g.headHeight,{acrossFlats:e.kSW});
    else if(g.type==='abgratet'){
      add('cylinder',g.headHeight,{diameter:g.headDiameter});
      for(let i=0;i<6;i++)trimming.push({id:'T'+(i+1),start:0,length:g.headHeight,angleDeg:i*60,distance:e.kSW/2});
      notes.push('Sechskant aus Rundvorform beschnitten; der Abschnitt enthält das Beschnittvolumen.');
    }
    else if(g.type==='sechskant_bund'){const c=e.flangeHeight??e.c;add('hex',g.headHeight-c,{acrossFlats:e.kSW});add('cylinder',c,{diameter:e.flangeDiameter??e.dc});}
    else if(['kugelabschnitt','flachrund'].includes(g.type))cap(g.headDiameter,g.headHeight);
    else if(g.type==='linse'||g.type==='kugelabschnitt_bund'){const f=e.capHeight??e.f,c=e.kC??g.headHeight-f;cap(g.headDiameter,f);add('cylinder',c,{diameter:g.headDiameter});}
    else if(['kegelstumpf','linsensenk'].includes(g.type)){
      if(g.type==='linsensenk')cap(g.headDiameter,e.capHeight??e.f);
      add('cone',g.headHeight-(g.type==='linsensenk'?(e.capHeight??e.f):0),{diameter:g.headDiameter,diameterEnd:e.headBaseDiameter||g.segments[0].diameter});
    }else if(g.type!=='kopflos')throw new Error('Kopfform im Baukasten ergänzen.');
    for(const [i,s]of g.segments.entries()){
      if(g.tip&&i===g.segments.length-1){add('cylinder',s.length-g.tip.length,{diameter:s.diameter});add('cone',g.tip.length,{diameter:s.diameter,diameterEnd:g.tip.diameter});}
      else add('cylinder',s.length,{diameter:s.diameter});
    }
    if((e.iTyp==='hex'||e.iTyp===undefined&&e.iSW>0)&&e.iT>0){
      if(e.iVol>0)throw new Error('Abweichendes Antriebsvolumen benötigt eine passende Profilkontur im Baukasten.');
      recesses.push({id:'I1',from:'A',shape:'hex',acrossFlats:e.iSW,length:e.iT,offsetX:0,offsetY:0,...(notes.some(x=>x.includes('Kugelabschnitt'))?{surfaceIntersection:true}:{})});
      if(notes.length)notes.push('Innenantrieb schneidet eine angenäherte Kopfkontur. Das Netto-Innenvolumen ist eine Modellnäherung, kein exakt übernommenes Normteilvolumen.');
    }
    else if(e.iTyp&&e.iTyp!=='none')throw new Error('Antriebsprofil besitzt noch keine boolesche Kontur. Die Normvorlage bleibt erhalten.');
    if(e.nD>0&&e.nT>0)recesses.push({id:'I'+(recesses.length+1),from:'A',shape:'cylinder',diameter:e.nD,length:e.nT,offsetX:0,offsetY:0});
    if(g.cavity?.volume>0){
      const c=g.cavity;if(c.bottom==='round')throw new Error('Runden Bohrungsgrund im Baukasten ergänzen.');
      recesses.push({id:'I'+(recesses.length+1),from:'B',shape:'cylinder',diameter:c.diameter,length:c.depth,offsetX:0,offsetY:0,...(c.bottom==='cone'?{bottomShape:'cone',bottomAngle:c.angle}:{})});
    }
    return {version:1,segments,recesses,trimming,parting:g.headHeight,flipped:false,modelNotes:notes,standardReference:e.standardReference||null,standardDocument:e.standardDocument?JSON.parse(JSON.stringify(e.standardDocument)):null};
  }
  return Object.freeze({fromBolt});
});
