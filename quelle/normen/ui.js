(function(){
  'use strict';
  window.JYNormPicker={create};
  function create({host,form,data,tr,getType,onApply,getPart,onChange}){
    const N=window.JYNormLibrary,R=window.JYStandards;
    let document=null,lastKind='',applying=false,lastBoltKind='screw';
    const saved=new Map();
    const el=(tag,text,attrs={})=>{const n=window.document.createElement(tag);if(text)n.textContent=tr(text);Object.assign(n,attrs);return n;};
    const title=el('h3','Norm wählen, Maße übernehmen');host.append(title);
    const grid=el('div',null,{className:'felder'});host.append(grid);
    const controls={},wraps={};let lengthToggle,lengthValue,lengthOpen=false;
    for(const [key,label]of [['kind','Teilefamilie'],['id','Normvorlage'],['form','Ausführung'],['groesse','Größe'],['laenge','Länge in mm'],['steigung','Steigung in mm'],['festigkeitsklasse','Festigkeitsklasse']]){
      const wrap=el(key==='laenge'?'div':'label',null,{className:'feld'+(key==='id'?' voll':'')});wrap.append(el('span',label));wraps[key]=wrap;
      const select=el('select',null,{id:'norm-'+key});select.setAttribute('aria-label',tr(label));wrap.append(select);grid.append(wrap);controls[key]=select;
      if(key==='laenge'){
        lengthToggle=el('button',null,{id:'norm-laenge-toggle',type:'button',className:'norm-length-toggle'});
        lengthValue=el('span');const arrow=el('span','▾');arrow.setAttribute('aria-hidden','true');lengthToggle.append(lengthValue,arrow);
        lengthToggle.setAttribute('aria-controls',select.id);lengthToggle.setAttribute('aria-expanded','false');lengthToggle.setAttribute('aria-haspopup','listbox');
        wrap.replaceChildren(wrap.children[0],lengthToggle,select);select.hidden=true;
        lengthToggle.addEventListener('click',()=>setLengthOpen(!lengthOpen,true));
        lengthToggle.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();setLengthOpen(true,true);}});
        select.addEventListener('click',()=>setLengthOpen(false,true));
        select.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();setLengthOpen(false,true);}else if(['Enter',' '].includes(event.key)){event.preventDefault();choose('laenge');setLengthOpen(false,true);}});
      }
      select.addEventListener('change',()=>choose(key));
    }
    function setLengthOpen(open,focus=false){
      lengthOpen=!!open&&!controls.laenge.disabled;controls.laenge.hidden=!lengthOpen;lengthToggle.setAttribute('aria-expanded',String(lengthOpen));
      if(focus)(lengthOpen?controls.laenge:lengthToggle).focus();
    }
    function refreshLength(){
      const field=controls.laenge,value=field.value?field.value+' mm':'—';lengthValue.textContent=value;
      lengthToggle.disabled=field.disabled;lengthToggle.setAttribute('aria-label',tr(family()?.id==='ISO13918'?'Länge vor dem Schweißen in mm':'Länge in mm')+': '+value);
      // size >= 2 guarantees an in-document list rather than an OS popup,
      // including a family for which only one length is documented.
      field.size=Math.max(2,Math.min(6,field.options.length));if(field.disabled)setLengthOpen(false);
    }
    window.document.addEventListener?.('click',event=>{if(lengthOpen&&!wraps.laenge.contains(event.target))setLengthOpen(false);});
    host.addEventListener('focusout',event=>{if(lengthOpen&&event.relatedTarget&&!wraps.laenge.contains(event.relatedTarget))setLengthOpen(false);});
    const note=el('p','Die Norm ist Ihre Vorlage. Ändern Sie nur, was bei Ihrem Teil abweicht.',{className:'norm-intro'});host.append(note);
    const status=el('p',null,{className:'norm-reference'});status.setAttribute('role','status');host.append(status);
    const changes=el('div',null,{className:'norm-overrides'});host.append(changes);
    const detail=window.document.getElementById('norm-dimensions');
    function options(field,values,selected){field.replaceChildren(...values.map(([value,label])=>el('option',label,{value:String(value)})));field.value=values.some(([v])=>String(v)===String(selected))?String(selected):values[0]?.[0]??'';}
    function kind(){return getType()==='mutter'?'nut':controls.kind.value||'screw';}
    function baseFamily(){return data.families.find(f=>f.id===controls.id.value);}
    function family(){return N.variantFamily(baseFamily(),controls.form.value);}
    function fill(){
      const vs=N.variants(baseFamily());options(controls.form,vs.map(v=>[v.id,v.id+' · '+tr(v.label)]),controls.form.value);controls.form.closest('label').hidden=!vs.length;
      const f=family(),s=controls.groesse;
      options(s,N.sizes(f).map(x=>[x,x]),s.value);
      const ls=N.lengths(f,s.value);options(controls.laenge,ls.map(x=>[x,x]),controls.laenge.value||'30');
      const lengthLabel=f?.id==='ISO13918'?'Länge vor dem Schweißen in mm':'Länge in mm';wraps.laenge.children[0].textContent=tr(lengthLabel);controls.laenge.setAttribute('aria-label',tr(lengthLabel));
      wraps.laenge.hidden=kind()==='nut';controls.laenge.disabled=!ls.length;setLengthOpen(false);refreshLength();
      const row=f?.groessen?.[s.value],allPitches=N.pitches(data,s.value),allowed=row?.steigungen;
      const fixedPitch=row?.thread?.pitch??row?.roh?.P??data.threads?.rows?.[s.value]?.coarse;
      const ps=Array.isArray(allowed)?allPitches.filter(p=>allowed.includes(p)):fixedPitch?[fixedPitch]:allPitches;
      options(controls.steigung,ps.map(x=>[x,String(x)]),row?.roh?.P??row?.vorbelegung?.P??controls.steigung.value);
      controls.steigung.closest('label').hidden=ps.length<=1;
      const classes=kind()==='nut'?['8','10','12','5','6']:['rivet','pin'].includes(kind())?['Stahl']:['8.8','10.9','12.9','4.6','4.8','5.6','5.8'];
      options(controls.festigkeitsklasse,classes.map(x=>[x,x]),controls.festigkeitsklasse.value);
      for(const key of ['groesse','festigkeitsklasse'])controls[key].disabled=!f;
    }
    function refreshType(force=false){
      host.hidden=getType()==='formteil';if(host.hidden)return;
      const oldKind=controls.kind.value;if(oldKind&&oldKind!=='nut')lastBoltKind=oldKind;
      options(controls.kind,[['screw','Schraube'],['rivet','Niet'],['pin','Bolzen'],['headless','Kopfloses Teil'],['nut','Mutter']],getType()==='mutter'?'nut':lastBoltKind);
      controls.kind.closest('label').hidden=getType()==='mutter';
      if(lastKind!==kind()||force){
        if(lastKind&&lastKind!==kind()){saved.set(lastKind,document);document=saved.get(kind())||null;}
        const id=controls.id.value;
        options(controls.id,[['','Ohne Normvorgabe'],...N.families(data,kind()).filter(f=>N.sizes(f).length||N.variants(f).length).map(f=>[f.id,N.familyLabel(f,tr)])],document?.standardReference.id||id);
        lastKind=kind();fill();
        if(document){if(document.standardReference.form!=null){controls.form.value=document.standardReference.form;fill();}for(const key of ['groesse','laenge','steigung','festigkeitsklasse'])if(document.standardReference[key]!=null)controls[key].value=String(document.standardReference[key]);fill();onApply(N.adapt(data,document));}
      }
      render();
    }
    function choose(key){
      if(key==='kind'){
        form.elements.standardKind.value=controls.kind.value==='nut'?'screw':controls.kind.value;
        form.elements.typ.value=controls.kind.value==='nut'?'mutter':'bolzen';
        controls.id.value='';refreshType(true);onChange();return;
      }
      if(key==='id'||key==='form'||key==='groesse')fill();
      if(!family()){document=null;render();detail.open=true;onChange();return;}
      const selection={id:controls.id.value,groesse:controls.groesse.value,festigkeitsklasse:controls.festigkeitsklasse.value};
      if(controls.form.value)selection.form=controls.form.value;
      if(controls.laenge.value&&kind()!=='nut')selection.laenge=Number(controls.laenge.value);
      if(controls.steigung.value)selection.steigung=Number(controls.steigung.value);
      const previous=document?R.snapshot(document):{};previous.partSnapshot=getPart();
      document=R.resolveStandard(N.selectionLibrary(data,selection),selection,previous);
      apply();
    }
    function apply(){applying=true;onApply(N.adapt(data,document));applying=false;render();if(!Object.keys(document.overrides).length&&!N.adapt(data,document).normMissingFields.length&&(kind()==='nut'||controls.laenge.value))detail.open=false;onChange();}
    function render(){
      refreshLength();
      title.textContent=tr('Norm wählen, Maße übernehmen');note.textContent=tr('Die Norm ist Ihre Vorlage. Ändern Sie nur, was bei Ihrem Teil abweicht.');
      status.textContent=document?N.reference(document,tr):tr('Freies Teil: Maße unten eingeben.');
      changes.replaceChildren();
      if(!document)return;
      const entries=Object.entries(document.overrides);
      for(const [name,override]of entries){const item=el('div',null,{className:'norm-override'});item.append(el('span',tr('Kundenabweichung')+': '+name+' = '+override.value));if(Object.hasOwn(document.normBaseline.values,name)||Object.hasOwn(document.retainedValues,name)){const reset=el('button','Normmaß wiederherstellen',{type:'button',className:'knopf zwei'});reset.addEventListener('click',()=>{document=R.resetOverride(document,name);apply();});item.append(reset);}changes.append(item);}
      const missing=N.adapt(data,document).normMissingFields.map(key=>N.missingLabel(key,tr));
      if(kind()!=='nut'&&!controls.laenge.value)missing.push(tr('Länge individuell eingeben; Normlängenreihe noch nicht vollständig belegt.'));
      if(missing.length)changes.append(el('p',tr('Noch zu ergänzen')+': '+missing.join(', '),{className:'norm-missing'}));
      const adapted=N.adapt(data,document);
      if(adapted.normRequiresGeometryReview)changes.append(el('p','Für diese Ausführung die fehlende Kontur im Baukasten ergänzen. Die belegten Normmaße bleiben erhalten.',{className:'norm-missing'}));
      if(adapted.threadModel)changes.append(el('p','Rollrohling und Mutterloch sind Prozessvorbelegungen. Festigkeitsklasse und Drahtzustand sind getrennte Angaben.',{className:'klein'}));
      if(missing.length)detail.open=true;
    }
    const fields=new Set(['kopfForm','kD','kSW','kH','kVol','sD','sL','iTyp','iSize','iSW','iT','iVol','nutShape','nutFlange','mM','mSW','mH','mLoch','mFlansch','mFlanschH','d_b','t_b','schaftende','bottomShape','bottomAngle','boreDepthMode','kC','capHeight','flangeDiameter','flangeHeight','threadFamily','tipLength','tipDiameter','tipAngle','endLength','endDiameter','tipArea','sArea']);
    function edit(event){
      const input=event.target;if(applying||!document||!fields.has(input.name))return;
      const raw=String(input.value??'').trim(),value=input.type==='checkbox'?input.checked:input.tagName==='SELECT'?raw:Number(raw.replace(',','.'));
      if(input.type!=='checkbox'&&(raw===''||typeof value==='number'&&!Number.isFinite(value)))return;
      document.partSnapshot=getPart();document=R.setOverride(document,input.name,value);render();
    }
    form.addEventListener('input',edit);form.addEventListener('change',edit);
    refreshType();
    function current(){if(document)document.partSnapshot=getPart();return document;}
    return {refreshType,document:()=>current()?R.snapshot(document):null,adapted:()=>current()?N.adapt(data,document):null,
      reset(){document=null;saved.clear();controls.id.value='';render();},
      select(selection){const f=data.families.find(x=>x.id===selection.id);if(!f)return false;form.elements.typ.value=N.familyKind(f)==='nut'?'mutter':'bolzen';controls.kind.value=N.familyKind(f);lastKind='';refreshType(true);controls.id.value=f.id;fill();if(selection.form!=null){controls.form.value=selection.form;fill();}controls.groesse.value=selection.groesse;fill();for(const key of ['laenge','steigung','festigkeitsklasse'])if(selection[key]!=null)controls[key].value=String(selection[key]);choose('selection');return true;},
      summary(){return document?[N.reference(document,tr),...Object.entries(document.overrides).map(([key,x])=>tr('Kundenabweichung')+': '+key+' = '+x.value)].join('\n'):'';}
    };
  }
})();
