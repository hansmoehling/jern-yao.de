/* Deliberately small answer formatter: paragraphs, bold text and flat lists.
   Source HTML, Markdown links and images are always plain text. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.JYAnswerFormat=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function inline(text){
    const tokens=[];let at=0;
    for(const match of text.matchAll(/\*\*([^*\n]+)\*\*/g)){if(match.index>at)tokens.push({text:text.slice(at,match.index)});tokens.push({text:match[1],bold:true});at=match.index+match[0].length;}
    if(at<text.length)tokens.push({text:text.slice(at)});return tokens;
  }
  function parse(value){
    const blocks=[];let paragraph=null,list=null;
    for(const line of String(value??'').replace(/\r\n?/g,'\n').split('\n')){
      if(!line.trim()){paragraph=list=null;continue;}
      const item=line.match(/^\s{0,3}(?:([-+*])|([0-9]{1,6})[.)])\s+(.+)$/);
      if(item){paragraph=null;const type=item[2]?'ol':'ul';if(!list||list.type!==type){list={type,items:[]};blocks.push(list);}list.items.push({tokens:inline(item[3]),number:item[2]?Number(item[2]):null});continue;}
      list=null;
      const heading=line.match(/^\s{0,3}#{1,6}\s+(.+)$/),boldHeading=line.match(/^\s*\*\*([^*]+)\*\*\s*$/);
      if(heading||boldHeading){blocks.push({type:'p',lines:[[{text:(heading||boldHeading)[1],bold:true}]]});paragraph=null;continue;}
      if(!paragraph){paragraph={type:'p',lines:[]};blocks.push(paragraph);}paragraph.lines.push(inline(line));
    }
    return blocks;
  }
  const inlineHTML=tokens=>tokens.map(token=>token.bold?'<strong>'+escape(token.text)+'</strong>':escape(token.text)).join('');
  function html(text){return parse(text).map(block=>block.type==='p'?'<p>'+block.lines.map(inlineHTML).join('<br>')+'</p>':'<'+block.type+'>'+block.items.map(item=>'<li'+(item.number===null?'':' value="'+item.number+'"')+'>'+inlineHTML(item.tokens)+'</li>').join('')+'</'+block.type+'>').join('');}
  function appendTo(parent,text,doc){
    doc=doc||parent.ownerDocument;
    const appendInline=(target,tokens)=>tokens.forEach(token=>{if(token.bold){const strong=doc.createElement('strong');strong.textContent=token.text;target.appendChild(strong);}else target.appendChild(doc.createTextNode(token.text));});
    for(const block of parse(text)){
      const node=doc.createElement(block.type);
      if(block.type==='p')block.lines.forEach((line,index)=>{if(index)node.appendChild(doc.createElement('br'));appendInline(node,line);});
      else for(const item of block.items){const li=doc.createElement('li');if(item.number!==null)li.setAttribute('value',String(item.number));appendInline(li,item.tokens);node.appendChild(li);}
      parent.appendChild(node);
    }
    return parent;
  }
  return {parse,html,appendTo};
});
