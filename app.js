'use strict';
const {pages,toc,units}=window.LECTURE,$=id=>document.getElementById(id);
const {hanja,precedents}=window.READING_AIDS;
const hanjaPattern=/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/gu;
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function readingAt(text, word, start) {
 const reading = hanja[word];
 if (!reading) return '';
 const before = text.slice(0, start).replace(/[\s(（,，·]+$/u, '');
 const after = text.slice(start + word.length).trimStart();
 if (word === '代位' && /대신하여\s*[(（]\s*$/u.test(text.slice(0, start))) return '';
 if (before.endsWith(reading) || after.startsWith('(' + reading + ')')) return '';
 return reading;
}
const withReadings = text => String(text).replace(hanjaPattern, (word, start, source) => {
 const reading = readingAt(source, word, start);
 return reading ? word + '(' + reading + ')' : word;
});
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem('civil4.'+k))??d}catch{return d}},save=(k,v)=>{try{localStorage.setItem('civil4.'+k,JSON.stringify(v))}catch{}};
const unitForPage=n=>units.find(u=>u.start<=n&&u.end>=n)||units[0];
let current=0,size=read('size',18),tab='contents',query='',restoring=false;
let bookmarks=read('bookmarkUnits',null);if(!bookmarks)bookmarks=[...new Set(read('bookmarks',[]).filter(n=>n>1).map(n=>unitForPage(n).id))];
document.documentElement.style.setProperty('--font',size+'px');if(read('dark',false))document.body.classList.add('dark');
function highlighted(s){if(!query)return escapeHTML(s);return s.split(new RegExp('('+query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi')).map((x,i)=>i%2?'<mark>'+escapeHTML(x)+'</mark>':escapeHTML(x)).join('')}
function marked(s, source=s, offset=0){
 let result='',start=0;
 for(const match of String(s).matchAll(hanjaPattern)){
  result+=highlighted(s.slice(start,match.index));const word=match[0];
  const reading=readingAt(source,word,offset+match.index);result+=reading?'<ruby class="hanja">'+highlighted(word)+'<rp>(</rp><rt>'+highlighted(reading)+'</rt><rp>)</rp></ruby>':highlighted(word);start=match.index+word.length;
 }
 return result+highlighted(s.slice(start));
}
function annotatedHTML(source){
 const template=document.createElement('template');template.innerHTML=source;
 const walker=document.createTreeWalker(template.content,NodeFilter.SHOW_TEXT),nodes=[];
 while(walker.nextNode())nodes.push(walker.currentNode);
 for(const node of nodes){if(!/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(node.textContent))continue;const replacement=document.createElement('template');const range=document.createRange();const cell=node.parentElement.closest('td,th')||node.parentElement;range.selectNodeContents(cell);range.setEndBefore(node);replacement.innerHTML=marked(node.textContent,cell.textContent,range.toString().length);node.replaceWith(replacement.content)}
 return template.innerHTML;
}
const summariesByPage=new Map();
for(const parts of Object.values(precedents))for(const part of parts)for(const page of part.pages){if(!summariesByPage.has(page))summariesByPage.set(page,[]);summariesByPage.get(page).push(part.citation+' '+part.summary)}
const searchRows=pages.map(p=>({...p,searchText:withReadings(p.text)+'\n'+(summariesByPage.get(p.n)||[]).join('\n')}));
function styledText(item){
 const chars=Array.from(item.text),mask=new Uint8Array(chars.length);
 const add=(a,b,bit=1)=>{for(let i=Math.max(0,a);i<Math.min(chars.length,b);i++)mask[i]|=bit};
 for(const [field,bit] of [['emphasis',1],['underline',2],['highlight',4],['strike',8]])for(const [a,b] of item[field]||[])add(a,b,bit);
 const prefix=item.text.match(/^(?:(?:v|❖|◆|✓)\s*(?=대법원|대판|대결|헌법재판소)|(?:\[사례\]|<사례>|【사례】|<해설>|\[해설\]|【해설】)\s*|F\s+)/);
 const cut=prefix?Array.from(prefix[0]).length:0,display=chars.slice(cut).join('');
 if(item.role==='precedent'){
  const header=display.match(/^(?:대법원|대판|대결|헌법재판소)[\s\S]{0,200}?(?:판결|결정)(?:\s*[:：])?/);
  if(header)add(cut,cut+Array.from(header[0]).length);
 }
 if(item.role==='statute'){
  const header=display.match(/^.{0,45}?제\d+조(?:의\d+)?\s*[【(][^】)]*[】)]/);
  if(header)add(cut,cut+Array.from(header[0]).length);
 }
 let result='',start=cut;
 while(start<chars.length){let end=start+1;while(end<chars.length&&mask[end]===mask[start])end++;let text=marked(chars.slice(start,end).join(''),item.text,chars.slice(0,start).join('').length);if(mask[start]&4)text='<mark class="source-highlight">'+text+'</mark>';if(mask[start]&2)text='<span class="source-underline">'+text+'</span>';if(mask[start]&8)text='<span class="source-strike">'+text+'</span>';if(mask[start]&1)text='<strong>'+text+'</strong>';result+=text;start=end}
 return result;
}

const sourceAttrs=item=>' id="'+escapeHTML(item.anchor)+'" data-source-start="'+item.pageStart+'" data-source-end="'+item.pageEnd+'"';
function renderPrecedents(items){
 const parts=precedents[items[0].group];
 return parts.map(part=>{
  const originals=items.slice(part.start,part.end),first=originals[0],last=originals.at(-1);
  return '<section class="callout callout-precedent case-card" aria-label="판례"><div class="callout-label"><span>판례 취지</span></div><div class="callout-body"><h4 class="case-citation">'+marked(part.citation)+'</h4><p class="case-summary" data-source-start="'+first.pageStart+'" data-source-end="'+last.pageEnd+'">'+marked(part.summary)+'</p><details class="case-original"><summary><span class="when-closed">원문보기</span><span class="when-open">원문접기</span><span class="disclosure-arrow" aria-hidden="true">⌄</span></summary><div class="case-quotation">'+originals.map(item=>'<p'+sourceAttrs(item)+'>'+styledText(item)+'</p>').join('')+'</div></details></div></section>';
 }).join('');
}
function renderContent(items){
 let result='',openGroup=null;
 const close=()=>{if(openGroup){result+='</div></section>';openGroup=null}};
 for(let i=0;i<items.length;i++){
  const item=items[i];
  const attrs=sourceAttrs(item);
  if(item.role==='precedent'&&item.group){
   close();const originals=[item];while(i+1<items.length&&items[i+1].role==='precedent'&&items[i+1].group===item.group)originals.push(items[++i]);
   result+=renderPrecedents(originals);continue;
  }
  if(item.role&&item.group){
   if(openGroup!==item.group){close();openGroup=item.group;const label={precedent:'판례',example:'사례',statute:'법조문',comment:'교재 설명'}[item.role]||'참고';result+='<section class="callout callout-'+item.role+'" aria-label="'+label+'"><div class="callout-label"><span>'+label+'</span></div><div class="callout-body">'}
   let tx=item.text;const explanation=/^(?:<해설>|\[해설\]|【해설】)/.test(tx);
   tx=tx.replace(/^(?:v|❖|◆|✓)\s*(?=대법원|대판|대결|헌법재판소)/,'').replace(/^(?:\[사례\]|<사례>|【사례】)\s*/,'').replace(/^(?:<해설>|\[해설\]|【해설】)\s*/,'');
   if(explanation)result+='<h4 class="explanation-label">해설</h4>';
   result+='<p'+attrs+'>'+styledText(item)+'</p>';continue;
  }
  close();
  if(item.type==='figure'){const src=item.src.replace('figures/','figures/reading/');result+='<figure'+attrs+' class="inline-figure"><figcaption>'+marked(item.caption)+'<a href="'+src+'" target="_blank" rel="noopener">도식 확대 ↗</a></figcaption><div class="figure-scroll" tabindex="0" aria-label="좌우로 스크롤하여 관계도 보기"><img src="'+src+'" alt="'+escapeHTML(withReadings(item.text))+'" loading="lazy"></div><small>좁은 화면에서는 도식을 좌우로 밀어 볼 수 있습니다.</small></figure>';continue}
  if(item.type==='table'){result+='<div'+attrs+' class="inline-table" tabindex="0" aria-label="좌우로 스크롤하여 비교표 보기">'+annotatedHTML(item.html)+'</div>';continue}
  let tag=item.headingLevel?'h'+item.headingLevel:(['h2','h3'].includes(item.type)?item.type:'p');result+='<'+tag+attrs+' class="'+(['comment','statute'].includes(item.type)?item.type:'')+'">'+styledText(item)+'</'+tag+'>';
 }
 close();return result;
}
function nav(){
 $('bmcount').textContent=bookmarks.length;$('contentsTab').classList.toggle('active',tab==='contents');$('bookmarksTab').classList.toggle('active',tab==='bookmarks');$('toc').hidden=!!query;$('results').hidden=!query;
 if(query){const hits=searchRows.filter(p=>p.n>1&&p.searchText.toLowerCase().includes(query.toLowerCase()));$('results').innerHTML='<p class="empty">'+hits.length+'개 원문 쪽에서 찾았습니다.</p>'+hits.map(p=>{let i=p.searchText.toLowerCase().indexOf(query.toLowerCase()),u=unitForPage(p.n);return '<button class="search-result" data-page="'+p.n+'"><small>원문 '+p.n+'쪽 · '+marked(u.chapter)+'</small><b>'+marked(u.title)+'</b><p>…'+highlighted(p.searchText.slice(Math.max(0,i-32),i+100))+'…</p></button>'}).join('');return}
 if(tab==='bookmarks'){$('toc').innerHTML=bookmarks.length?units.filter(u=>bookmarks.includes(u.id)).map(u=>unitLink(u)).join(''):'<p class="empty">기억하고 싶은 단원에서 ☆를 눌러 보세요.</p>';return}
 let lastChapter='';$('toc').innerHTML='<a class="navsection '+(current===0?'active':'')+'" href="#unit=0">강의자료 처음으로</a>'+units.map(u=>{let heading='';if(lastChapter!==u.chapter){lastChapter=u.chapter;heading='<div class="navchapter">'+escapeHTML(u.chapter)+'</div>'}return heading+unitLink(u)}).join('');
}
function unitLink(u){return '<a class="navsection '+(u.id===current?'active':'')+'" href="#unit='+u.id+'"><span class="nav-unit-title">'+marked(u.title)+'</span><span>'+u.start+'–'+u.end+'</span></a>'}
function render(){
 const u=units.find(u=>u.id===current),home=!u,index=units.indexOf(u);
 $('breadcrumb').textContent=home?'강의자료 / 단원별 읽기':'강의자료 / '+u.book;$('chapterLabel').innerHTML=marked(home?'제4편 채권각론':u.chapter);$('title').innerHTML=marked(home?'법정채권관계, 함께 읽기':u.title);
 $('pageLabel').textContent=home?'15개 단원 · 연속 읽기':'원문 '+u.start+'–'+u.end+'쪽';$('patch').hidden=home||!u.updated;
 $('bookmark').hidden=home;$('bookmark').textContent=bookmarks.includes(current)?'★':'☆';$('bookmark').setAttribute('aria-label',bookmarks.includes(current)?'이 단원 책갈피 제거':'이 단원 책갈피 추가');
 if(home){$('article').innerHTML='<div class="cover"><span class="eyebrow">제4편 채권각론 · 법정채권관계</span><div class="seal">法</div><h2>사무관리 · 부당이득<br>불법행위</h2><p>단원 하나를 끝까지, 끊김 없이.<br>원문 쪽수와 관계없이 이어 읽으세요.</p><p>판례 취지를 먼저 읽고 원문을 펼쳐 보세요.<br>본문의 한자 용어에는 독음을 함께 표시합니다.</p><button id="startReading">첫 단원 읽기 →</button></div><div class="unit-grid">'+units.map((u,i)=>'<a href="#unit='+u.id+'"><small>'+marked(u.chapter)+' · '+(i+1)+'/15</small><strong>'+marked(u.title)+'</strong><span>원문 '+u.start+'–'+u.end+'쪽 →</span></a>').join('')+'</div>';$('startReading').onclick=()=>go(units[0].id)}
 else $('article').innerHTML=renderContent(u.content);
 $('prev').disabled=home||index===0;$('next').disabled=!home&&index===units.length-1;$('prev').textContent='← 이전 단원';$('next').textContent='다음 단원 →';$('unitSelect').value=home?'0':String(u.id);
 nav();save('unit',current);document.title=(home?'단원별 읽기':u.title)+' · 민법4 강의노트';progress();
}
function progress(){const max=document.documentElement.scrollHeight-innerHeight,ratio=max>0?Math.min(1,scrollY/max):0;$('progress').style.width=(ratio*100)+'%';$('readingProgress').textContent=current?Math.round(ratio*100)+'% 읽는 중':'';if(current&&!restoring)save('position',{unit:current,y:scrollY})}
function go(id,source){const hash='unit='+id+(source?'&source='+source:'');if(location.hash==='#'+hash){fromHash();return}location.hash=hash}
function fromHash(){
 const params=new URLSearchParams(location.hash.slice(1));const oldPage=Number(params.get('p'));const remembered=read('position',null);let restore=false;
 if(params.has('unit'))current=Number(params.get('unit'));
 else if(oldPage)current=oldPage===1?0:unitForPage(oldPage).id;
 else {current=read('unit',null);if(current===null)current=read('page',1)>1?unitForPage(read('page',1)).id:0;restore=!!remembered&&remembered.unit===current}
 if(current&&!units.some(u=>u.id===current))current=0;
 restoring=true;render();document.body.classList.remove('open');$('menu').setAttribute('aria-expanded','false');
 const source=Number(params.get('source'))||oldPage;
 requestAnimationFrame(()=>{
  if(source){
   const candidates=[...$('article').querySelectorAll('[data-source-start]')].filter(e=>Number(e.dataset.sourceStart)<=source&&Number(e.dataset.sourceEnd)>=source);
   const q=query.toLowerCase();const target=(q?candidates.find(e=>e.textContent.toLowerCase().includes(q)):null)||candidates[0];
   if(target){const details=target.closest('details');if(details)details.open=true;target.scrollIntoView({block:'start'})}else window.scrollTo(0,0);
  }else window.scrollTo(0,restore?remembered.y:0);
  restoring=false;progress();
 });
}
$('unitSelect').innerHTML='<option value="0">단원 선택</option>'+units.map((u,i)=>'<option value="'+u.id+'">'+(i+1)+'. '+escapeHTML(withReadings(u.chapter+' · '+u.title))+'</option>').join('');
document.querySelector('.logo').textContent='民';
$('article').addEventListener('toggle',progress,true);
window.addEventListener('hashchange',fromHash);let scrollTimer;window.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(progress,100)},{passive:true});
$('prev').onclick=()=>{const i=units.findIndex(u=>u.id===current);if(i>0)go(units[i-1].id)};$('next').onclick=()=>{const i=units.findIndex(u=>u.id===current);if(i<units.length-1)go(units[i+1].id)};$('unitSelect').onchange=e=>go(Number(e.target.value));
function resize(delta){size=Math.min(26,Math.max(14,size+delta));document.documentElement.style.setProperty('--font',size+'px');save('size',size)}$('smaller').onclick=()=>resize(-1);$('larger').onclick=()=>resize(1);
$('theme').onclick=()=>{document.body.classList.toggle('dark');save('dark',document.body.classList.contains('dark'))};$('bookmark').onclick=()=>{bookmarks=bookmarks.includes(current)?bookmarks.filter(n=>n!==current):[...bookmarks,current];save('bookmarkUnits',bookmarks);$('bookmark').textContent=bookmarks.includes(current)?'★':'☆';$('bookmark').setAttribute('aria-label',bookmarks.includes(current)?'이 단원 책갈피 제거':'이 단원 책갈피 추가');nav()};
$('contentsTab').onclick=()=>{tab='contents';query='';$('search').value='';nav()};$('bookmarksTab').onclick=()=>{tab='bookmarks';query='';$('search').value='';nav()};
$('menu').onclick=()=>{document.body.classList.toggle('open');$('menu').setAttribute('aria-expanded',document.body.classList.contains('open'))};$('veil').onclick=()=>{document.body.classList.remove('open');$('menu').setAttribute('aria-expanded','false')};
let timer;$('search').addEventListener('input',e=>{clearTimeout(timer);timer=setTimeout(()=>{query=e.target.value.trim();nav()},160)});$('results').onclick=e=>{const b=e.target.closest('[data-page]');if(b){const page=Number(b.dataset.page);go(unitForPage(page).id,page)}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.body.classList.remove('open');$('menu').setAttribute('aria-expanded','false')}if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();if(innerWidth<=760)document.body.classList.add('open');$('search').focus()}});fromHash();
