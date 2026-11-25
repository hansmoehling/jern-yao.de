const test=require('node:test');
const assert=require('node:assert/strict');
const F=require('../answer-format.js');

test('AI paragraphs, bold and list numbering render without passing HTML or links through',()=>{
  const text='**Stadienkonzept**\n\n- **Vorstauchen** <img src=x onerror=alert(1)>\n- [Link](javascript:alert(1))\n\n3. Beschneiden\n4. Auswerfen\n\n<script>alert(1)</script> &lt;svg onload=alert(1)&gt;';
  const html=F.html(text);
  assert.match(html,/<p><strong>Stadienkonzept<\/strong><\/p>/);
  assert.match(html,/<ul><li><strong>Vorstauchen<\/strong> &lt;img/);
  assert.match(html,/<ol><li value="3">Beschneiden<\/li><li value="4">Auswerfen<\/li><\/ol>/);
  assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html,/&amp;lt;svg/,'entity input is not decoded into markup');
  assert(!/<(?:script|img|svg|a|iframe)\b/i.test(html));
  for(const tag of html.matchAll(/<([^>]+)>/g))assert(/^\/?(?:p|strong|ul|ol|li|br)(?: value="\d+")?$/.test(tag[1]),tag[0]);
  const doc={createElement:tag=>({tag,children:[],attributes:{},textContent:'',appendChild(child){this.children.push(child)},setAttribute(key,value){this.attributes[key]=value}}),createTextNode:text=>({text})};
  const parent=doc.createElement('div');F.appendTo(parent,text,doc);
  assert.equal(parent.children[0].children[0].tag,'strong');assert.equal(parent.children[0].children[0].textContent,'Stadienkonzept');
  assert.equal(parent.children[1].children[0].children[1].text,' <img src=x onerror=alert(1)>','DOM path uses text nodes for untrusted content');
  assert.equal(parent.children[2].children[0].attributes.value,'3');
});
