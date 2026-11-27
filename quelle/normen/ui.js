(function(){
  'use strict';
  window.JYNormPicker={create};
  function create({host,form,data,tr,getType,onApply,getPart,onChange,shaftPolicy,functionPolicy,catalogue=[],formatNumber=value=>String(Math.round(value*100)/100)}){
    const N=window.JYNormLibrary,R=window.JYStandards;
    let document=null,lastKind='',applying=false,lastBoltKind='screw',lengthOrigin='standard';
    const enhancedLengths=shaftPolicy==='shaft-v2';
    const functionalFamilies=functionPolicy==='function-v1';
    const saved=new Map(),sizeReasons=new Map();
    const el=(tag,text,attrs={})=>{const n=window.document.createElement(tag);if(text)n.textContent=tr(text);Object.assign(n,attrs);return n;};
    const title=el('h3','Norm wählen, Maße übernehmen');host.append(title);
    const grid=el('div',null,{className:'felder'});host.append(grid);
    const controls={},wraps={},labels=[['kind','Teilefamilie'],['id','Normvorlage'],['form','Ausführung'],['groesse','Größe'],['laenge','Länge in mm'],['steigung','Steigung in mm'],['festigkeitsklasse','Festigkeitsklasse']];let lengthToggle,lengthValue,lengthOpen=false,lengthInput,lengthRange;
    for(const [key,label]of labels){
      const wrap=el(key==='laenge'?'div':'label',null,{className:'feld'+(key==='id'?' voll':'')});wrap.append(el('span',label));wraps[key]=wrap;
      const select=el('select',null,{id:'norm-'+key});select.setAttribute('aria-label',tr(label));wrap.append(select);grid.append(wrap);controls[key]=select;
      if(key==='laenge'){
        lengthToggle=el('button',null,{id:'norm-laenge-toggle',type:'button',className:'norm-length-toggle'});
        lengthValue=el('span');const arrow=el('span','▾');arrow.setAttribute('aria-hidden','true');lengthToggle.append(lengthValue,arrow);
        lengthToggle.setAttribute('aria-controls',select.id);lengthToggle.setAttribute('aria-expanded','false');lengthToggle.setAttribute('aria-haspopup','listbox');
        wrap.replaceChildren(wrap.children[0],lengthToggle,select);select.hidden=true;
        if(enhancedLengths){
          lengthInput=el('input',null,{id:'norm-laenge-custom',type:'number',min:'0.01',step:'any',inputMode:'decimal',hidden:true,value:''});
          lengthInput.setAttribute('aria-label',tr('Individuelle Länge in mm'));wrap.append(lengthInput);
          lengthRange=el('p',null,{id:'norm-length-range',className:'klein',hidden:true});wrap.append(lengthRange);
          lengthInput.addEventListener('input',()=>choose('customLength'));lengthInput.addEventListener('change',()=>choose('customLength'));
        }
        lengthToggle.addEventListener('click',()=>setLengthOpen(!lengthOpen,true));
        lengthToggle.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();setLengthOpen(true,true);}});
        const closeLength=()=>{setLengthOpen(false,!(enhancedLengths&&select.value==='custom'));if(enhancedLengths&&select.value==='custom')lengthInput.focus();};
        select.addEventListener('click',closeLength);
        select.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();setLengthOpen(false,true);}else if(['Enter',' '].includes(event.key)){event.preventDefault();choose('laenge');closeLength();}});
      }
      select.addEventListener('change',()=>choose(key));
    }
    function setLengthOpen(open,focus=false){
      lengthOpen=!!open&&!controls.laenge.disabled;controls.laenge.hidden=!lengthOpen;lengthToggle.setAttribute('aria-expanded',String(lengthOpen));
      if(focus)(lengthOpen?controls.laenge:lengthToggle).focus();
    }
    function refreshLength(){
      const field=controls.laenge,value=field.value==='custom'?tr('Andere Länge …'):field.value?field.value+' mm':'—';lengthValue.textContent=value;
      lengthToggle.disabled=field.disabled;lengthToggle.setAttribute('aria-label',tr(family()?.id==='ISO13918'?'Länge vor dem Schweißen in mm':'Länge in mm')+': '+value);
      // size >= 2 guarantees an in-document list rather than an OS popup,
      // including a family for which only one length is documented.
      field.size=Math.max(2,Math.min(6,field.options.length));if(field.disabled)setLengthOpen(false);
      if(enhancedLengths){
        const custom=field.value==='custom';lengthToggle.hidden=!N.lengths(family(),controls.groesse.value).length;
        lengthInput.hidden=!custom||!family();lengthInput.disabled=!family();lengthInput.setAttribute('aria-label',tr(family()?.id==='ISO13918'?'Länge vor dem Schweißen in mm':'Individuelle Länge in mm'));
        lengthRange.hidden=!custom||!family();lengthRange.textContent=lengthRange.hidden?'':lengthRangeText();
      }
    }
    function availabilityPart(size=controls.groesse.value){
      if(!baseFamily()||!size)return null;
      try{return N.adapt(data,R.resolveStandard(N.selectionLibrary(data,{id:controls.id.value,form:controls.form.value}),{id:controls.id.value,groesse:size,...(controls.form.value?{form:controls.form.value}:{})},{},{shaftPolicy}));}catch{return null;}
    }
    function lengthRangeText(){
      const range=window.JYNormAvailability?.lengthAvailability({part:availabilityPart()||{},catalogue}),product=range?.productLength?.max,cutoff=range?.cutoffLength;
      const text=(key,values)=>tr(key).replace(/\{(\w+)\}/g,(all,key)=>typeof values[key]==='number'?formatNumber(values[key]):values[key]??all);
      const parts=[];
      if(product>0)parts.push(text('Dokumentierte Produktlängen im Maschinenkatalog: bis {value} mm.',{value:product}));
      if(cutoff?.min>0&&cutoff?.max>0)parts.push(text('Dokumentierte Abschnittlängen {min}–{max} mm; der Abschnitt wird aus dem Volumen berechnet.',{min:cutoff.min,max:cutoff.max}));
      return parts.join(' ')||tr('Individuelle Länge eingeben; die Maschinenprüfung folgt aus der vollständigen Geometrie.');
    }
    function sizeLabels(){for(const option of controls.groesse.options){const result=sizeReasons.get(option.value);if(!result)continue;const reason=tr(result.reason).replace(/\{(\w+)\}/g,(all,key)=>typeof result.params?.[key]==='number'?formatNumber(result.params[key]):result.params?.[key]??all);option.title=reason;option.textContent=option.value+' · '+reason;}}
    window.document.addEventListener?.('click',event=>{if(lengthOpen&&!wraps.laenge.contains(event.target))setLengthOpen(false);});
    host.addEventListener('focusout',event=>{if(lengthOpen&&event.relatedTarget&&!wraps.laenge.contains(event.relatedTarget))setLengthOpen(false);});
    const note=el('p','Die Norm ist Ihre Vorlage. Ändern Sie nur, was bei Ihrem Teil abweicht.',{className:'norm-intro'});host.append(note);
    const status=el('p',null,{className:'norm-reference'});status.setAttribute('role','status');host.append(status);
    const changes=el('div',null,{className:'norm-overrides'});host.append(changes);
    const detail=window.document.getElementById('norm-dimensions');
    function options(field,values,selected){field.replaceChildren(...values.map(([value,label])=>el('option',label,{value:String(value)})));field.value=values.some(([v])=>String(v)===String(selected))?String(selected):values[0]?.[0]??'';}
    function selectedFunction(){return getType()==='mutter'?'nut':controls.kind.value||'screw';}
    function kind(){return functionalFamilies?N.functionKind(selectedFunction()):selectedFunction();}
    function availableFamilies(){return functionalFamilies?N.functionFamilies(data,selectedFunction()):N.families(data,kind());}
    function baseFamily(){return data.families.find(f=>f.id===controls.id.value);}
    function family(){return N.variantFamily(baseFamily(),controls.form.value);}
    function fill(resetLength=false){
      const vs=N.variants(baseFamily());options(controls.form,vs.map(v=>[v.id,v.id+' · '+tr(v.label)]),controls.form.value);controls.form.closest('label').hidden=!vs.length;
      const f=family(),s=controls.groesse;
      options(s,N.sizes(f).map(x=>[x,x]),s.value);
      sizeReasons.clear();
      if(enhancedLengths&&window.JYNormAvailability)for(const option of s.options){
        const result=window.JYNormAvailability.sizeAvailability({part:availabilityPart(option.value)||{},catalogue});option.disabled=result?.disabled===true;
        if(option.disabled)sizeReasons.set(option.value,result);
      }
      sizeLabels();
      const ls=N.lengths(f,s.value),oldLength=resetLength&&lengthOrigin!=='customer'?'':controls.laenge.value;
      const lengthChoices=ls.map(x=>[x,x]);if(enhancedLengths&&f)lengthChoices.push(['custom','Andere Länge …']);
      options(controls.laenge,lengthChoices,enhancedLengths&&(lengthOrigin==='customer'||!ls.length)?'custom':oldLength||(!enhancedLengths?'30':''));
      const lengthLabel=f?.id==='ISO13918'?'Länge vor dem Schweißen in mm':'Länge in mm';wraps.laenge.children[0].textContent=tr(lengthLabel);controls.laenge.setAttribute('aria-label',tr(lengthLabel));
      wraps.laenge.hidden=kind()==='nut';controls.laenge.disabled=!ls.length;setLengthOpen(false);refreshLength();
      const row=f?.groessen?.[s.value],allPitches=N.pitches(data,s.value),allowed=row?.steigungen;
      const fixedPitch=row?.thread?.pitch??row?.roh?.P??data.threads?.rows?.[s.value]?.coarse;
      const ps=Array.isArray(allowed)?allPitches.filter(p=>allowed.includes(p)):fixedPitch?[fixedPitch]:allPitches;
      options(controls.steigung,ps.map(x=>[x,String(x)]),row?.roh?.P??row?.vorbelegung?.P??controls.steigung.value);
      controls.steigung.closest('label').hidden=ps.length<=1;
      const classes=kind()==='nut'?['8','10','12','5','6']:kind()==='rivet'?['Stahl','Cu','CuZn','Al']:kind()==='pin'?['Stahl']:['8.8','10.9','12.9','4.6','4.8','5.6','5.8'];
      options(controls.festigkeitsklasse,classes.map(x=>[x,x]),controls.festigkeitsklasse.value);
      for(const key of ['groesse','festigkeitsklasse'])controls[key].disabled=!f;
    }
    function refreshType(force=false){
      host.hidden=getType()==='formteil';if(host.hidden)return;
      const oldKind=controls.kind.value;if(oldKind&&oldKind!=='nut')lastBoltKind=oldKind;
      const choices=functionalFamilies?N.functionChoices().filter(([key])=>getType()==='mutter'?key==='nut':key!=='nut'):[['screw','Schraube'],['rivet','Niet'],['pin','Stift'],['headless','Gewindestift'],['nut','Mutter']];
      options(controls.kind,choices,getType()==='mutter'?'nut':lastBoltKind);
      controls.kind.closest('label').hidden=getType()==='mutter';
      if(functionalFamilies&&getType()!=='mutter')form.elements.standardKind.value=kind();
      if(lastKind!==selectedFunction()||force){
        if(lastKind&&lastKind!==selectedFunction()){saved.set(lastKind,document);document=saved.get(selectedFunction())||null;}
        const id=controls.id.value;
        options(controls.id,[['','Ohne Normvorgabe'],...availableFamilies().filter(f=>N.sizes(f).length||N.variants(f).length).map(f=>[f.id,N.familyLabel(f,tr)])],document?.standardReference.id||id);
        lastKind=selectedFunction();fill();
        if(enhancedLengths){lengthOrigin=document?.lengthSelection?.origin||'standard';lengthInput.value=lengthOrigin==='customer'&&document?.lengthSelection?.value!=null?String(document.lengthSelection.value):'';}
        if(document){if(document.standardReference.form!=null){controls.form.value=document.standardReference.form;fill();}for(const key of ['groesse','laenge','steigung','festigkeitsklasse'])if(document.standardReference[key]!=null)controls[key].value=String(document.standardReference[key]);fill();onApply(N.adapt(data,document));}
      }
      render();
    }
    function choose(key){
      if(key==='kind'){
        const wasThreadless=['rivet','pin'].includes(form.elements.standardKind.value);
        form.elements.standardKind.value=controls.kind.value==='nut'?'screw':functionalFamilies?N.functionKind(controls.kind.value):controls.kind.value;
        form.elements.typ.value=controls.kind.value==='nut'?'mutter':'bolzen';
        if(functionalFamilies&&controls.kind.value==='free'&&wasThreadless)for(const name of ['threadFamily','iTyp'])if(form.elements[name])form.elements[name].value='none';
        controls.id.value='';refreshType(true);if(!document&&functionalFamilies&&kind()==='headless')onApply({standardKind:'headless',kopfForm:'none',kD:0,kH:0,kSW:0});detail.open=!document||detail.open;onChange();return;
      }
      if(key==='id'||key==='form'||key==='groesse')fill(enhancedLengths);
      if(enhancedLengths&&key==='laenge'){
        lengthOrigin=controls.laenge.value==='custom'?'customer':'standard';
        if(lengthOrigin==='customer'&&!lengthInput.value&&document?.standardReference.laenge!=null)lengthInput.value=String(document.standardReference.laenge);
        if(lengthOrigin==='standard')lengthInput.value='';refreshLength();if(lengthOrigin==='customer')lengthInput.focus();
      }
      if(key==='customLength')lengthOrigin='customer';
      if(!family()){document=null;render();detail.open=true;onChange();return;}
      const selection={id:controls.id.value,groesse:controls.groesse.value,festigkeitsklasse:controls.festigkeitsklasse.value};
      if(controls.form.value)selection.form=controls.form.value;
      const length=enhancedLengths&&controls.laenge.value==='custom'?Number(String(lengthInput.value).replace(',','.')):Number(controls.laenge.value);
      if(Number.isFinite(length)&&length>0&&kind()!=='nut')selection.laenge=length;
      if(controls.steigung.value)selection.steigung=Number(controls.steigung.value);
      const previous=document?R.snapshot(document):{};previous.partSnapshot=getPart();
      document=R.resolveStandard(N.selectionLibrary(data,selection),selection,previous,enhancedLengths?{shaftPolicy,lengthOrigin}:{});
      apply();
    }
    function apply(){applying=true;onApply(N.adapt(data,document));applying=false;render();if(!Object.keys(document.overrides).length&&!N.adapt(data,document).normMissingFields.length&&(kind()==='nut'||controls.laenge.value))detail.open=false;onChange();}
    function render(){
      for(const [key,label]of labels){
        const source=key==='laenge'&&family()?.id==='ISO13918'?'Länge vor dem Schweißen in mm':label;
        wraps[key].children[0].textContent=tr(source);controls[key].setAttribute('aria-label',tr(source));
      }
      // Rebuild translated labels without resolving the norm again: a language
      // change must keep dimensions, the chosen variant and all customer edits.
      options(controls.id,[['','Ohne Normvorgabe'],...availableFamilies().filter(f=>N.sizes(f).length||N.variants(f).length).map(f=>[f.id,N.familyLabel(f,tr)])],controls.id.value);
      options(controls.form,N.variants(baseFamily()).map(v=>[v.id,v.id+' · '+tr(v.label)]),controls.form.value);
      const free=functionalFamilies&&selectedFunction()==='free';
      for(const key of ['id','groesse','festigkeitsklasse'])wraps[key].hidden=free;
      wraps.form.hidden=free||!N.variants(baseFamily()).length;wraps.laenge.hidden=free||kind()==='nut';wraps.steigung.hidden=free||controls.steigung.options.length<=1;
      for(const option of controls.festigkeitsklasse.options)option.textContent=tr(option.value);
      if(enhancedLengths){for(const option of controls.laenge.options)if(option.value==='custom')option.textContent=tr('Andere Länge …');sizeLabels();}
      refreshLength();
      title.textContent=tr('Norm wählen, Maße übernehmen');note.textContent=tr('Die Norm ist Ihre Vorlage. Ändern Sie nur, was bei Ihrem Teil abweicht.');
      status.textContent=document?N.reference(document,tr):tr('Freies Teil: Maße unten eingeben.');
      changes.replaceChildren();
      if(!document)return;
      const entries=Object.entries(document.overrides);
      for(const [name,override]of entries){const item=el('div',null,{className:'norm-override'});item.append(el('span',tr('Kundenabweichung')+': '+N.missingLabel(name,tr)+' = '+override.value));if(Object.hasOwn(document.normBaseline.values,name)||Object.hasOwn(document.retainedValues,name)){const reset=el('button','Normmaß wiederherstellen',{type:'button',className:'knopf zwei'});reset.addEventListener('click',()=>{document=R.resetOverride(document,name);apply();});item.append(reset);}changes.append(item);}
      const adapted=N.adapt(data,document),missing=adapted.normMissingFields.filter(key=>key!=='length').map(key=>N.missingLabel(key,tr));
      if(adapted.normMissingFields.includes('length')||kind()!=='nut'&&!(enhancedLengths?document.standardReference.laenge:controls.laenge.value)&&!document.overrides.sL)changes.append(el('p','Bitte Länge eingeben.',{className:'norm-missing'}));
      if(missing.length)changes.append(el('p',tr('Noch zu ergänzen')+': '+missing.join(', '),{className:'norm-missing'}));
      if(adapted.normRequiresGeometryReview&&adapted.normMissingFields.some(key=>key!=='length'))changes.append(el('p','Für diese Ausführung die fehlende Kontur im Baukasten ergänzen. Die belegten Normmaße bleiben erhalten.',{className:'norm-missing'}));
      if(adapted.threadModel)changes.append(el('p','Rollrohling und Mutterloch sind Prozessvorbelegungen. Festigkeitsklasse und Drahtzustand sind getrennte Angaben.',{className:'klein'}));
      if(missing.length)detail.open=true;
    }
    const fields=new Set(['kopfForm','kD','kSW','kH','kVol','sD','sL','iTyp','iSize','iSW','iT','iVol','nutShape','nutFlange','mM','mSW','mH','mLoch','mFlansch','mFlanschH','d_b','t_b','schaftende','bottomShape','bottomAngle','boreDepthMode','kC','capHeight','flangeDiameter','flangeHeight','threadFamily','tipLength','tipDiameter','tipAngle','endLength','endDiameter','tipArea','sArea']);
    function edit(event){
      const input=event.target;if(applying||!document||!fields.has(input.name))return;
      const raw=String(input.value??'').trim(),value=input.type==='checkbox'?input.checked:input.tagName==='SELECT'?raw:Number(raw.replace(',','.'));
      if(input.type!=='checkbox'&&(raw===''||typeof value==='number'&&!Number.isFinite(value)))return;
      document.partSnapshot=getPart();document=R.setOverride(document,input.name,value);render();onChange();
    }
    form.addEventListener('input',edit);form.addEventListener('change',edit);
    refreshType();
    function current(){if(document)document.partSnapshot=getPart();return document;}
    return {refreshType,partFunction:()=>functionalFamilies?selectedFunction():document?N.familyFunction(baseFamily()):null,document:()=>current()?R.snapshot(document):null,adapted:()=>current()?N.adapt(data,document):null,
      reset(){document=null;saved.clear();controls.id.value='';if(enhancedLengths){lengthOrigin='standard';lengthInput.value='';}render();},
      select(selection){const f=data.families.find(x=>x.id===selection.id);if(!f)return false;form.elements.typ.value=N.familyKind(f)==='nut'?'mutter':'bolzen';const selected=functionalFamilies?N.familyFunction(f):N.familyKind(f);if(selected!=='nut')lastBoltKind=selected;controls.kind.value=selected;lastKind='';refreshType(true);controls.id.value=f.id;fill();if(selection.form!=null){controls.form.value=selection.form;fill();}controls.groesse.value=selection.groesse;fill();for(const key of ['laenge','steigung','festigkeitsklasse'])if(selection[key]!=null)controls[key].value=String(selection[key]);if(enhancedLengths&&selection.laenge!=null){lengthOrigin=N.lengths(family(),selection.groesse).includes(String(selection.laenge))?'standard':'customer';lengthInput.value=lengthOrigin==='customer'?String(selection.laenge):'';if(lengthOrigin==='customer')controls.laenge.value='custom';}choose('selection');return true;},
      summary(){return document?[N.reference(document,tr),...Object.entries(document.overrides).map(([key,x])=>tr('Kundenabweichung')+': '+N.missingLabel(key,tr)+' = '+x.value)].join('\n'):'';}
    };
  }
})();
