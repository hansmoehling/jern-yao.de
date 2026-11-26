(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JYKvpContext=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const pos=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
 function fromCalculation({source='manual',input={},values={},material,stages,selectedModel,chain}={}){
  const d=values.d0??input.d0;if(!pos(d))return null;
  let klasse=input.typ==='mutter'?'mutter':input.typ==='formteil'?'formteil':input.standardKind==='rivet'?'niet':['pin','headless'].includes(input.standardKind)?'bolzen':'schraube';
  let topologie=klasse==='mutter'?(input.nutShape==='cap'?'mutter-sackloch':'mutter-durchgang'):klasse==='formteil'?'unbekannt':input.schaftende==='halbhohl'?'kopf-schaft-napf':'kopf-schaft';
  if(chain?.segments?.length)topologie=chain.recesses?.length?'kopf-schaft-napf':chain.segments.length>1?'stufenkoerper':'massiv';
  const id=material?.id||'',state=input.materialState;
  const group=/^C\d/.test(id)&&state==='soft-annealed'?'unlegiert-weich':/MnB/.test(id)?'borstahl':/^Cu\s?Zn/.test(id)?'messing':/^Cu/.test(id)?'kupfer':/^Al|^EN AW/.test(id)?'aluminium':state==='soft-annealed'&&/Cr|Mo|Ni/.test(id)?'legiert-weich':'unbekannt';
  const merkmale={d0:d,werkstoffgruppe:group};
  if(pos(values.L0))merkmale.L0_d0=values.L0/d;
  if(pos(values.sKopf))merkmale.stauch_h0_d0_max=values.sKopf;
  if(pos(input.d_b)&&pos(input.t_b))merkmale.napf_t_d=input.t_b/input.d_b;
  // Only an explicit tensile-strength entry is a measured/context feature.
  if(pos(input.rm))merkmale.rm=input.rm;
  return {source,features:{klasse,topologie,merkmale},...(Number.isInteger(stages)&&stages>0&&stages<=20?{predictedStages:stages}:{}),selectedModel:selectedModel||null};
 }
 return {fromCalculation};
});
