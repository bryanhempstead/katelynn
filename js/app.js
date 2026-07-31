/* ============================================================
   Katelynn — app logic
   Local-first: everything persists in localStorage.
   AI (chat + schedule OCR) is STUBBED for now — see callKit() /
   parseScheduleImage(). Swap those two functions for real Claude
   calls when we wire the backend.
   ============================================================ */
'use strict';

/* ---------- tiny storage helpers ---------- */
const DB = {
  get(k, def){ try{ const v=localStorage.getItem('kate.'+k); return v?JSON.parse(v):def; }catch(_){ return def; } },
  set(k, v){ try{ localStorage.setItem('kate.'+k, JSON.stringify(v)); }catch(_){ } },
};
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const now = ()=>Date.now();
const uid = ()=>Math.random().toString(36).slice(2,9);
const pad2 = n=>String(n).padStart(2,'0');
// local calendar-day string 'YYYY-MM-DD' (local, so an evening rating files under today)
function todayStr(){ const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
// shift a 'YYYY-MM-DD' by n days (local-safe; handles month/year rollover)
function addDays(s,n){ const [y,m,d]=s.split('-').map(Number); const dt=new Date(y,m-1,d+n); return `${dt.getFullYear()}-${pad2(dt.getMonth()+1)}-${pad2(dt.getDate())}`; }
// current hour — a bare fn so tests can override window.currentHour() without shipping a debug seam
function currentHour(){ return new Date().getHours(); }

/* ---------- toast ---------- */
let toastT=null;
function toast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),1900);
}

/* ============================================================
   NAVIGATION  (bottom tab bar + slide-in screen stack)
   ============================================================ */
// which bottom tab lights up for a given screen
const SCREEN_TAB={home:'home',breathe:'calm',journal:'journal',life:'life',
                  music:'more',reading:'more',movies:'more',files:'more',insights:'home'};
function setActiveTab(id){
  const tab=SCREEN_TAB[id]||'';
  $$('.tab').forEach(t=>t.classList.toggle('on',t.dataset.tab===tab));
}
function go(id){
  const home=$('#home'), phone=$('.phone');
  if(id==='panic'){ enterPanic(); return; }   // "help now" → straight into a guided breath
  if(id!=='breathe'){ if(typeof stopBreath==='function') stopBreath(); phone.classList.remove('panic'); }
  phone.classList.toggle('on-breathe',id==='breathe');   // llama replaces orb on breathe
  if(id==='home'){
    $$('.screen').forEach(s=>{ if(s.id!=='home') s.classList.remove('active'); });
    phone.classList.remove('on-breathe'); phone.classList.remove('noorb');
    setActiveTab('home'); applyDaypart(); renderHome();
    return;
  }
  // sibling tab screens fully replace one another (no home-underneath state to track)
  $$('.screen').forEach(s=>{ if(s.id!==id && s.id!=='home') s.classList.remove('active'); });
  $('#'+id).classList.add('active');
  setActiveTab(id);
  // Kit orb only floats on the day-to-day tabs; hidden on focused/detail screens
  phone.classList.toggle('noorb', !['home','life','journal'].includes(id));
  if(id==='journal') resetLock();
  if(id==='life') initLife();
  if(id==='schedule') renderSchedule();
  if(id==='music') renderMusic();
  if(id==='breathe') initBreathe();
  if(id==='reading') initReading();
  if(id==='movies') initMovies();
  if(id==='files') initFiles();
  if(id==='insights') renderInsights();
}
$$('[data-back]').forEach(b=>b.addEventListener('click',()=>go('home')));

/* ---- bottom tab bar ---- */
$$('.tab').forEach(t=>t.addEventListener('click',()=>{
  const tab=t.dataset.tab;
  if(tab==='home') go('home');
  else if(tab==='calm') go('breathe');
  else if(tab==='journal') go('journal');
  else if(tab==='life') go('life');
  else if(tab==='more') openMore();
}));

/* ---- time-of-day scene + greeting ----
   Scene band tracks the real sky: dawn 5–8, day 8–17, dusk 17–21, night 21–5.
   Greeting band is separate so "good morning" can stretch across 5–12 even once
   the scene has brightened into full day. */
function daypart(){
  const h=new Date().getHours();
  let key;
  if(h>=21||h<5) key='night';
  else if(h<8)   key='dawn';
  else if(h<17)  key='day';
  else           key='dusk';
  let greet,ico,sub;
  if(h>=21||h<5){ greet='good night'; ico='☾'; sub='time to wind down softly'; }
  else if(h<12) { greet='good morning'; ico='☼'; sub=(h<8?'ease gently into the day':'how are you doing today?'); }
  else if(h<17) { greet='good afternoon'; ico='○'; sub='how are you doing today?'; }
  else          { greet='good evening'; ico='◐'; sub='how did today treat you?'; }
  return {key,greet,ico,sub};
}
function applyDaypart(){
  const d=daypart();
  const scene=$('#homeScene'); if(scene) scene.className='home-scene '+d.key;
  if($('#greetTime')) $('#greetTime').textContent=d.greet;
  if($('#greetIco'))  $('#greetIco').textContent=d.ico;
  if($('#greetSub'))  $('#greetSub').textContent=d.sub;
}

/* ============================================================
   QUOTES
   ============================================================ */
const QUOTES=[
  "you are exactly where you need to be.",
  "small steps still move you forward.",
  "be the main character today.",
  "you've survived 100% of your hard days.",
  "soft heart, strong spine.",
  "do it scared.",
  "your only competition is who you were yesterday.",
  "you're allowed to take up space.",
  "good things are coming — keep going.",
  "rest is productive too.",
];
function rollQuote(){
  const i=Math.floor(Math.random()*QUOTES.length);
  $('#quoteText').textContent=QUOTES[i];
}
$('#quoteNext').addEventListener('click',rollQuote);

/* ---------- secret easter egg: tap the Katelynn badge ---------- */
const EGG_URL='https://www.youtube.com/watch?v=uZfRaWAtBVg&list=RDuZfRaWAtBVg&start_radio=1';
$('.badge').addEventListener('click',()=>{
  const b=$('.badge'); b.classList.remove('egg'); void b.offsetWidth; b.classList.add('egg');
  setTimeout(()=>b.classList.remove('egg'),700);
  // Web: hands off to the YouTube app/site. In the native wrapper, swap for a
  // youtube:// deep link (Capacitor App.openUrl) to force the app open.
  window.open(EGG_URL,'_blank');
});

/* ============================================================
   TO-DO  (ported spin + strike mechanic from second-brain)
   ============================================================ */
const todoList=$('#todoList');
function loadTodos(){ return DB.get('todos', [
  {id:uid(),text:'clean bedroom',done:true,created:now(),completed:now()},
  {id:uid(),text:'order filament',done:false,created:now()},
  {id:uid(),text:'try making dal tadka',done:false,created:now()},
]); }
function saveTodos(){
  const arr=$$('.t-row',todoList).map(r=>({
    id:r.dataset.id,
    text:r.querySelector('.t-text').textContent.trim(),
    done:r.classList.contains('done'),
    created:Number(r.dataset.created)||now(),
    completed:r.dataset.completed?Number(r.dataset.completed):null,
  }));
  DB.set('todos',arr);
  updatePeeks();
}
function fmtTs(ms){ const d=new Date(Number(ms)); return d.toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
function todoSub(row){
  let s=row.dataset.created?'added '+fmtTs(row.dataset.created):'';
  if(row.classList.contains('done')&&row.dataset.completed) s+=(s?'  ·  ':'')+'done '+fmtTs(row.dataset.completed);
  return s;
}
function makeTodoRow(t){
  const row=document.createElement('div');
  row.className='t-row'+(t.done?' done striking':'');
  row.dataset.id=t.id||uid();
  row.dataset.created=t.created||now();
  if(t.done) row.dataset.completed=t.completed||now();
  row.innerHTML='<div class="t-star"></div><span class="t-text"></span><span class="t-sub"></span>';
  row.querySelector('.t-text').textContent=t.text;
  row.querySelector('.t-sub').textContent=todoSub(row);
  wireTodo(row);
  return row;
}
function wireTodo(row){
  row.addEventListener('click',e=>{
    if(e.target.closest('.t-sub')) return;
    const star=row.querySelector('.t-star');
    if(row.classList.contains('done')){
      row.classList.remove('done','striking'); row.removeAttribute('data-completed');
      row.querySelector('.t-sub').textContent=todoSub(row); saveTodos();
    }else{
      star.classList.add('popping');
      star.addEventListener('animationend',()=>{
        star.classList.remove('popping');
        row.classList.add('done'); row.dataset.completed=now();
        requestAnimationFrame(()=>requestAnimationFrame(()=>row.classList.add('striking')));
        row.querySelector('.t-sub').textContent=todoSub(row); saveTodos();
      },{once:true});
    }
  });
  // long-press / right-click → clear
  let lp=null;
  const clear=()=>{ row.remove(); saveTodos(); toast('cleared'); };
  row.addEventListener('contextmenu',e=>{e.preventDefault();clear();});
  const cancel=()=>{ if(lp){clearTimeout(lp);lp=null;} };
  row.addEventListener('pointerdown',()=>{ lp=setTimeout(()=>{lp=null;clear();},600); });
  ['pointerup','pointermove','pointerleave'].forEach(ev=>row.addEventListener(ev,cancel));
}
function renderTodos(){
  todoList.innerHTML='';
  loadTodos().forEach(t=>todoList.appendChild(makeTodoRow(t)));
}
function addTodo(text){
  if(!text.trim()) return;
  todoList.appendChild(makeTodoRow({id:uid(),text:text.trim(),done:false,created:now()}));
  saveTodos();
}
$('#todoAdd').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.value.trim()){ addTodo(e.target.value); e.target.value=''; }
});

/* ---- categories: tasks / groceries / household ---------------- */
const SUBCATS={
  groceries:['produce','dairy & eggs','meat & seafood','pantry & dry','frozen','bakery','snacks','drinks','other'],
  household:['paper goods','cleaning','laundry','bath','kitchen','other'],
};
const CL_DEFAULTS={
  groceries:[
    {id:uid(),text:'bananas',sub:'produce',done:false,created:now()},
    {id:uid(),text:'milk',sub:'dairy & eggs',done:false,created:now()},
    {id:uid(),text:'chicken',sub:'meat & seafood',done:false,created:now()},
  ],
  household:[
    {id:uid(),text:'toilet paper',sub:'paper goods',done:false,created:now()},
    {id:uid(),text:'dish soap',sub:'cleaning',done:false,created:now()},
  ],
};
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
function loadCL(cat){ return DB.get(cat, CL_DEFAULTS[cat]||[]); }
function saveCL(cat,arr){ DB.set(cat,arr); }
function clRowHTML(it){
  return `<div class="t-row${it.done?' done striking':''}" data-id="${it.id}">`+
         `<div class="t-star"></div><span class="t-text">${esc(it.text)}</span></div>`;
}
function renderCL(cat){
  const panel=$('#cat'+cap(cat));
  const list=panel.querySelector('.cl-list');
  const items=loadCL(cat);
  const bySub={}; items.forEach(it=>{ const s=it.sub||'other'; (bySub[s]=bySub[s]||[]).push(it); });
  let html='';
  SUBCATS[cat].forEach(sub=>{
    if(!bySub[sub]||!bySub[sub].length) return;
    html+=`<div class="cl-sub"><div class="cl-sub-head">${esc(sub)}</div>`+
          bySub[sub].map(clRowHTML).join('')+`</div>`;
  });
  list.innerHTML=html||'<div class="empty">nothing here yet ✦</div>';
  list.querySelectorAll('.t-row').forEach(r=>wireCLRow(r,cat));
}
function setCL(cat,id,patch){ const a=loadCL(cat); const it=a.find(x=>x.id===id); if(it){ Object.assign(it,patch); saveCL(cat,a); } }
function wireCLRow(row,cat){
  row.addEventListener('click',()=>{
    const star=row.querySelector('.t-star'), id=row.dataset.id;
    if(row.classList.contains('done')){
      row.classList.remove('done','striking'); setCL(cat,id,{done:false,completed:null});
    }else{
      star.classList.add('popping');
      star.addEventListener('animationend',()=>{
        star.classList.remove('popping');
        row.classList.add('done');
        requestAnimationFrame(()=>requestAnimationFrame(()=>row.classList.add('striking')));
        setCL(cat,id,{done:true,completed:now()});
      },{once:true});
    }
  });
  let lp=null;
  const clear=()=>{ saveCL(cat,loadCL(cat).filter(x=>x.id!==row.dataset.id)); renderCL(cat); toast('removed'); };
  row.addEventListener('contextmenu',e=>{e.preventDefault();clear();});
  const cancel=()=>{ if(lp){clearTimeout(lp);lp=null;} };
  row.addEventListener('pointerdown',()=>{ lp=setTimeout(()=>{lp=null;clear();},600); });
  ['pointerup','pointermove','pointerleave'].forEach(ev=>row.addEventListener(ev,cancel));
}
function addCL(cat,text,sub){
  if(!text.trim()) return;
  const a=loadCL(cat); a.push({id:uid(),text:text.trim(),sub:sub||'other',done:false,created:now()});
  saveCL(cat,a); renderCL(cat);
}
function switchCat(cat){
  $$('.tcat').forEach(t=>t.classList.toggle('on',t.dataset.cat===cat));
  $$('.todo-cat-panel').forEach(p=>p.classList.remove('on'));
  $('#cat'+cap(cat)).classList.add('on');
  if(cat==='groceries'||cat==='household') renderCL(cat);
}
$$('.tcat').forEach(b=>b.addEventListener('click',()=>switchCat(b.dataset.cat)));
// populate sub-category selects
$('#grocSub').innerHTML=SUBCATS.groceries.map(s=>`<option>${s}</option>`).join('');
$('#houseSub').innerHTML=SUBCATS.household.map(s=>`<option>${s}</option>`).join('');
$('#grocAdd').addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.value.trim()){ addCL('groceries',e.target.value,$('#grocSub').value); e.target.value=''; } });
$('#houseAdd').addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.value.trim()){ addCL('household',e.target.value,$('#houseSub').value); e.target.value=''; } });

/* ============================================================
   SCHEDULE
   ============================================================ */
const DEFAULT_JOBS=['Cafe','Boutique','Babysitting'];
function loadJobs(){ return DB.get('jobs', DEFAULT_JOBS.slice()); }
function saveJobs(j){ DB.set('jobs',j); }
function loadEvents(){ return DB.get('events', []); }
function saveEvents(e){ DB.set('events',e); updatePeeks(); }

const DOW=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtTime(t){ // "14:30" -> "2:30 pm"
  if(!t) return '';
  const [h,m]=t.split(':').map(Number);
  const ap=h>=12?'pm':'am'; const hh=((h+11)%12)+1;
  return hh+(m?(':'+String(m).padStart(2,'0')):':00')+' '+ap;
}
function renderSchedule(){
  const list=$('#schedList');
  const events=loadEvents().slice().sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
  if(!events.length){
    list.innerHTML='<div class="empty">no shifts yet —<br>upload a schedule photo or add one manually ✦</div>';
    return;
  }
  // group by date
  const groups={};
  events.forEach(e=>{ (groups[e.date]=groups[e.date]||[]).push(e); });
  list.innerHTML=Object.keys(groups).sort().map(date=>{
    const d=new Date(date+'T00:00:00');
    const head=`${DOW[d.getDay()]} <span class="dnum">${MON[d.getMonth()]} ${d.getDate()}</span>`;
    const rows=groups[date].map(e=>`
      <div class="ev ${e.type||'work'}">
        <button class="ev-del" data-del="${e.id}">×</button>
        <div class="ev-time">${fmtTime(e.start)}${e.end?'<br>'+fmtTime(e.end):''}</div>
        <div class="ev-body">
          <div class="ev-title">${esc(e.title||e.job||'Shift')}</div>
          ${e.place?`<div class="ev-meta">📍 ${esc(e.place)}</div>`:''}
          <span class="ev-tag">${esc(e.job||e.type||'work')}</span>
        </div>
      </div>`).join('');
    return `<div class="day-group"><div class="day-head">${head}</div>${rows}</div>`;
  }).join('');
  $$('[data-del]',list).forEach(b=>b.addEventListener('click',()=>{
    saveEvents(loadEvents().filter(e=>e.id!==b.dataset.del)); renderSchedule();
  }));
}
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ---- manual add sheet ---- */
function openAddEvent(prefill){
  prefill=prefill||{};
  const jobs=loadJobs();
  const today=new Date().toISOString().slice(0,10);
  openSheet(`
    <h3>add to schedule</h3>
    <div class="field"><label>what</label><input id="evTitle" placeholder="Morning shift" value="${esc(prefill.title||'')}"></div>
    <div class="field"><label>type</label>
      <select id="evType">
        <option value="work">Work</option>
        <option value="personal">Personal</option>
        <option value="appointment">Appointment</option>
      </select></div>
    <div class="field" id="jobField"><label>job</label>
      <select id="evJob">${jobs.map(j=>`<option>${esc(j)}</option>`).join('')}<option value="__add">+ add a job…</option></select></div>
    <div class="field"><label>where</label><input id="evPlace" placeholder="location / address" value="${esc(prefill.place||'')}"></div>
    <div class="field"><label>date</label><input id="evDate" type="date" value="${prefill.date||today}"></div>
    <div class="field-row">
      <div class="field"><label>start</label><input id="evStart" type="time" value="${prefill.start||'09:00'}"></div>
      <div class="field"><label>end</label><input id="evEnd" type="time" value="${prefill.end||'17:00'}"></div>
    </div>
    <button class="btn-save" id="evSave">save</button>
  `);
  const typeSel=$('#evType'), jobField=$('#jobField');
  const syncType=()=>{ jobField.style.display=typeSel.value==='work'?'block':'none'; };
  typeSel.addEventListener('change',syncType); syncType();
  $('#evJob').addEventListener('change',e=>{
    if(e.target.value==='__add'){
      const name=prompt('new job name:');
      if(name&&name.trim()){ const jobs=loadJobs(); jobs.push(name.trim()); saveJobs(jobs);
        e.target.innerHTML=jobs.map(j=>`<option>${esc(j)}</option>`).join('')+'<option value="__add">+ add a job…</option>';
        e.target.value=name.trim();
      }else e.target.selectedIndex=0;
    }
  });
  $('#evSave').addEventListener('click',()=>{
    const type=typeSel.value;
    const ev={id:uid(),title:$('#evTitle').value.trim(),type,
      job:type==='work'?$('#evJob').value:'',place:$('#evPlace').value.trim(),
      date:$('#evDate').value,start:$('#evStart').value,end:$('#evEnd').value};
    if(!ev.date){ toast('pick a date'); return; }
    const evs=loadEvents(); evs.push(ev); saveEvents(evs);
    closeSheet(); renderSchedule(); toast('added to schedule ✦');
  });
}
$('#schedAdd').addEventListener('click',()=>openAddEvent());

/* ---- photo upload → (stubbed) auto-populate ---- */
$('#schedUpload').addEventListener('click',()=>$('#schedFile').click());
$('#schedFile').addEventListener('change',e=>{
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{ openParseSheet(reader.result); };
  reader.readAsDataURL(file);
  e.target.value='';
});
function openParseSheet(dataUrl){
  openSheet(`
    <h3>reading your schedule</h3>
    <img src="${dataUrl}" style="width:100%;border-radius:14px;margin-bottom:12px">
    <div class="parse-status on"><span class="dots">finding your shifts</span></div>
    <div id="parseResult"></div>
  `);
  parseScheduleImage(dataUrl).then(events=>{
    $('.parse-status').classList.remove('on');
    const jobs=loadJobs();
    $('#parseResult').innerHTML=`
      <p style="font-family:var(--serif);font-style:italic;color:var(--purple)">found ${events.length} shifts — edit anything, then save:</p>
      ${events.map((ev,i)=>`
        <div class="ev work" style="cursor:default">
          <div class="ev-time">${fmtTime(ev.start)}<br>${fmtTime(ev.end)}</div>
          <div class="ev-body">
            <input value="${esc(ev.job)}" data-f="job" data-i="${i}" style="width:100%;border:none;background:rgba(255,255,255,.6);border-radius:8px;padding:6px 8px;font-family:var(--serif);margin-bottom:4px">
            <input value="${esc(ev.place||'')}" data-f="place" data-i="${i}" placeholder="where" style="width:100%;border:none;background:rgba(255,255,255,.6);border-radius:8px;padding:6px 8px;font-size:12px">
            <div class="ev-meta" style="margin-top:4px">${DOW[new Date(ev.date+'T00:00:00').getDay()]} · ${ev.date}</div>
          </div>
        </div>`).join('')}
      <button class="btn-save" id="parseSave">add all ${events.length} to schedule</button>
      ${DB.get('backendUrl','')?'':'<p style="font-size:10px;color:rgba(85,83,74,.6);text-align:center;margin-top:10px">⚠︎ these are sample shifts — connect AI (Settings → connect AI) to read real photos.</p>'}
    `;
    $('#parseResult').dataset.events=JSON.stringify(events);
    $$('#parseResult input').forEach(inp=>inp.addEventListener('input',()=>{
      const evs=JSON.parse($('#parseResult').dataset.events);
      evs[inp.dataset.i][inp.dataset.f]=inp.value;
      $('#parseResult').dataset.events=JSON.stringify(evs);
    }));
    $('#parseSave').addEventListener('click',()=>{
      const evs=JSON.parse($('#parseResult').dataset.events);
      const all=loadEvents();
      evs.forEach(ev=>all.push({...ev,id:uid(),type:'work',title:ev.job}));
      saveEvents(all); closeSheet(); renderSchedule(); toast('shifts added ✦');
    });
  });
}

/* Reads a schedule photo into shifts via the Claude-vision backend if one is
   configured (Settings → connect AI); otherwise returns sample shifts so the
   flow is demonstrable offline. */
function sampleShifts(){
  const jobs=loadJobs();
  const base=new Date(); const mk=off=>{ const d=new Date(base); d.setDate(d.getDate()+off); return d.toISOString().slice(0,10); };
  return [
    {date:mk(1),start:'08:00',end:'14:00',job:jobs[0]||'Work',place:'Main St'},
    {date:mk(3),start:'12:00',end:'18:00',job:jobs[1]||jobs[0]||'Work',place:''},
    {date:mk(5),start:'09:30',end:'15:30',job:jobs[0]||'Work',place:'Main St'},
  ];
}
function parseScheduleImage(dataUrl){
  const base=DB.get('backendUrl','');
  if(base){
    return fetch(base.replace(/\/$/,'')+'/api/parse-schedule',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ image:dataUrl, today:new Date().toISOString().slice(0,10), jobs:loadJobs() }),
    }).then(r=>r.json()).then(j=>(j.events&&j.events.length)?j.events:sampleShifts()).catch(()=>sampleShifts());
  }
  return new Promise(res=>setTimeout(()=>res(sampleShifts()),1200));
}

/* ============================================================
   JOURNAL  (3-digit lock, default 666)
   ============================================================ */
let codeBuffer='';
function getCode(){ return DB.get('journalCode','666'); }
function resetLock(){
  codeBuffer=''; renderDots();
  $('#journalBody').classList.remove('open');
  $('#lockPad').style.display='flex';
  $('#lockNote').textContent='enter your 3-digit code';
}
function renderDots(){
  $$('.lock-dot').forEach((d,i)=>d.classList.toggle('filled',i<codeBuffer.length));
}
$('#keypad').addEventListener('click',e=>{
  const k=e.target.closest('.key'); if(!k||k.classList.contains('blank')) return;
  if(k.dataset.act==='del'){ codeBuffer=codeBuffer.slice(0,-1); renderDots(); return; }
  if(codeBuffer.length>=3) return;
  codeBuffer+=k.textContent.trim(); renderDots();
  if(codeBuffer.length===3) setTimeout(checkCode,180);
});
function checkCode(){
  if(codeBuffer===getCode()){ unlockJournal(); }
  else{
    const pad=$('#lockPad'); pad.classList.add('shake');
    $('#lockNote').textContent='nope — try again';
    setTimeout(()=>{pad.classList.remove('shake');codeBuffer='';renderDots();},420);
  }
}
function unlockJournal(){
  $('#lockPad').style.display='none';
  $('#journalBody').classList.add('open');
  renderJournal();
}
$('#changeCode').addEventListener('click',()=>{
  const cur=prompt('current code:'); if(cur!==getCode()){ toast('wrong code'); return; }
  const next=prompt('new 3-digit code:');
  if(next&&/^\d{3}$/.test(next)){ DB.set('journalCode',next); toast('code changed ✦'); }
  else toast('needs to be 3 digits');
});
$('#jLock').addEventListener('click',resetLock);
function loadJournal(){ return DB.get('journal',[]); }
function renderJournal(){
  const list=$('#jList');
  const entries=loadJournal();
  list.innerHTML=entries.length?entries.slice().reverse().map(en=>{
    // if a mood was logged the same day, show its chip on the entry
    const md=(typeof moodForDate==='function')?moodForDate(new Date(en.ts).toISOString().slice(0,10)):null;
    const f=md&&FEELING(md.feeling);
    const chip=f?`<span class="mood-chip" style="background:${f.tone}"><span class="mc-gl">${f.glyph}</span>${f.label}</span>`:'';
    return `
    <div class="j-entry">
      <button class="ev-del" data-jdel="${en.id}">×</button>
      <div class="j-date">${new Date(en.ts).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})} ${chip}</div>
      <div class="j-text">${esc(en.text)}</div>
    </div>`;}).join('')
    :'<div class="empty">your entries will live here ✦</div>';
  $$('[data-jdel]',list).forEach(b=>b.addEventListener('click',()=>{
    DB.set('journal',loadJournal().filter(x=>x.id!==b.dataset.jdel)); renderJournal();
  }));
}
$('#jSave').addEventListener('click',()=>{
  const txt=$('#jNew').value.trim(); if(!txt){ toast('write something first'); return; }
  const j=loadJournal(); j.push({id:uid(),ts:now(),text:txt}); DB.set('journal',j);
  $('#jNew').value=''; renderJournal(); toast('saved ✦');
});

/* ============================================================
   HOME  ("your day" card + mood row + insight teaser)
   ============================================================ */
const DW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function renderHome(){   // (kept the name updatePeeks callers use via alias below)
  const today=new Date().toISOString().slice(0,10);
  const dc=$('#dcBody'); if(!dc) return;
  if($('#dcDate')) $('#dcDate').textContent=new Date().toLocaleDateString(undefined,{month:'short',day:'numeric'});

  // next shifts + open to-dos → one supportive sentence
  const upcoming=DB.get('events',[]).filter(e=>e.date>=today).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
  const open=DB.get('todos',[]).filter(t=>!t.done).length;
  const todayShifts=upcoming.filter(e=>e.date===today);
  let line;
  if(todayShifts.length){
    const s=todayShifts[0];
    line=`you've got ${todayShifts.length>1?todayShifts.length+' things':(esc(s.job||s.title||'a shift'))} today${s.start?', starting '+fmtTime(s.start):''}. `+(open?`and ${open} thing${open>1?'s':''} on your list — take it one at a time. ✦`:'nothing else on your list — pace yourself. ✦');
  }else if(upcoming.length){
    const n=upcoming[0]; const d=new Date(n.date+'T00:00:00');
    line=`nothing scheduled today — a soft one. next up: ${esc(n.job||n.title||'a shift')} ${DW[d.getDay()]}. `+(open?`${open} thing${open>1?'s':''} waiting whenever you're ready. ✦`:'enjoy the quiet. ✦');
  }else{
    line=open?`no shifts today — just ${open} thing${open>1?'s':''} on your list. small steps. ✦`:'a wide-open day. rest is productive too. ✦';
  }
  dc.innerHTML=line;

  // mood row reflects today's check-in (if any)
  const m=moodForDate(today);
  const mr=$('#moodRowBtn'), mrt=$('.mood-row .mr-txt');
  if(m){
    const f=FEELING(m.feeling);
    if(mrt) mrt.textContent=`feeling ${f?f.label:m.feeling} today`;
    if(mr){ mr.textContent='update'; }
  }else{
    if(mrt) mrt.textContent='how are you feeling today?';
    if(mr) mr.textContent='check in';
  }

  // insight teaser — prefer the evening streak if there is one, else mood weather
  const ins=moodSummary();
  const {current}=computeStreaks();
  if($('#irTxt')){
    if(current>0) $('#irTxt').textContent=`✦ ${current}-evening streak · see your patterns`;
    else if(ins.total) $('#irTxt').textContent=`${ins.word} · see your patterns`;
    else $('#irTxt').textContent='check in a few days to see patterns';
  }
  if($('#irDot')) $('#irDot').style.background = ins.tone || 'var(--teal)';

  // gentle evening "how was today?" banner (only after 6pm, once per day)
  refreshEvePrompt();
}
// keep existing callers (saveTodos / saveEvents) working
function updatePeeks(){ renderHome(); }

/* ============================================================
   CHATBOT  (orb → chat sheet). AI is STUBBED via callKit().
   ============================================================ */
const orb=$('#orb'), chat=$('#chat'), chatLog=$('#chatLog');
let chatGreeted=false;
function openChat(){
  chat.classList.add('open'); orb.classList.add('awake'); $('.phone').classList.add('chatting');
  if(!chatGreeted){ botSay("hi Katelynn ✦ i'm Kit. i can add tasks, peek at your schedule, or start a journal entry. what do you need?"); chatGreeted=true; }
}
function closeChat(){ chat.classList.remove('open'); orb.classList.remove('awake'); $('.phone').classList.remove('chatting'); }
orb.addEventListener('click',openChat);
$('#chatClose').addEventListener('click',closeChat);
$('#chatSettings').addEventListener('click',openSettings);
function bubble(text,cls){
  const d=document.createElement('div'); d.className='msg '+cls; d.textContent=text;
  chatLog.appendChild(d); chatLog.scrollTop=chatLog.scrollHeight; return d;
}
function botSay(text){ bubble(text,'bot'); }
function sendChat(text){
  text=(text||$('#chatInput').value).trim(); if(!text) return;
  bubble(text,'me'); $('#chatInput').value='';
  const typing=bubble('thinking…','bot typing');
  callKit(text).then(reply=>{ typing.remove(); botSay(reply); });
}
$('#chatSend').addEventListener('click',()=>sendChat());
$('#chatInput').addEventListener('keydown',e=>{ if(e.key==='Enter') sendChat(); });
$$('#chatChips .chip').forEach(c=>c.addEventListener('click',()=>sendChat(c.textContent)));

/* Kit's brain. Adds tasks locally (instant), then asks the real Claude backend
   if one is configured (Settings → AI backend), otherwise falls back to a local
   canned reply so the orb is still useful offline. */
function kitStub(t){
  if(t.includes('today')||t.includes('schedule')||t.includes('work')){
    const events=DB.get('events',[]); const today=new Date().toISOString().slice(0,10);
    const tod=events.filter(e=>e.date===today);
    return tod.length?`today: ${tod.map(e=>`${e.job||e.title} at ${fmtTime(e.start)}`).join(', ')}`:"nothing on your schedule for today — enjoy it ✦";
  }
  if(t.includes('journal')) return "open the journal tile and i'll have a fresh page ready. (your code's still 666 unless you changed it ✦)";
  return "i can really chat once an AI backend is connected (Settings → connect AI). for now try: \"add a task: water the plants\" ✦";
}
function callKit(text){
  const t=text.toLowerCase();
  // instant local action: add a task — works with or without a backend
  const taskMatch=t.match(/(?:add|remind me to|i need to|i have to)\s+(.+)/);
  if(taskMatch&&(t.includes('task')||t.includes('add')||t.includes('remind')||t.includes('to do'))){
    const task=taskMatch[1]
      .replace(/^(a |an )?task\b[:\s]*/i,'').replace(/^to\s+/i,'')
      .replace(/\s+to (my )?(to.?do|list).*$/i,'').trim();
    if(task){ addTodo(task); return Promise.resolve(`added “${task}” to your to-do list ✦`); }
  }
  const base=DB.get('backendUrl','');
  if(base){
    return fetch(base.replace(/\/$/,'')+'/api/chat',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({messages:[{role:'user',content:text}]}),
    }).then(r=>r.json()).then(j=>j.reply||kitStub(t)).catch(()=>kitStub(t));
  }
  return new Promise(res=>setTimeout(()=>res(kitStub(t)),500));
}

/* ============================================================
   HOME wiring — SOS pill, more button, mood + insight rows
   ============================================================ */
if($('#sosPill')) $('#sosPill').addEventListener('click',()=>go('panic'));
if($('#homeMore')) $('#homeMore').addEventListener('click',openMore);
if($('#dcCta')) $('#dcCta').addEventListener('click',()=>go('life'));
if($('#moodRow')) $('#moodRow').addEventListener('click',openMoodSheet);
if($('#insightRow')) $('#insightRow').addEventListener('click',()=>go('insights'));
if($('#insBreathe')) $('#insBreathe').addEventListener('click',()=>go('breathe'));
if($('#homeSounds')) $('#homeSounds').addEventListener('click',openSoundsSheet);

/* ============================================================
   MOOD CHECK-IN   (kate.moods — NEW)
   ============================================================ */
const FEELINGS=[
  {id:'calm',    label:'calm',    glyph:'❁', tone:'#7fb3a8', score:2},
  {id:'happy',   label:'happy',   glyph:'☀', tone:'#c8a24b', score:2},
  {id:'tired',   label:'tired',   glyph:'☾', tone:'#a9a493', score:1},
  {id:'anxious', label:'anxious', glyph:'❈', tone:'#6f8b7e', score:0},
  {id:'sad',     label:'sad',     glyph:'☂', tone:'#8792a0', score:0},
  {id:'angry',   label:'angry',   glyph:'✦', tone:'#b07a5e', score:0},
];
function FEELING(id){ return FEELINGS.find(f=>f.id===id); }
function loadMoods(){ return DB.get('moods',[]); }
function saveMoods(a){ DB.set('moods',a); }
function moodForDate(date){ const a=loadMoods().filter(m=>m.date===date); return a.length?a[a.length-1]:null; }
function logMood(feeling,note){
  const a=loadMoods();
  a.push({id:uid(),date:new Date().toISOString().slice(0,10),feeling,note:(note||'').trim(),ts:now()});
  saveMoods(a);
}
let moodPick=null;
function openMoodSheet(){
  moodPick=null;
  const today=moodForDate(new Date().toISOString().slice(0,10));
  openSheet(`
    <h3>how are you feeling?</h3>
    <div class="set-sub">one tap — no wrong answers ✦</div>
    <div class="mood-grid" id="moodGrid">
      ${FEELINGS.map(f=>`<button class="mood-opt${today&&today.feeling===f.id?' on':''}" data-f="${f.id}" style="background:${f.tone}"><span class="mo-gl">${f.glyph}</span>${f.label}</button>`).join('')}
    </div>
    <input class="mood-note" id="moodNote" placeholder="anything on your mind? (optional)" value="${today?esc(today.note||''):''}">
    <button class="btn-save" id="moodSave">save how i feel</button>
    <div class="day-rate-block">
      <div class="dr-h">and how was today, overall?</div>
      <div class="eve-faces sheet-faces" id="sheetFaces">${faceRow(dayForDate(todayStr())?dayForDate(todayStr()).rating:0)}</div>
    </div>
  `);
  if(today){ moodPick=today.feeling; }
  $$('.mood-opt').forEach(b=>b.addEventListener('click',()=>{
    moodPick=b.dataset.f; $$('.mood-opt').forEach(x=>x.classList.toggle('on',x===b));
  }));
  $('#sheetFaces').addEventListener('click',e=>{
    const b=e.target.closest('.dayface'); if(!b) return;
    rateDay(b.dataset.rate);
    $$('#sheetFaces .dayface').forEach(x=>x.classList.toggle('on',x===b));
    const f=dayFace(Number(b.dataset.rate));
    toast(`today: ${f.label} ✦`);
    renderHome();
  });
  $('#moodSave').addEventListener('click',()=>{
    if(!moodPick){ toast('pick a feeling first ✦'); return; }
    logMood(moodPick,$('#moodNote').value);
    closeSheet(); renderHome();
    const f=FEELING(moodPick);
    toast(`noted — feeling ${f?f.label:moodPick} ✦`);
  });
}
/* ---- summary + analysis over the last 30 days ---- */
function moodSummary(){
  const cutoff=Date.now()-30*864e5;
  const a=loadMoods().filter(m=>m.ts>=cutoff);
  if(!a.length) return {total:0};
  const counts={}; a.forEach(m=>{ counts[m.feeling]=(counts[m.feeling]||0)+1; });
  const avg=a.reduce((s,m)=>{ const f=FEELING(m.feeling); return s+(f?f.score:1); },0)/a.length;
  const pct=Math.round(avg/2*100);
  const domId=Object.keys(counts).sort((x,y)=>counts[y]-counts[x])[0];
  const dom=FEELING(domId);
  let word;
  if(pct>=66) word='mostly bright';
  else if(pct>=40) word='steady, middling';
  else word='a tender stretch';
  return {total:a.length,counts,pct,dom,word,tone:dom?dom.tone:'#7fc4bd'};
}

/* ============================================================
   DAY RATING  ("how was today?" — kate.days, one per day, latest wins)
   Five monoline faces, tinted clay → sage-teal.
   ============================================================ */
const DAY_FACES=[
  {r:1,label:'rough',tone:'#c08b6f',mouth:'M13 27 Q20 20.5 27 27',brow:true},
  {r:2,label:'low',  tone:'#c2a389',mouth:'M13 26 Q20 22.5 27 26'},
  {r:3,label:'okay', tone:'#b3ad97',mouth:'M13.5 24.5 H26.5'},
  {r:4,label:'good', tone:'#9bbaa6',mouth:'M13 24 Q20 28 27 24'},
  {r:5,label:'great',tone:'#7fc4bd',mouth:'M13 23.5 Q20 30 27 23.5'},
];
function dayFace(r){ return DAY_FACES[r-1]; }
function ratingTone(r){ const f=dayFace(r); return f?f.tone:'#b3ad97'; }
// one monoline face SVG (outline uses currentColor; fills tint when .on via CSS)
function faceSVG(r){
  const f=dayFace(r); if(!f) return '';
  return `<svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <circle cx="20" cy="20" r="15" class="df-bg" stroke="currentColor" stroke-width="2"/>
    <circle cx="15" cy="18" r="1.5" class="df-eye" fill="currentColor"/>
    <circle cx="25" cy="18" r="1.5" class="df-eye" fill="currentColor"/>
    <path d="${f.mouth}" class="df-mouth" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}
// a row of the five faces; `sel` = currently-selected rating (or 0)
function faceRow(sel){
  return DAY_FACES.map(f=>
    `<button class="dayface${sel===f.r?' on':''}" data-rate="${f.r}" style="--tone:${f.tone}">
       ${faceSVG(f.r)}<span class="df-lbl">${f.label}</span>
     </button>`).join('');
}
function loadDays(){ return DB.get('days',[]); }
function saveDays(a){ DB.set('days',a); }
function daysMap(){ const m={}; loadDays().forEach(d=>{ m[d.date]=d; }); return m; }   // later entries overwrite → latest wins
function dayForDate(date){ return daysMap()[date]||null; }
function rateDay(rating,date){
  date=date||todayStr();
  const a=loadDays().filter(d=>d.date!==date);   // one per day
  a.push({date,rating:Number(rating),ts:now()});
  saveDays(a);
}
const RATE_WORD={1:'a rough one',2:'a low day',3:'an okay day',4:'a good day',5:'a great day'};

/* ---- evening prompt banner (home) ---- */
function refreshEvePrompt(){
  const banner=$('#eveBanner'); if(!banner) return;
  const wrap=$('#eveFaces'); if(wrap && !wrap.dataset.built){ wrap.innerHTML=faceRow(0); wrap.dataset.built='1'; }
  const today=todayStr();
  const show = currentHour()>=18 && !dayForDate(today) && DB.get('dayPromptSeen','')!==today;
  banner.classList.toggle('show',show);
  if(!show) banner.classList.remove('thanked');
}
function dismissEvePrompt(){
  DB.set('dayPromptSeen',todayStr());
  $('#eveBanner').classList.remove('show');
}
if($('#eveX')) $('#eveX').addEventListener('click',dismissEvePrompt);
if($('#eveFaces')) $('#eveFaces').addEventListener('click',e=>{
  const b=e.target.closest('.dayface'); if(!b) return;
  rateDay(b.dataset.rate);
  DB.set('dayPromptSeen',todayStr());
  $$('#eveFaces .dayface').forEach(x=>x.classList.toggle('on',x===b));
  const banner=$('#eveBanner'); banner.classList.add('thanked');
  setTimeout(()=>{ banner.classList.remove('show'); setTimeout(()=>banner.classList.remove('thanked'),400); }, 1400);
});

/* ---- evening reminder (best-effort local notification) ----
   A pure web app can't push when fully closed, so this only fires while the app
   has been opened that day: we schedule a setTimeout for 8pm and re-arm whenever
   the app becomes visible again. Honest sub-label lives in Settings. */
let eveTimer=null;
function armEveReminder(){
  if(eveTimer){ clearTimeout(eveTimer); eveTimer=null; }
  if(!DB.get('eveReminder',false)) return;
  if(!('Notification' in window) || Notification.permission!=='granted') return;
  const n=new Date(), target=new Date(); target.setHours(20,0,0,0);
  if(target<=n) return;                       // 8pm already passed today — the home banner covers it
  eveTimer=setTimeout(()=>{
    if(DB.get('eveReminder',false) && !dayForDate(todayStr())){
      try{ new Notification('Katelynn ✦',{body:'how was your day? ✦',tag:'kate-eve'}); }catch(_){}
    }
  }, target-n);
}

/* ---- streak math ---- */
function computeStreaks(){
  const m=daysMap(); const dates=Object.keys(m).sort();
  if(!dates.length) return {current:0,best:0};
  let best=1,run=1;
  for(let i=1;i<dates.length;i++){ run=(addDays(dates[i-1],1)===dates[i])?run+1:1; if(run>best)best=run; }
  // current: count back from today, or from yesterday if today's not rated yet (grace — no guilt mid-day)
  const today=todayStr();
  let cursor = m[today] ? today : (m[addDays(today,-1)] ? addDays(today,-1) : null);
  let cur=0; while(cursor && m[cursor]){ cur++; cursor=addDays(cursor,-1); }
  return {current:cur,best};
}
function renderStreakCard(){
  const box=$('#insStreak'); if(!box) return;
  const {current,best}=computeStreaks();
  const total=loadDays().length;
  if(!total){
    box.innerHTML='<div class="strk-empty">rate an evening or two and your streak will bloom here ✦</div>';
    return;
  }
  let kind;
  if(current>=3) kind=`✦ ${current} evenings in a row — lovely rhythm.`;
  else if(current>0) kind=`✦ ${current} evening${current>1?'s':''} in a row — a gentle start.`;
  else kind='no streak today — pick it back up whenever you like, no pressure. ✦';
  box.innerHTML=`
    <div class="strk-row">
      <div class="strk"><div class="strk-n">${current}</div><div class="strk-l">current streak</div></div>
      <div class="strk"><div class="strk-n">${best}</div><div class="strk-l">best streak</div></div>
    </div>
    <div class="strk-kind">${kind}</div>`;
}

/* ---- month calendar ---- */
let calCur=null;   // {y,m} being viewed; null → current month
function calRef(){ if(!calCur){ const d=new Date(); calCur={y:d.getFullYear(),m:d.getMonth()}; } return calCur; }
function renderCalendar(){
  const box=$('#insCal'); if(!box) return;
  const {y,m}=calRef();
  const first=new Date(y,m,1), start=first.getDay(), days=new Date(y,m+1,0).getDate();
  const map=daysMap(), today=todayStr();
  const title=`${['January','February','March','April','May','June','July','August','September','October','November','December'][m]} ${y}`;
  let cells='';
  for(let i=0;i<start;i++) cells+='<div class="cal-cell blank"></div>';
  for(let d=1;d<=days;d++){
    const ds=`${y}-${pad2(m+1)}-${pad2(d)}`;
    const rec=map[ds];
    const cls=['cal-cell'];
    if(rec) cls.push('has');
    if(ds===today) cls.push('today');
    const style=rec?`style="--tone:${ratingTone(rec.rating)}"`:'';
    cells+=`<button class="${cls.join(' ')}" ${style} data-date="${ds}">${d}</button>`;
  }
  box.innerHTML=`
    <div class="cal-head">
      <button class="cal-nav" data-cal="-1" aria-label="previous month">‹</button>
      <div class="cal-title">${title}</div>
      <button class="cal-nav" data-cal="1" aria-label="next month">›</button>
    </div>
    <div class="cal-dows">${['S','M','T','W','T','F','S'].map(x=>`<span>${x}</span>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
    <div class="cal-pop" id="calPop"></div>`;
  $$('#insCal .cal-nav').forEach(b=>b.addEventListener('click',()=>{
    const r=calRef(); let mm=r.m+Number(b.dataset.cal), yy=r.y;
    if(mm<0){ mm=11; yy--; } if(mm>11){ mm=0; yy++; }
    calCur={y:yy,m:mm}; renderCalendar();
  }));
  $$('#insCal .cal-cell.has').forEach(c=>c.addEventListener('click',()=>showCalPop(c)));
}
function showCalPop(cell){
  const pop=$('#calPop'); if(!pop) return;
  const date=cell.dataset.date, rec=daysMap()[date];
  if(!rec){ pop.classList.remove('show'); return; }
  if(pop.dataset.for===date && pop.classList.contains('show')){ pop.classList.remove('show'); return; }
  const feels=loadMoods().filter(x=>x.date===date);
  const f=dayFace(rec.rating);
  const chips=feels.map(x=>{ const g=FEELING(x.feeling); return g?`<span class="cp-feel" style="background:${g.tone}">${g.glyph} ${g.label}</span>`:''; }).join('');
  const note=(feels.find(x=>x.note)||{}).note||'';
  const dnum=new Date(date+'T00:00:00');
  pop.innerHTML=`
    <div class="cp-top">
      <span class="cp-face" style="color:${f.tone}">${faceSVG(rec.rating)}</span>
      <div><div class="cp-day">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dnum.getDay()]} ${MON[dnum.getMonth()]} ${dnum.getDate()}</div><div class="cp-rate">${RATE_WORD[rec.rating]}</div></div>
    </div>
    ${chips?`<div class="cp-feels">${chips}</div>`:''}
    ${note?`<div class="cp-note">“${esc(note.slice(0,90))}${note.length>90?'…':''}”</div>`:''}`;
  // position above the tapped cell, clamped inside the calendar
  const box=$('#insCal').getBoundingClientRect(), cr=cell.getBoundingClientRect();
  pop.classList.add('show'); pop.dataset.for=date;
  const w=pop.offsetWidth;
  let left=cr.left-box.left+cr.width/2-w/2;
  left=Math.max(4,Math.min(left, box.width-w-4));
  pop.style.left=left+'px';
  pop.style.top=(cr.top-box.top-pop.offsetHeight-8)+'px';
}

/* ---- 30-day trend sparkline (olive line, soft teal fill) ---- */
function renderTrend(){
  const box=$('#insTrend'); if(!box) return;
  const map=daysMap(), today=todayStr();
  const span=30, W=300, H=84, pad=8;
  const pts=[];
  for(let i=0;i<span;i++){
    const ds=addDays(today,-(span-1-i));
    if(map[ds]) pts.push({x:i,r:map[ds].rating});
  }
  if(pts.length<2){
    box.innerHTML=`<div class="trend-h">last 30 days</div><div class="trend-empty">a soft line will trace here once you've rated a few evenings ✦</div>`;
    return;
  }
  const px=i=>pad+(i/(span-1))*(W-2*pad);
  const py=r=>pad+(1-(r-1)/4)*(H-2*pad);
  const line=pts.map(p=>`${px(p.x).toFixed(1)},${py(p.r).toFixed(1)}`).join(' ');
  const area=`${px(pts[0].x).toFixed(1)},${(H-pad).toFixed(1)} ${line} ${px(pts[pts.length-1].x).toFixed(1)},${(H-pad).toFixed(1)}`;
  const dots=pts.map(p=>`<circle cx="${px(p.x).toFixed(1)}" cy="${py(p.r).toFixed(1)}" r="2.4" fill="var(--olive)"/>`).join('');
  box.innerHTML=`
    <div class="trend-h">last 30 days · ${pts.length} rated</div>
    <svg class="trend-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <polygon points="${area}" fill="rgba(var(--teal-rgb),.22)"/>
      <polyline points="${line}" fill="none" stroke="var(--olive)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
    </svg>`;
}

/* ---- gentle patterns (local logic only) ---- */
const DOW_SOFT=['Sundays','Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays'];
function renderDayAnalysis(){
  const box=$('#insDayAnalysis'); if(!box) return;
  const days=loadDays();
  if(days.length<2){
    box.innerHTML = days.length
      ? `<div class="ia-note">one evening logged so far — check in a few more and gentle patterns will show up here. ✦</div>`
      : '';
    return;
  }
  const lines=[];
  // 1) softest weekday (needs >=2 samples on that day)
  const byDow={}; days.forEach(d=>{ const wd=new Date(d.date+'T00:00:00').getDay(); (byDow[wd]=byDow[wd]||[]).push(d.rating); });
  let softest=null;
  Object.keys(byDow).forEach(wd=>{ const arr=byDow[wd]; if(arr.length>=2){ const avg=arr.reduce((s,x)=>s+x,0)/arr.length; if(!softest||avg<softest.avg) softest={wd:Number(wd),avg}; } });
  if(softest) lines.push(`${DOW_SOFT[softest.wd]} tend to be your softest day — worth planning something kind for them. ✦`);
  // 2) best day this month
  const {y,m}=(()=>{ const d=new Date(); return {y:d.getFullYear(),m:d.getMonth()}; })();
  const thisMonth=days.filter(d=>{ const [yy,mm]=d.date.split('-').map(Number); return yy===y && mm===m+1; });
  if(thisMonth.length){
    const top=thisMonth.slice().sort((a,b)=>b.rating-a.rating || b.ts-a.ts)[0];
    if(top.rating>=4){ const dt=new Date(top.date+'T00:00:00'); lines.push(`your brightest day this month was ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()]} the ${dt.getDate()} — ${RATE_WORD[top.rating]}.`); }
  }
  // 3) feeling ↔ rating co-occurrence
  const moods=loadMoods(), overall=days.reduce((s,d)=>s+d.rating,0)/days.length;
  const feelRate={};
  moods.forEach(mo=>{ const d=daysMap()[mo.date]; if(d){ (feelRate[mo.feeling]=feelRate[mo.feeling]||[]).push(d.rating); } });
  let dip=null,lift=null;
  Object.keys(feelRate).forEach(fid=>{ const arr=feelRate[fid]; if(arr.length>=2){ const avg=arr.reduce((s,x)=>s+x,0)/arr.length;
    if(avg<=overall-0.5 && (!dip||avg<dip.avg)) dip={fid,avg};
    if(avg>=overall+0.5 && (!lift||avg>lift.avg)) lift={fid,avg};
  }});
  if(dip){ const g=FEELING(dip.fid); if(g) lines.push(`on days you logged “${g.label}”, your ratings dipped a little — be extra gentle with yourself then.`); }
  else if(lift){ const g=FEELING(lift.fid); if(g) lines.push(`days you felt “${g.label}” tended to rate higher — more of whatever brings that on. ✦`); }
  if(!lines.length){ box.innerHTML=''; return; }
  box.innerHTML=`<div class="ia-h">your evenings · patterns</div>${lines.slice(0,3).map(l=>`<div class="ia-line"><span class="ia-dot" style="background:var(--teal)"></span><span>${l}</span></div>`).join('')}`;
}
function renderDayInsights(){ renderStreakCard(); renderCalendar(); renderTrend(); renderDayAnalysis(); }

/* ============================================================
   INSIGHTS  (bubble chart of moods + supportive analysis)
   ============================================================ */
function renderInsights(){
  renderDayInsights();
  renderMoodInsights();
}
function renderMoodInsights(){
  const s=moodSummary();
  const wrap=$('#bubbleWrap'), an=$('#insAnalysis'), lbl=$('#insMoodLabel');
  const hasDays=loadDays().length>0;
  if(lbl) lbl.style.display=s.total?'':'none';
  if(!s.total){
    if(hasDays){
      // day ratings exist but no feeling check-ins → let the hero speak to the days
      const {current}=computeStreaks();
      $('#insPct').textContent='✦';
      $('#insWord').textContent = current>0 ? 'your evenings are adding up' : 'your evenings are catalogued below';
      wrap.innerHTML=''; an.innerHTML=''; return;
    }
    $('#insPct').textContent='✦';
    $('#insWord').textContent='your patterns will grow here';
    wrap.innerHTML='<div class="ins-empty">rate your evenings and check in on a feeling — i\'ll show you the shape of your weeks here, no judgement. ✦</div>';
    an.innerHTML=''; return;
  }
  $('#insPct').textContent=s.pct+'%';
  $('#insWord').textContent='your mental weather is '+s.word;
  // bubbles sized by frequency
  const max=Math.max(...Object.values(s.counts));
  const bubbles=FEELINGS.filter(f=>s.counts[f.id]).sort((a,b)=>s.counts[b.id]-s.counts[a.id]);
  wrap.innerHTML=bubbles.map((f,i)=>{
    const n=s.counts[f.id];
    const size=Math.round(58+(n/max)*66);   // 58..124px — clusters into rows
    const fs=Math.max(12,Math.round(size*0.17));
    return `<div class="bubble" style="width:${size}px;height:${size}px;background:${f.tone};animation-delay:${(i*0.6).toFixed(1)}s">
      <span class="bb-lbl" style="font-size:${fs}px">${f.label}</span>
      <span class="bb-n" style="font-size:${Math.max(10,fs-3)}px">${n}×</span></div>`;
  }).join('');
  // analysis lines
  const lines=bubbles.slice(0,3).map(f=>{
    const n=s.counts[f.id], share=Math.round(n/s.total*100);
    return `<div class="ia-line"><span class="ia-dot" style="background:${f.tone}"></span><span><b>${f.label}</b> showed up ${n} time${n>1?'s':''} — about ${share}% of your check-ins.</span></div>`;
  }).join('');
  let note;
  if(s.pct>=66) note="you've had more light than heavy lately. whatever you're doing, keep making room for it. ✦";
  else if(s.pct>=40) note="a real mix — that's what most weeks look like. be as kind to yourself on the hard days as the easy ones. ✦";
  else note="it's been a heavier stretch. that's allowed. one slow breath at a time, and reach out if you need to. ✦";
  an.innerHTML=`<div class="ia-h">emotional distribution · last 30 days</div>${lines}<div class="ia-note">${note}</div>`;
}

/* ============================================================
   LIFE  (segmented control: schedule ⇄ to-do)
   ============================================================ */
let lifeWired=false, lifeCur='schedule';
function lifeTab(which){
  lifeCur=which;
  $$('.seg-btn').forEach(b=>b.classList.toggle('on',b.dataset.life===which));
  $('#lifeSchedule').classList.toggle('on',which==='schedule');
  $('#lifeTodo').classList.toggle('on',which==='todo');
  if(which==='schedule') renderSchedule();
}
function initLife(){
  if(!lifeWired){
    $$('.seg-btn').forEach(b=>b.addEventListener('click',()=>lifeTab(b.dataset.life)));
    lifeWired=true;
  }
  lifeTab(lifeCur);
}

/* ============================================================
   MORE sheet  (files · reading · music · settings)
   ============================================================ */
function openMore(){
  openSheet(`
    <h3>more</h3>
    <div class="more-grid">
      <button class="more-tile" data-more="files"><span class="mt-ico">⌗</span><span class="mt-name">important files</span><span class="mt-sub">scan &amp; keep documents</span></button>
      <button class="more-tile" data-more="reading"><span class="mt-ico">▤</span><span class="mt-name">reading</span><span class="mt-sub">your book shelves</span></button>
      <button class="more-tile" data-more="movies"><span class="mt-ico">▸</span><span class="mt-name">movies</span><span class="mt-sub">your watchlist</span></button>
      <button class="more-tile" data-more="music"><span class="mt-ico">♪</span><span class="mt-name">music</span><span class="mt-sub">play something soft</span></button>
      <button class="more-tile wide" data-more="settings"><span class="mt-ico">⚙</span><span class="mt-name">settings</span><span class="mt-sub">backup, code &amp; more</span></button>
    </div>
  `);
  $$('.more-tile').forEach(b=>b.addEventListener('click',()=>{
    const d=b.dataset.more; closeSheet();
    if(d==='settings') setTimeout(openSettings,260); else go(d);
  }));
}

/* ============================================================
   AMBIENT SOUNDS  (Web Audio filtered noise — no audio files)
   ============================================================ */
let audioCtx=null, ambNode=null, ambCur=null, ambLfo=null;
let ambExtra=[];   // extra audio nodes (rumble sources, LFOs) to stop on teardown
let ambTimers=[];  // scheduled timers (thunder claps) to clear on teardown
function noiseBuffer(ctx){
  const len=ctx.sampleRate*2, buf=ctx.createBuffer(1,len,ctx.sampleRate), d=buf.getChannelData(0);
  let last=0;
  for(let i=0;i<len;i++){ const w=Math.random()*2-1; last=(last+0.02*w)/1.02; d[i]=(last*3.2 + w*0.4); }  // pink-ish
  return buf;
}
// reflect the currently-playing sound onto every chip (breathe bar + home sheet) + the home button
function refreshAmbChips(){
  $$('.amb-chip').forEach(c=>c.classList.toggle('on', !!ambCur && c.dataset.amb===ambCur));
  const hs=$('#homeSounds'); if(hs) hs.classList.toggle('on', !!ambCur);
}
function stopAmbient(){
  if(ambNode){ try{ ambNode.stop(); }catch(_){}; ambNode=null; }
  ambExtra.forEach(n=>{ try{ n.stop(); }catch(_){} }); ambExtra=[];
  ambTimers.forEach(t=>clearTimeout(t)); ambTimers=[];
  if(ambLfo){ try{ ambLfo.stop(); }catch(_){}; ambLfo=null; }
  ambCur=null;
  refreshAmbChips();
}
// a soft, distant thunder clap — low-frequency noise burst with a slow decay (cozy, not startling)
function thunderClap(ctx){
  try{
    const src=ctx.createBufferSource(); src.buffer=noiseBuffer(ctx); src.loop=true;
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=260+Math.random()*160; lp.Q.value=0.7;
    const g=ctx.createGain(); g.gain.value=0.0001;
    src.connect(lp); lp.connect(g); g.connect(ctx.destination);
    const t=ctx.currentTime, peak=0.09+Math.random()*0.05;
    g.gain.linearRampToValueAtTime(peak, t+0.25);              // slow rumble-in
    g.gain.exponentialRampToValueAtTime(0.0001, t+2.2+Math.random()*1.4);  // long gentle roll-off
    src.start(); src.stop(t+4);
  }catch(_){}
}
function scheduleThunder(ctx){
  const wait=(10+Math.random()*20)*1000;   // every ~10–30s
  const id=setTimeout(()=>{
    if(ambCur!=='thunder') return;
    thunderClap(ctx);
    scheduleThunder(ctx);
  },wait);
  ambTimers.push(id);
}
function startAmbient(kind){
  try{
    if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
    if(ambNode){ try{ ambNode.stop(); }catch(_){}; ambNode=null; }
    const ctx=audioCtx;
    const src=ctx.createBufferSource(); src.buffer=noiseBuffer(ctx); src.loop=true;
    const filt=ctx.createBiquadFilter();
    const gain=ctx.createGain(); gain.gain.value=0.0001;
    src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    let target=0.16; const tnow=ctx.currentTime;
    if(kind==='rain'){ filt.type='bandpass'; filt.frequency.value=2400; filt.Q.value=0.6; }
    else if(kind==='waves'){ filt.type='lowpass'; filt.frequency.value=520;
      // slow swell via an LFO on gain
      const lfo=ctx.createOscillator(); lfo.frequency.value=0.11;
      const lg=ctx.createGain(); lg.gain.value=0.09; lfo.connect(lg); lg.connect(gain.gain); lfo.start();
      ambLfo=lfo;
    }
    else if(kind==='wind'){ filt.type='lowpass'; filt.frequency.value=420; filt.Q.value=0.4;
      const lfo=ctx.createOscillator(); lfo.frequency.value=0.06;
      const lg=ctx.createGain(); lg.gain.value=180; lfo.connect(lg); lg.connect(filt.frequency); lfo.start();
      ambLfo=lfo;
    }
    else if(kind==='thunder'){ filt.type='bandpass'; filt.frequency.value=2200; filt.Q.value=0.6; target=0.13;   // rain base
      // low rumble bed: brown-ish noise, lowpassed, slowly swelling
      const rSrc=ctx.createBufferSource(); rSrc.buffer=noiseBuffer(ctx); rSrc.loop=true;
      const rLp=ctx.createBiquadFilter(); rLp.type='lowpass'; rLp.frequency.value=130; rLp.Q.value=0.5;
      const rG=ctx.createGain(); rG.gain.value=0.06;
      const rLfo=ctx.createOscillator(); rLfo.frequency.value=0.05;
      const rLg=ctx.createGain(); rLg.gain.value=0.05; rLfo.connect(rLg); rLg.connect(rG.gain);
      rSrc.connect(rLp); rLp.connect(rG); rG.connect(ctx.destination);
      rSrc.start(); rLfo.start();
      ambExtra.push(rSrc,rLfo);
      scheduleThunder(ctx);   // occasional distant claps
    }
    else if(kind==='white'){ filt.type='lowpass'; filt.frequency.value=6200; filt.Q.value=0.3; target=0.13; }  // plain, flat, steady
    else { filt.type='lowpass'; filt.frequency.value=760; }   // hush
    gain.gain.linearRampToValueAtTime(target, tnow+1.2);
    src.start();
    src._gain=gain;
    ambNode=src; ambCur=kind;
  }catch(_){ toast('audio not available'); }
}
function toggleAmbient(kind){
  if(ambCur===kind){ stopAmbient(); return; }
  stopAmbient();
  startAmbient(kind);
  refreshAmbChips();
}
// delegate so dynamically-built chips (the home sounds sheet) work too, and stay in sync
document.addEventListener('click',e=>{ const c=e.target.closest('.amb-chip'); if(c) toggleAmbient(c.dataset.amb); });

// home → quick background-sounds sheet (all six chips, shares the one engine)
function openSoundsSheet(){
  openSheet(`
    <h3>background sounds</h3>
    <div class="set-sub">tap one to play — it keeps going as you move around the app ✦</div>
    <div class="ambient-bar sheet-amb">
      <button class="amb-chip" data-amb="rain">rain</button>
      <button class="amb-chip" data-amb="waves">waves</button>
      <button class="amb-chip" data-amb="wind">wind</button>
      <button class="amb-chip" data-amb="thunder">thunderstorm</button>
      <button class="amb-chip" data-amb="white">white noise</button>
      <button class="amb-chip" data-amb="hush">hush</button>
    </div>
  `);
  refreshAmbChips();   // light up whatever's already playing
}

// restore-from-backup file picker
$('#restoreFile').addEventListener('change',e=>{ const f=e.target.files[0]; if(f) importBackup(f); e.target.value=''; });

/* ============================================================
   SETTINGS  (opened from the chat)
   ============================================================ */
function openSettings(){
  closeChat();
  const calm=DB.get('calm',false);
  openSheet(`
    <h3>settings</h3>
    <div class="set-sub">feel</div>
    <div class="set-list">
      <button class="set-btn set-toggle" id="setCalm"><span class="s-ico">☾</span> calm mode <span class="s-val">${calm?'on':'off'}</span></button>
      <button class="set-btn" id="setMood"><span class="s-ico">❁</span> check in on a mood <span class="s-val">how you feel</span></button>
      <button class="set-btn set-toggle set-stack" id="setEve"><span class="s-ico">◐</span> <span class="s-stack">evening reminder<small>a nudge at 8pm — works when the app has been opened that day</small></span> <span class="s-val">${DB.get('eveReminder',false)?'on':'off'}</span></button>
    </div>
    <div class="set-sub">assistant</div>
    <div class="set-list">
      <button class="set-btn set-toggle" id="setAI"><span class="s-ico">✦</span> connect AI (Kit + photo reading) <span class="s-val">${DB.get('backendUrl','')?'on':'off'}</span></button>
    </div>
    <div class="set-sub">sync &amp; backup</div>
    <div class="set-list">
      <button class="set-btn set-toggle" id="setGoogle"><span class="s-ico">⬡</span> ${DB.get('googleConnected',false)?'Google connected':'connect Google'} <span class="s-val">${DB.get('googleConnected',false)?'on':'calendar + drive'}</span></button>
      <button class="set-btn" id="setSync"><span class="s-ico">▤</span> sync Google Calendar now</button>
      <button class="set-btn" id="setBackup"><span class="s-ico">⤓</span> back up to my phone <span class="s-val">.json</span></button>
      <button class="set-btn" id="setRestore"><span class="s-ico">⤒</span> restore from a backup</button>
    </div>
    <div class="set-sub">privacy</div>
    <div class="set-list">
      <button class="set-btn" id="setCode"><span class="s-ico"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span> change journal code</button>
      <button class="set-btn" id="setWipe"><span class="s-ico">✕</span> clear everything</button>
    </div>
    <div class="set-sub" id="setVer"></div>
    <div class="set-sub">made with love for Katelynn ✦ · Google sync + Drive backup go live when the app is wrapped (they need Google sign-in set up)</div>
  `);
  if($('#setVer')) $('#setVer').textContent='Katelynn · '+APP_VERSION;
  $('#setMood').addEventListener('click',()=>{ closeSheet(); setTimeout(openMoodSheet,260); });
  $('#setAI').addEventListener('click',()=>{
    const cur=DB.get('backendUrl','');
    const v=prompt('AI backend URL (where the Katelynn server runs):\ne.g. https://abc.trycloudflare.com\n\nLeave blank to disconnect.', cur);
    if(v===null) return;
    DB.set('backendUrl',v.trim());
    $('#setAI .s-val').textContent=v.trim()?'on':'off';
    checkTts().then(updateVoiceCur);   // see if premium voices are available
    toast(v.trim()?'AI connected ✦':'AI disconnected');
  });
  $('#setGoogle').addEventListener('click',connectGoogle);
  $('#setSync').addEventListener('click',syncGoogleCalendar);
  $('#setBackup').addEventListener('click',exportBackup);
  $('#setRestore').addEventListener('click',()=>$('#restoreFile').click());
  $('#setCalm').addEventListener('click',()=>{ const v=!DB.get('calm',false); DB.set('calm',v); applyCalm(); $('#setCalm .s-val').textContent=v?'on':'off'; });
  $('#setEve').addEventListener('click',()=>{
    const turningOn=!DB.get('eveReminder',false);
    const finish=on=>{ DB.set('eveReminder',on); const v=$('#setEve .s-val'); if(v) v.textContent=on?'on':'off'; armEveReminder(); };
    if(turningOn && 'Notification' in window && Notification.permission==='default'){
      Notification.requestPermission().then(p=>{
        if(p==='granted'){ finish(true); toast('evening reminder on ✦'); }
        else{ finish(false); toast('allow notifications to get the nudge'); }
      });
      return;
    }
    if(turningOn && 'Notification' in window && Notification.permission==='denied'){
      finish(false); toast('notifications are blocked in your browser settings'); return;
    }
    finish(turningOn); toast(turningOn?'evening reminder on ✦':'reminder off');
  });
  $('#setCode').addEventListener('click',()=>{
    const cur=prompt('current code:'); if(cur!==getCode()){ toast('wrong code'); return; }
    const next=prompt('new 3-digit code:');
    if(next&&/^\d{3}$/.test(next)){ DB.set('journalCode',next); toast('code changed ✦'); } else toast('needs 3 digits');
  });
  $('#setWipe').addEventListener('click',()=>{
    if(confirm('Clear ALL of Katelynn\'s data on this device? This cannot be undone.')){
      Object.keys(localStorage).filter(k=>k.startsWith('kate.')).forEach(k=>localStorage.removeItem(k));
      location.reload();
    }
  });
}
function applyCalm(){ $('.phone').classList.toggle('calm', DB.get('calm',false)); }

/* ---- local backup (works now) ----
   Gathers every kate.* key into one JSON file she can save to her phone,
   and restores from one. This is the "on her phone" half of the backup. */
function gatherData(){
  const o={}; Object.keys(localStorage).filter(k=>k.startsWith('kate.')).forEach(k=>{ o[k]=localStorage.getItem(k); });
  return o;
}
function exportBackup(){
  const data={ app:'katelynn', exported:new Date().toISOString(), data:gatherData() };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='katelynn-backup-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('backup saved to your phone ✦');
  // If Google is connected, this is also where we'd upload the same blob to Drive.
  if(DB.get('googleConnected',false)) toast('…and queued for Google Drive');
}
function importBackup(file){
  const r=new FileReader();
  r.onload=()=>{
    try{
      const parsed=JSON.parse(r.result);
      const data=parsed.data||parsed;
      if(!data || typeof data!=='object') throw new Error('bad file');
      Object.keys(data).forEach(k=>{ if(k.startsWith('kate.')) localStorage.setItem(k,data[k]); });
      toast('backup restored ✦'); setTimeout(()=>location.reload(),600);
    }catch(_){ toast('that doesn’t look like a backup'); }
  };
  r.readAsText(file);
}

/* ---- Google (Calendar + Drive) — STUB ----
   Real OAuth needs a Google client ID + verified consent screen, set up when the
   app is wrapped (Capacitor). Then connectGoogle() runs the sign-in, syncGoogleCalendar()
   pulls events into the schedule, and exportBackup() also uploads to Drive. */
function connectGoogle(){
  const on=!DB.get('googleConnected',false);
  DB.set('googleConnected',on);
  const b=$('#setGoogle');
  if(b){ b.querySelector('.s-val').textContent=on?'on':'calendar + drive';
         b.childNodes[1].textContent=on?' Google connected ':' connect Google '; }
  toast(on?'Google linked ✦ (full sign-in arrives with the app)':'Google disconnected');
}
function syncGoogleCalendar(){
  if(!DB.get('googleConnected',false)){ toast('connect Google first'); return; }
  // STUB: when wired, fetch upcoming events from the Calendar API and merge into kate.events.
  toast('calendar sync arrives with the app ✦');
}

/* ============================================================
   LLAMAS — clean single-line outlines (IKEA-instruction style)
   ============================================================ */
const LL_STROKE='stroke="#55534a" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"';
// fluffy alpaca face, front-on, friendly
const LLAMA_FACE_SVG=
`<svg viewBox="0 0 64 64" preserveAspectRatio="xMidYMid meet" ${LL_STROKE}>
  <path d="M27 24C22 15 23 9 26 9c3 0 3 9 2 15"/>
  <path d="M37 24c5-9 4-15 1-15-3 0-3 9-2 15"/>
  <path d="M23 31c0-9 18-9 18 0v8c0 11-18 11-18 0z"/>
  <circle cx="29" cy="34" r="1.7" fill="#55534a" stroke="none"/>
  <circle cx="35" cy="34" r="1.7" fill="#55534a" stroke="none"/>
  <path d="M29.5 43c1.4 1.8 4.6 1.8 6 0"/>
</svg>`;
// side alpaca, FACING RIGHT (its travel direction); legs vary per walk frame
function walkSVG(legs){
  return `<svg viewBox="0 0 96 70" preserveAspectRatio="xMidYMid meet" ${LL_STROKE}>
    <path d="M14 38c-4-1-5 5-1 7"/>
    <path d="M16 40C16 28 30 25 42 25 56 25 66 30 66 38 66 46 54 50 42 50 28 50 16 49 16 40Z"/>
    <path d="M61 32C65 22 67 16 71 13"/>
    <path d="M55 34C59 26 62 20 66 14"/>
    <path d="M66 14C62 9 70 6 76 8 81 10 82 15 78 18 75 20 70 19 66 16"/>
    <path d="M71 9C69 4 71 2 73 4 74 5 74 8 73 10"/>
    <circle cx="72" cy="12.5" r="1.3" fill="#55534a" stroke="none"/>
    ${legs}
  </svg>`;
}
const LEGS_A='<path d="M27 49l-1 15"/><path d="M37 50v15"/><path d="M50 50l1 15"/><path d="M60 48l2 15"/>';
const LEGS_B='<path d="M27 49l-3 15"/><path d="M37 50l2 15"/><path d="M50 50l-2 15"/><path d="M60 48l3 15"/>';
function renderLlamas(){
  if($('#biLlama')) $('#biLlama').innerHTML=LLAMA_FACE_SVG;
  if($('#llamaF1')) $('#llamaF1').innerHTML=walkSVG(LEGS_A);
  if($('#llamaF2')) $('#llamaF2').innerHTML=walkSVG(LEGS_B);
}

/* ============================================================
   BREATHE  (breathing patterns + grounding + soothe kit)
   ============================================================ */
const BREATH_PATTERNS={
  box:{meta:'box breathing · in 4 · hold 4 · out 4 · hold 4',phases:[['breathe in',4],['hold',4],['breathe out',4],['hold',4]],rec:128},
  478:{meta:'4·7·8 · in 4 · hold 7 · out 8 — deeply calming',phases:[['breathe in',4],['hold',7],['breathe out',8]],rec:114},
  simple:{meta:'simple · in 4 · out 6 — easy and steady',phases:[['breathe in',4],['breathe out',6]],rec:96},
};
let breathRunning=false, breathTimer=null, breathCountTimer=null, curPattern='box';
function fmtClock(s){ s=Math.max(0,Math.round(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }

/* ---- soothing spoken cues + a picker of nice voices (accents/genders/vibes) ---- */
let breathVoice=null, speechPrimed=false;
const ACCENTS={'en-us':'American','en-gb':'British','en-au':'Australian','en-in':'Indian','en-ie':'Irish','en-za':'South African','en-ca':'Canadian','en-nz':'New Zealand','en-sg':'Singaporean','en-ph':'Filipino','en-gb-scotland':'Scottish'};
const VOICE_HINTS={ // first name -> [gender, vibe]
  rishi:['male','warm'],veena:['female','warm'],isha:['female','warm'],samantha:['female','friendly'],
  alex:['male','natural'],daniel:['male','calm'],arthur:['male','steady'],oliver:['male','crisp'],
  kate:['female','clear'],serena:['female','soft'],stephanie:['female','gentle'],martha:['female','warm'],
  karen:['female','bright'],lee:['male','easygoing'],catherine:['female','elegant'],gordon:['male','deep'],
  moira:['female','gentle'],tessa:['female','smooth'],aaron:['male','easy'],nicky:['female','friendly'],
  victoria:['female','classic'],fiona:['female','soft'],ava:['female','warm'],evan:['male','easy'],
  joelle:['female','soft'],nathan:['male','calm'],zoe:['female','bright'],matilda:['female','bright'],
  jamie:['male','mellow'],william:['male','steady']
};
function langKey(l){ return (l||'').toLowerCase().replace('_','-'); }
function accentOf(l){ l=langKey(l); return ACCENTS[l] || (l.startsWith('en')?'English':l); }
function voiceMeta(v){ const key=v.name.toLowerCase().replace(/\s*\(.*\)$/,'').split(' ')[0]; const h=VOICE_HINTS[key]||[]; return {gender:h[0]||'',vibe:h[1]||'',accent:accentOf(v.lang)}; }
function curatedVoices(){
  if(!('speechSynthesis' in window)) return [];
  let vs=speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang));
  const NOVELTY=/bad news|good news|bells|bubbles|cellos|jester|organ|trinoids|whisper|wobble|zarvox|albert|bahh|boing|deranged|hysterical|pipe|superstar|junior|grandma|grandpa|rocko|shelley|sandy|flo|eddy|reed|bruce|kathy|princess|ralph|fred|agnes/i;
  vs=vs.filter(v=>!NOVELTY.test(v.name));
  const score=v=>{ let s=0; const k=v.name.toLowerCase().split(' ')[0]; if(VOICE_HINTS[k])s+=3; if(/enhanced|premium|siri/i.test(v.name))s+=2; if(v.localService)s+=1; return s; };
  vs.sort((a,b)=>score(b)-score(a));
  const byAccent=new Map(), rest=[];
  for(const v of vs){ const a=accentOf(v.lang); if(!byAccent.has(a)) byAccent.set(a,v); else rest.push(v); }
  let out=[...byAccent.values(), ...rest];
  const seen=new Set(); out=out.filter(v=>{ if(seen.has(v.name))return false; seen.add(v.name); return true; });
  return out.slice(0,10);
}
function pickBreathVoice(){
  if(!('speechSynthesis' in window)) return null;
  const vs=speechSynthesis.getVoices(); if(!vs.length) return null;
  const saved=DB.get('voiceName','');
  if(saved){ const m=vs.find(v=>v.name===saved); if(m) return m; }
  const ind=vs.filter(v=>/en[-_]?IN/i.test(v.lang));     // default: calm Indian male if present
  return ind.find(v=>/rishi/i.test(v.name)) || ind[0]
      || vs.find(v=>/en[-_]?US/i.test(v.lang)) || vs.find(v=>/^en/i.test(v.lang)) || vs[0] || null;
}
function loadBreathVoice(){ breathVoice=pickBreathVoice(); updateVoiceCur(); }
// (the initial loadBreathVoice() call lives after all the voice declarations to avoid a TDZ on OFFLINE_VOICES)
function primeSpeech(){ if(speechPrimed||!('speechSynthesis' in window)) return; try{ const u=new SpeechSynthesisUtterance(' '); u.volume=0; speechSynthesis.speak(u); speechPrimed=true; }catch(_){} }

/* ---- PREMIUM voices: natural cloud TTS via the backend (ElevenLabs / OpenAI) ---- */
const PREMIUM_CATALOG={
  elevenlabs:[
    {id:'21m00Tcm4TlvDq8ikWAM',name:'Rachel',accent:'American',gender:'female',vibe:'calm'},
    {id:'pMsXgVXv3BLzUgSXRplE',name:'Serena',accent:'American',gender:'female',vibe:'soft'},
    {id:'oWAxZDx7w5VEj9dCyTzz',name:'Grace',accent:'American',gender:'female',vibe:'soothing'},
    {id:'pNInz6obpgDQGcFmaJgB',name:'Adam',accent:'American',gender:'male',vibe:'deep'},
    {id:'onwK4e9ZLuTAKqWW03F9',name:'Daniel',accent:'British',gender:'male',vibe:'calm'},
    {id:'pFZP5JQG7iQjIQuC4Bku',name:'Lily',accent:'British',gender:'female',vibe:'warm'},
    {id:'IKne3meq5aSn9XLyUdCD',name:'Charlie',accent:'Australian',gender:'male',vibe:'easy'},
    {id:'D38z5RcWu1voky8WS1ja',name:'Fin',accent:'Irish',gender:'male',vibe:'warm'},
  ],
  openai:[
    {id:'nova',name:'Nova',accent:'American',gender:'female',vibe:'warm'},
    {id:'shimmer',name:'Shimmer',accent:'American',gender:'female',vibe:'soft'},
    {id:'alloy',name:'Alloy',accent:'American',gender:'neutral',vibe:'calm'},
    {id:'echo',name:'Echo',accent:'American',gender:'male',vibe:'easy'},
    {id:'onyx',name:'Onyx',accent:'American',gender:'male',vibe:'deep'},
    {id:'fable',name:'Fable',accent:'British',gender:'male',vibe:'storyteller'},
  ],
};
let ttsProvider=null;
function premiumVoices(){ return PREMIUM_CATALOG[ttsProvider]||[]; }
function checkTts(){
  const base=DB.get('backendUrl','');
  if(!base){ ttsProvider=null; return Promise.resolve(); }
  return fetch(base.replace(/\/$/,'')+'/api/health').then(r=>r.json()).then(j=>{ ttsProvider=(j&&j.tts)||null; }).catch(()=>{ ttsProvider=null; });
}
const ttsCache=new Map();
function ttsAudio(text,voiceId){
  const base=DB.get('backendUrl',''); if(!base) return Promise.resolve(null);
  const key=voiceId+'|'+text; if(ttsCache.has(key)) return Promise.resolve(ttsCache.get(key));
  return fetch(base.replace(/\/$/,'')+'/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,voice:voiceId})})
    .then(r=>r.ok?r.blob():null).then(b=>{ if(!b) return null; const url=URL.createObjectURL(b); ttsCache.set(key,url); return url; }).catch(()=>null);
}
let ttsEl=null, ttsReady=false, _silentUrl=null;
function makeSilentUrl(){ const sr=8000,n=Math.floor(sr*0.06),buf=new ArrayBuffer(44+n),dv=new DataView(buf);
  const wr=(o,s)=>{for(let i=0;i<s.length;i++)dv.setUint8(o+i,s.charCodeAt(i));};
  wr(0,'RIFF');dv.setUint32(4,36+n,true);wr(8,'WAVE');wr(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);
  dv.setUint32(24,sr,true);dv.setUint32(28,sr,true);dv.setUint16(32,1,true);dv.setUint16(34,8,true);wr(36,'data');dv.setUint32(40,n,true);
  for(let i=0;i<n;i++)dv.setUint8(44+i,128); return URL.createObjectURL(new Blob([buf],{type:'audio/wav'})); }
function unlockTts(){ if(ttsReady||!('Audio' in window)) return; try{ ttsEl=new Audio(); _silentUrl=_silentUrl||makeSilentUrl(); ttsEl.src=_silentUrl; const p=ttsEl.play(); if(p&&p.then)p.then(()=>{ttsReady=true;}).catch(()=>{}); else ttsReady=true; }catch(_){} }
function playTts(url){ try{ if(!ttsEl) ttsEl=new Audio(); ttsEl.src=url; ttsEl.currentTime=0; ttsEl.play().catch(()=>{}); }catch(_){} }
function stopTts(){ try{ if(ttsEl) ttsEl.pause(); }catch(_){} }
function playPremium(text,voiceId){ ttsAudio(text,voiceId).then(url=>{ if(url) playTts(url); else webSpeak(text); }); }
function prewarmPremium(){ const pv=DB.get('premiumVoice',''); if(!pv||!DB.get('backendUrl',''))return; ['breathe in','breathe out','hold'].forEach(t=>ttsAudio(t,pv)); }

function webSpeak(text){
  if(!('speechSynthesis' in window)) return;
  try{
    if(speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    if(!breathVoice) breathVoice=pickBreathVoice();
    if(breathVoice){ u.voice=breathVoice; u.lang=breathVoice.lang; } else { u.lang='en-US'; }
    u.rate=0.8; u.pitch=0.95; u.volume=1;   // slow + low = soothing
    speechSynthesis.speak(u);
  }catch(_){}
}
function speakCue(text){
  if(!DB.get('breathVoice',true)) return;
  const off=offlineClip(text);
  if(off){ playTts(off); return; }                                     // bundled natural voice (free, offline)
  const pv=DB.get('premiumVoice','');
  if(pv && DB.get('backendUrl','')){ playPremium(text,pv); return; }   // natural cloud voice
  webSpeak(text);                                                       // device voice fallback
}
function previewVoice(v){
  if(!('speechSynthesis' in window)) return;
  try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance('breathe in… and slowly out.'); u.voice=v; u.lang=v.lang; u.rate=0.85; u.pitch=0.97; speechSynthesis.speak(u); }catch(_){}
}
function previewPremium(v){ unlockTts(); ttsAudio('breathe in… and slowly out.', v.id).then(url=>{ if(url) playTts(url); }); }

/* ---- OFFLINE natural voices: pre-rendered cue clips bundled in the app (free, no backend) ---- */
const OFFLINE_VOICES=[
  {id:'ravi',   name:'Ravi',   accent:'British',           gender:'male',   vibe:'warm · slow'},
  {id:'amy',    name:'Amy',    accent:'American',          gender:'female', vibe:'calm'},
  {id:'ryan',   name:'Ryan',   accent:'American',          gender:'male',   vibe:'easy'},
  {id:'eva',    name:'Eva',    accent:'American',          gender:'female', vibe:'warm'},
  {id:'joe',    name:'Joe',    accent:'American',          gender:'male',   vibe:'mellow'},
  {id:'kristin',name:'Kristin',accent:'American',          gender:'female', vibe:'bright'},
  {id:'marcus', name:'Marcus', accent:'American',          gender:'male',   vibe:'smooth'},
  {id:'cori',   name:'Cori',   accent:'British',           gender:'female', vibe:'gentle'},
  {id:'alan',   name:'Alan',   accent:'British',           gender:'male',   vibe:'steady'},
  {id:'jenny',  name:'Jenny',  accent:'British',           gender:'female', vibe:'soft'},
  {id:'theo',   name:'Theo',   accent:'Northern English',  gender:'male',   vibe:'mellow'},
  {id:'isla',   name:'Isla',   accent:'Scottish',          gender:'female', vibe:'gentle'},
];
const CUE_FILE={'breathe in':'in','breathe out':'out','hold':'hold','breathe':'breathe','well done':'done'};
function offlineClip(text){ const id=DB.get('offlineVoice',''); const f=CUE_FILE[text]; if(!id||!f) return null; return 'assets/voice/'+id+'/'+f+'.mp3'; }
function previewOffline(v){ unlockTts(); playTts('assets/voice/'+v.id+'/in.mp3'); }
function prewarmOffline(){ const id=DB.get('offlineVoice',''); if(!id) return; ['in','out','hold'].forEach(f=>{ try{ fetch('assets/voice/'+id+'/'+f+'.mp3').catch(()=>{}); }catch(_){} }); }
function updateVoiceCur(){
  const el=$('#voiceCur'); if(!el) return;
  const ov=DB.get('offlineVoice','');
  if(ov){ const v=OFFLINE_VOICES.find(x=>x.id===ov); if(v){ el.textContent=v.name+' · '+v.accent+' ✦'; return; } }
  const pv=DB.get('premiumVoice','');
  if(pv){ const v=premiumVoices().find(x=>x.id===pv); if(v){ el.textContent=v.name+' · '+v.accent+' ✦'; return; } }
  const v=breathVoice||pickBreathVoice();
  if(v){ const m=voiceMeta(v); el.textContent=v.name.replace(/\s*\(.*\)$/,'')+(m.accent?(' · '+m.accent):''); } else el.textContent='default';
}
// --- hide/remove voices you don't want cluttering the list (per-device preference) ---
function getHidden(){ return new Set(DB.get('hiddenVoices',[])); }
function isHidden(key){ return getHidden().has(key); }
function toggleHidden(key){ const s=getHidden(); s.has(key)?s.delete(key):s.add(key); DB.set('hiddenVoices',[...s]); ensureValidVoice(); }
function ensureValidVoice(){   // if the active voice got hidden, fall back to a visible one
  const h=getHidden();
  if(DB.get('offlineVoice','') && h.has('o:'+DB.get('offlineVoice',''))){ const fb=OFFLINE_VOICES.find(v=>!h.has('o:'+v.id)); DB.set('offlineVoice', fb?fb.id:''); }
  if(DB.get('premiumVoice','') && h.has('p:'+DB.get('premiumVoice',''))) DB.set('premiumVoice','');
  if(DB.get('voiceName','') && h.has('d:'+DB.get('voiceName',''))) DB.set('voiceName','');
  if(!DB.get('offlineVoice','') && !DB.get('premiumVoice','') && !DB.get('voiceName','')){ const fb=OFFLINE_VOICES.find(v=>!h.has('o:'+v.id)); if(fb) DB.set('offlineVoice',fb.id); }
  breathVoice=pickBreathVoice(); updateVoiceCur();
}
let vpManage=false;
function openVoicePicker(){
  primeSpeech(); unlockTts(); checkTts();   // refresh premium availability for next open
  const h=getHidden();
  const allOff=OFFLINE_VOICES, allPrem=premiumVoices(), allDev=curatedVoices();
  const off  = vpManage?allOff : allOff.filter(v=>!h.has('o:'+v.id));
  const prem = vpManage?allPrem: allPrem.filter(v=>!h.has('p:'+v.id));
  const dev  = vpManage?allDev : allDev.filter(v=>!h.has('d:'+v.name));
  const curOff=DB.get('offlineVoice',''), curPrem=DB.get('premiumVoice',''), curDev=DB.get('voiceName','')||(breathVoice&&breathVoice.name)||'';
  const row=(attr,val,name,tags,sel,key)=> vpManage
    ? `<div class="vp-row manage${h.has(key)?' hid':''}"><span class="vp-info"><span class="vp-name">${name}</span><span class="vp-tags">${tags}</span></span><button class="vp-del" data-key="${key}">${h.has(key)?'restore':'remove'}</button></div>`
    : `<button class="vp-row${sel?' on':''}" ${attr}="${val}"><span class="vp-play">▶</span><span class="vp-info"><span class="vp-name">${name}</span><span class="vp-tags">${tags}</span></span><span class="vp-check">✓</span></button>`;
  const offRows=off.map(v=>row('data-ov',v.id, v.name+' ✦', [v.accent,v.gender,v.vibe].filter(Boolean).join(' · '), v.id===curOff, 'o:'+v.id)).join('');
  const premRows=prem.map(v=>row('data-pv',v.id, v.name+' ✦', [v.accent,v.gender,v.vibe].filter(Boolean).join(' · '), v.id===curPrem, 'p:'+v.id)).join('');
  const devRows=dev.map(v=>{ const m=voiceMeta(v); return row('data-v', v.name.replace(/"/g,'&quot;'), v.name.replace(/\s*\(.*\)$/,''), [m.accent,m.gender,m.vibe].filter(Boolean).join(' · '), (!curOff&&!curPrem&&v.name===curDev), 'd:'+v.name); }).join('');
  const offSection = off.length ? `<div class="vp-sub">✦ natural voices — free &amp; offline</div><div class="vp-list">${offRows}</div>` : '';
  const premSection = prem.length ? `<div class="vp-sub">✦ premium cloud — natural</div><div class="vp-list">${premRows}</div>` : '';
  const devSection = dev.length ? `<div class="vp-sub">on this device</div><div class="vp-list">${devRows}</div>` : '';
  const note = vpManage ? 'tap “remove” to hide a voice you won’t use · “restore” brings it back' : 'tap ▶ to hear it · tap a row to use it';
  openSheet(`<div class="vp"><div class="vp-top"><div class="vp-h">choose a voice ✦</div><button class="vp-manage" id="vpManage">${vpManage?'done':'manage'}</button></div><div class="vp-note">${note}</div>${offSection}${premSection}${devSection}<div class="vp-note dim">the “natural” voices are built in — they work offline with no account. device voices vary by phone.</div></div>`);
  $('#vpManage').addEventListener('click',()=>{ vpManage=!vpManage; openVoicePicker(); });
  if(vpManage){
    $$('.vp-del').forEach(b=>b.addEventListener('click',()=>{ toggleHidden(b.dataset.key); openVoicePicker(); }));
    return;   // no select/preview in manage mode
  }
  $$('.vp-row[data-ov]').forEach(row=>{ const v=off.find(x=>x.id===row.dataset.ov);
    row.querySelector('.vp-play').addEventListener('click',e=>{ e.stopPropagation(); previewOffline(v); });
    row.addEventListener('click',()=>{ DB.set('offlineVoice',v.id); DB.set('premiumVoice',''); DB.set('voiceName',''); $$('.vp-row').forEach(r=>r.classList.remove('on')); row.classList.add('on'); updateVoiceCur(); previewOffline(v); });
  });
  $$('.vp-row[data-pv]').forEach(row=>{ const v=prem.find(x=>x.id===row.dataset.pv);
    row.querySelector('.vp-play').addEventListener('click',e=>{ e.stopPropagation(); previewPremium(v); });
    row.addEventListener('click',()=>{ DB.set('premiumVoice',v.id); DB.set('offlineVoice',''); DB.set('voiceName',''); $$('.vp-row').forEach(r=>r.classList.remove('on')); row.classList.add('on'); updateVoiceCur(); previewPremium(v); });
  });
  $$('.vp-row[data-v]').forEach(row=>{ const v=dev.find(x=>x.name===row.dataset.v);
    row.querySelector('.vp-play').addEventListener('click',e=>{ e.stopPropagation(); previewVoice(v); });
    row.addEventListener('click',()=>{ DB.set('voiceName',v.name); DB.set('premiumVoice',''); DB.set('offlineVoice',''); breathVoice=v; $$('.vp-row').forEach(r=>r.classList.remove('on')); row.classList.add('on'); updateVoiceCur(); previewVoice(v); });
  });
}
// now that all voice declarations exist, do the initial voice load
if('speechSynthesis' in window){ loadBreathVoice(); speechSynthesis.onvoiceschanged=loadBreathVoice; }
function stopBreath(){
  breathRunning=false;
  guidedRunning=false;                                        // also end any guided meditation
  if(breathTimer){clearTimeout(breathTimer);breathTimer=null;}
  if(breathCountTimer){clearInterval(breathCountTimer);breathCountTimer=null;}
  if(guidedTimer){clearTimeout(guidedTimer);guidedTimer=null;}
  if($('#guidedStart')) $('#guidedStart').textContent='begin';
  if('speechSynthesis' in window) speechSynthesis.cancel();   // hush the voice
  stopTts();                                                  // hush premium audio too
  $('.phone').classList.remove('breathing');     // un-focus the background
  const o=$('#breathOrb'); if(o){o.style.transition='transform .6s ease';o.style.transform='scale(.62)';}
  if($('#breathCue')) $('#breathCue').textContent='ready?';
  if($('#breathStart')) $('#breathStart').textContent='start';
  if($('#breathCount')) $('#breathCount').textContent='';
}
// A warm, varied send-off spoken (and shown) at the end of a session — fresh every time.
const CLOSINGS=[
  "beautifully done. carry this calm with you — have a gentle day.",
  "you showed up for yourself just now, and that matters. go easy out there.",
  "take this steadiness with you. the rest of your day is yours.",
  "you did something kind for yourself today. i'm proud of you.",
  "whatever comes next, you can meet it one breath at a time.",
  "you are grounded, you are here, and you are enough.",
  "hold onto this softness. you've got today.",
  "however the day unfolds, you can always come back to this.",
  "notice how much steadier you feel. let that carry you forward.",
  "you made a little space for yourself. keep it for the rest of the day.",
  "be proud — you chose calm. now go have a beautiful day.",
  "the hard parts pass. you're already through more than you know.",
  "soft heart, steady breath. you're ready for whatever's next.",
  "you came back to now. stay close to it as you go.",
  "let the calm linger. you deserve a gentle rest of the day.",
  "one slow breath at a time — that's all today asks of you.",
  "you're doing better than you think. truly.",
  "carry this quiet with you. you're going to be okay.",
  "meet today gently — and that includes being gentle with you.",
  "you paused, you breathed, you came back. that's strength.",
  "take care of yourself today the way you just did.",
  "the calm is yours to keep. go be wonderful.",
  "you showed up, and that's the whole victory. have a lovely day.",
  "steady, grounded, here. now go shine a little.",
];
let _lastClosing=-1;
function pickClosing(){
  if(CLOSINGS.length<2) return CLOSINGS[0]||'';
  let i; do{ i=Math.floor(Math.random()*CLOSINGS.length); }while(i===_lastClosing);
  _lastClosing=i; return CLOSINGS[i];
}
function speakClosing(sel){
  const line=pickClosing();
  if(sel && $(sel)) $(sel).textContent=line+' ✦';
  if(!DB.get('breathVoice',true)) return line;   // voice muted → show text only
  // small delay so it doesn't collide with the speech-cancel from stopBreath()
  setTimeout(()=>{ try{
    const off=DB.get('offlineVoice','');
    if(off){ playTts('assets/voice/'+off+'/done.mp3'); }   // spoken in the SELECTED offline voice
    else speakCue(line);                                    // premium/device synth the full line in the selected voice
  }catch(_){} }, 280);
  return line;
}
function finishBreath(){                          // gentle auto-stop after the recommended time
  stopBreath();
  if($('#breathCue')) $('#breathCue').textContent='done ✦';
  if($('#breathCount')) $('#breathCount').textContent='nicely done — go again any time';
  speakClosing('#biTxt');                         // a fresh, spoken send-off
}
function startBreath(){
  stopBreath(); breathRunning=true;
  primeSpeech(); unlockTts(); prewarmOffline(); prewarmPremium();   // unlock iOS audio within the tap gesture
  $('.phone').classList.add('breathing');        // soft-focus everything but the orb
  $('#breathStart').textContent='stop';
  $('#biTxt').textContent='follow the shape — let it lead your breath. i\'m right here. ✦';
  const pat=BREATH_PATTERNS[curPattern];
  const phases=pat.phases, deadline=Date.now()+(pat.rec||120)*1000;
  const orb=$('#breathOrb'), cue=$('#breathCue');
  let i=0;
  (function step(){
    if(!breathRunning) return;
    const [label,secs]=phases[i];
    cue.textContent=label;
    speakCue(label);                              // soothing spoken guide
    orb.style.transition=`transform ${secs}s ease-in-out`;
    if(label==='breathe in') orb.style.transform='scale(1)';
    else if(label==='breathe out') orb.style.transform='scale(.62)';
    i=(i+1)%phases.length;
    breathTimer=setTimeout(step,secs*1000);
  })();
  // recommended-duration countdown → gently stops itself when it's up
  const tick=()=>{
    if(!breathRunning) return;
    const left=(deadline-Date.now())/1000;
    if(left<=0){ finishBreath(); return; }
    if($('#breathCount')) $('#breathCount').textContent='auto-stops in '+fmtClock(left);
  };
  tick(); breathCountTimer=setInterval(tick,1000);
}
/* ---- GUIDED MEDITATION ---- a spoken ~4-min body-scan relaxation.
   Uses the same TTS path as the breath cues (speakCue → voice picker + ♪ mute),
   the same orb visual, and keeps any ambient sound playing underneath.
   Each step: {say: line, hold: seconds to linger before the next line}. */
const GUIDED=[
  {say:"let's take the next few minutes just for you. settle into a comfortable position, and when you're ready, gently let your eyes close.", hold:14},
  {say:"there's nothing to do here but rest. let your body grow heavy, held by whatever is beneath you.", hold:13},
  {say:"take a slow breath in through your nose… and let it go, softly, through your mouth.", hold:12},
  {say:"we'll move gently through your body, letting each part soften as we go.", hold:10},
  {say:"start at the very top of your head. let your scalp relax, and let your forehead smooth out.", hold:13},
  {say:"soften the space between your eyebrows. unclench your jaw. let your tongue rest easy.", hold:13},
  {say:"now let your shoulders drop, away from your ears. feel them melt down your back.", hold:13},
  {say:"soften your arms… your elbows… all the way to your hands. let your fingers uncurl.", hold:14},
  {say:"let your chest rise and fall on its own. there's no need to control it.", hold:12},
  {say:"soften your belly. let it be round and easy with every breath.", hold:12},
  {say:"release your hips… your thighs… let the big muscles of your legs go loose.", hold:13},
  {say:"soften your knees, your calves, all the way down to your feet. let your toes relax.", hold:13},
  {say:"now let your whole body be still and warm, resting all at once.", hold:12},
  {say:"and just notice your breath. not changing it — only noticing. the cool air in… the warm air out.", hold:16},
  {say:"if your mind has wandered off, that's okay. gently bring it back to this one breath.", hold:15},
  {say:"stay here a little while, soft and quiet, simply breathing.", hold:18},
  {say:"when you feel ready, let your breath deepen a little. wiggle your fingers and your toes.", hold:12},
  {say:"__close", hold:0},
];
let GUIDED_MULT=1;   // 1 = real timings (debug hook can shrink this for fast verification)
let guidedRunning=false, guidedTimer=null, guidedIdx=0;
function guidedStop(){
  guidedRunning=false;
  if(guidedTimer){ clearTimeout(guidedTimer); guidedTimer=null; }
  if('speechSynthesis' in window) speechSynthesis.cancel();
  stopTts();
  $('.phone').classList.remove('breathing');
  if($('#guidedStart')) $('#guidedStart').textContent='begin';
}
function guidedStep(){
  if(!guidedRunning) return;
  if(guidedIdx>=GUIDED.length){ guidedStop(); return; }
  const s=GUIDED[guidedIdx++];
  if(s.say==='__close'){
    guidedRunning=false;
    if($('#guidedStart')) $('#guidedStart').textContent='begin';
    speakClosing('#guidedLine');   // warm, varied spoken (or shown) send-off
    return;
  }
  if($('#guidedLine')) $('#guidedLine').textContent=s.say;
  speakCue(s.say);                 // spoken in the selected voice; silently no-ops if ♪ is muted
  guidedTimer=setTimeout(guidedStep, Math.max(400, s.hold*1000*GUIDED_MULT));
}
function guidedStart(){
  stopBreath();                    // clears any breathing/guided run + hushes voice
  guidedRunning=true; guidedIdx=0;
  primeSpeech(); unlockTts(); prewarmPremium();   // unlock iOS audio within the tap
  $('.phone').classList.add('breathing');         // reuse the soft-focus + orb emphasis
  if($('#guidedStart')) $('#guidedStart').textContent='stop';
  guidedStep();
}

// PANIC flow — one tap from home: jump straight into a guided breath
function exitBreath(){
  const wasPanic=$('.phone').classList.contains('panic');
  stopBreath();
  if(wasPanic) go('home');
}
function enterPanic(){
  go('breathe');
  $('.phone').classList.add('panic');
  const q=QUOTES[Math.floor(Math.random()*QUOTES.length)];   // a fresh motivational quote up top
  if($('#panicMsg')) $('#panicMsg').textContent=q;
  pickPattern('simple');   // auto-pick the simple 4·6 (~90s) rhythm
  startBreath();
}
function patternCycle(p){ return BREATH_PATTERNS[p].phases.reduce((s,ph)=>s+ph[1],0); }
function syncLlama(){
  const cyc=patternCycle(curPattern);
  const llama=$('#breatheLlama'); if(!llama) return;
  llama.style.setProperty('--cyc',cyc+'s');         // bob in time with the breath
  llama.style.setProperty('--walk',(cyc*2.6)+'s');  // and stroll slowly to that tempo
}
function pickPattern(p){
  curPattern=p; $('#breathMeta').textContent=BREATH_PATTERNS[p].meta;
  $$('[data-pattern]').forEach(b=>b.classList.toggle('on',b.dataset.pattern===p));
  syncLlama();
  if(breathRunning) startBreath();
}
const GROUND=[
  {n:5,text:'things you can see',sub:'look around — name each one slowly'},
  {n:4,text:'things you can feel',sub:'textures, temperature, your clothes'},
  {n:3,text:'things you can hear',sub:'near sounds and far ones'},
  {n:2,text:'things you can smell',sub:'or two scents you love'},
  {n:1,text:'thing you can taste',sub:'or take one slow breath'},
];
let groundIdx=0;
function renderGround(){
  if(groundIdx>=GROUND.length){
    $('#groundStep').innerHTML='<div class="gs-num">🤍</div><div class="gs-text">you made it back to now</div><div class="gs-sub">notice how your body feels — a little steadier, maybe</div>';
    $('#groundDots').innerHTML=''; $('#groundNext').textContent='start over';
    speakClosing('#biTxt');                       // fresh spoken send-off at the end of grounding
    return;
  }
  const g=GROUND[groundIdx];
  $('#groundStep').innerHTML=`<div class="gs-num">${g.n}</div><div class="gs-text">${g.text}</div><div class="gs-sub">${g.sub}</div>`;
  $('#groundDots').innerHTML=GROUND.map((_,i)=>`<i class="${i<=groundIdx?'on':''}"></i>`).join('');
  $('#groundNext').textContent=groundIdx===GROUND.length-1?'finish':'next';
}
function brTab(which){
  $$('.br-tab').forEach(t=>t.classList.toggle('on',t.dataset.br===which));
  $('#brBreath').classList.toggle('on',which==='breath');
  $('#brGround').classList.toggle('on',which==='ground');
  $('#brGuided') && $('#brGuided').classList.toggle('on',which==='guided');
  $('#brRes').classList.toggle('on',which==='res');
  stopBreath();
  if(which==='ground'){ groundIdx=0; renderGround(); $('#biTxt').textContent='5-4-3-2-1 — gently bring yourself back to the present. ✦'; }
  if(which==='breath'){ $('#biTxt').textContent='pick a rhythm and press start — i\'ll guide you. ✦'; }
  if(which==='guided'){ if($('#guidedLine')) $('#guidedLine').textContent='a four-minute guided relaxation. find a comfortable place to sit or lie down, then press begin. ✦'; $('#biTxt').textContent='i\'ll talk you gently through a body scan — just listen and rest. ✦'; }
  if(which==='res'){ $('#biTxt').textContent='little things that help when it\'s a lot. take what you need. ✦'; }
}
let breatheWired=false;
function initBreathe(){
  if(!breatheWired){
    $$('.br-tab').forEach(t=>t.addEventListener('click',()=>brTab(t.dataset.br)));
    $$('[data-pattern]').forEach(b=>b.addEventListener('click',()=>pickPattern(b.dataset.pattern)));
    $('#breathStart').addEventListener('click',()=>breathRunning?stopBreath():startBreath());
    $('#breathExit').addEventListener('click',exitBreath);
    // while focused, tapping the orb gently ends the exercise
    $('#breathOrb').addEventListener('click',()=>{ if(breathRunning) stopBreath(); });
    // guided meditation start / stop (+ tap its orb to end)
    if($('#guidedStart')) $('#guidedStart').addEventListener('click',()=>guidedRunning?guidedStop():guidedStart());
    if($('#guidedOrb')) $('#guidedOrb').addEventListener('click',()=>{ if(guidedRunning) guidedStop(); });
    $('#groundNext').addEventListener('click',()=>{ primeSpeech(); unlockTts(); groundIdx++; if(groundIdx>GROUND.length) groundIdx=0; renderGround(); });
    // voice on/off toggle
    const vb=$('#breathVoiceBtn');
    if(vb) vb.addEventListener('click',()=>{
      const on=!DB.get('breathVoice',true); DB.set('breathVoice',on);
      updateVoiceBtn();
      // a tap primes the speech engine on iOS + previews the voice
      if(on){ primeSpeech(); loadBreathVoice(); speakCue('breathe'); } else if('speechSynthesis' in window){ speechSynthesis.cancel(); }
    });
    const vp=$('#voicePick'); if(vp) vp.addEventListener('click',openVoicePicker);
    breatheWired=true;
    pickPattern('box');
  }
  // default to a bundled natural voice on first run (free, offline, non-robotic)
  if(!DB.get('offlineVoice','') && !DB.get('premiumVoice','') && !DB.get('voiceName','')) DB.set('offlineVoice','amy');
  ensureValidVoice();   // don't leave a hidden voice as the active one
  updateVoiceBtn(); updateVoiceCur(); checkTts().then(updateVoiceCur);
  brTab('breath'); stopBreath();
}
function updateVoiceBtn(){
  const vb=$('#breathVoiceBtn'); if(!vb) return;
  const on=DB.get('breathVoice',true);
  vb.textContent='♪';
  vb.classList.toggle('off',!on);
  vb.title=on?'voice guide on':'voice guide off';
}

/* ============================================================
   MUSIC  (Spotify + YouTube embeds; real login comes with wrapper)
   ============================================================ */
function spotifyEmbed(url){
  const m=String(url).match(/open\.spotify\.com\/(intl-\w+\/)?(track|playlist|album|artist|episode|show)\/([A-Za-z0-9]+)/);
  if(!m) return null;
  return `https://open.spotify.com/embed/${m[2]}/${m[3]}`;
}
function youtubeEmbed(url){
  let m=String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
  if(m) return `https://www.youtube.com/embed/${m[1]}`;
  m=String(url).match(/[?&]list=([A-Za-z0-9_-]+)/);
  if(m) return `https://www.youtube.com/embed/videoseries?list=${m[1]}`;
  return null;
}
function appleEmbed(url){
  // any music.apple.com share link → the embeddable player host
  if(!/music\.apple\.com\//.test(String(url))) return null;
  return String(url).trim().replace(/^https?:\/\/(embed\.)?music\.apple\.com/,'https://embed.music.apple.com');
}
function renderMusic(){
  const connected=DB.get('spConnected',false);
  $('#spStatus').textContent=connected?'connected ✦':'not connected';
  $('#spStatus').classList.toggle('on',connected);
  $('#spConnect').textContent=connected?'Spotify connected ✓':'Connect Spotify';
  const sp=DB.get('spLast',''); if(sp) $('#spEmbed').innerHTML=`<iframe style="height:152px" src="${sp}" allow="encrypted-media"></iframe>`;
  const yt=DB.get('ytLast',''); if(yt) $('#ytEmbed').innerHTML=`<iframe style="height:200px" src="${yt}" allowfullscreen></iframe>`;
  const amOn=DB.get('amConnected',false);
  $('#amStatus').textContent=amOn?'connected ✦':'not connected';
  $('#amStatus').classList.toggle('on',amOn);
  const am=DB.get('amLast',''); if(am) $('#amEmbed').innerHTML=`<iframe style="height:175px" src="${am}" allow="autoplay *; encrypted-media *;"></iframe>`;
}
$('#amConnect').addEventListener('click',()=>{
  DB.set('amConnected',true); renderMusic();
  // opens her Apple Music; full in-app library needs MusicKit (wrapper stage)
  window.open('https://music.apple.com/','_blank');
  toast('opening Apple Music ✦');
});
$('#amLoad').addEventListener('click',()=>{
  const url=appleEmbed($('#amLink').value);
  if(!url){ toast('paste an Apple Music link'); return; }
  DB.set('amLast',url); $('#amEmbed').innerHTML=`<iframe style="height:175px" src="${url}" allow="autoplay *; encrypted-media *;"></iframe>`;
});
$('#spConnect').addEventListener('click',()=>{
  // Real OAuth login arrives with the native wrapper — flag it as connected for now.
  DB.set('spConnected',true); renderMusic();
  toast('Spotify linked ✦ (full login comes with the app)');
});
$('#spLoad').addEventListener('click',()=>{
  const url=spotifyEmbed($('#spLink').value);
  if(!url){ toast('paste a Spotify track/playlist link'); return; }
  DB.set('spLast',url); $('#spEmbed').innerHTML=`<iframe style="height:152px" src="${url}" allow="encrypted-media"></iframe>`;
});
$('#ytLoad').addEventListener('click',()=>{
  const val=$('#ytLink').value.trim(); if(!val) return;
  const url=youtubeEmbed(val);
  if(url){ DB.set('ytLast',url); $('#ytEmbed').innerHTML=`<iframe style="height:200px" src="${url}" allowfullscreen></iframe>`; }
  else{ window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(val),'_blank'); toast('searching YouTube…'); }
});

/* ============================================================
   READING  (Open Library search + cover shelves — REAL, no key)
   ============================================================ */
function loadBooks(){ return DB.get('books', []); }
function saveBooks(b){ DB.set('books', b); }
function coverUrl(b,size){ return b.cover ? `https://covers.openlibrary.org/b/id/${b.cover}-${size||'M'}.jpg` : null; }
function bookCoverEl(b,cls){
  const url=coverUrl(b,'M');
  return url
    ? `<img class="${cls}" src="${url}" alt="" loading="lazy">`
    : `<div class="rd-noimg ${cls==='rd-cover'?'':'rd-noimg'}">${esc((b.title||'?').slice(0,40))}</div>`;
}
const olSearch=(()=>{ // debounced Open Library title/author search
  let t=null, ctrl=null;
  return function(q){
    clearTimeout(t);
    return new Promise(res=>{
      t=setTimeout(async()=>{
        try{
          if(ctrl) ctrl.abort(); ctrl=new AbortController();
          const r=await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=7&fields=key,title,author_name,cover_i,first_publish_year`,{signal:ctrl.signal});
          const j=await r.json();
          res((j.docs||[]).map(d=>({key:d.key,title:d.title,author:(d.author_name||[])[0]||'',cover:d.cover_i||null,year:d.first_publish_year||''})));
        }catch(_){ res(null); }
      },300);
    });
  };
})();
function renderResults(list){
  const box=$('#rdResults');
  if(list===null){ box.innerHTML='<div class="rd-loading">couldn’t reach the library — check connection ✦</div>'; box.classList.add('open'); return; }
  if(!list.length){ box.classList.remove('open'); box.innerHTML=''; return; }
  box.innerHTML=list.map((b,i)=>{
    const img=b.cover?`<img src="https://covers.openlibrary.org/b/id/${b.cover}-S.jpg" alt="">`:`<div class="rd-noimg">▤</div>`;
    return `<div class="rd-res" data-i="${i}">${img}<div class="rd-meta"><div class="rd-t">${esc(b.title)}</div><div class="rd-a">${esc(b.author)}${b.year?' · '+b.year:''}</div></div><div class="rd-add">＋</div></div>`;
  }).join('');
  box.classList.add('open');
  box.querySelectorAll('.rd-res').forEach(el=>el.addEventListener('click',()=>{
    addBook(list[Number(el.dataset.i)]); box.classList.remove('open'); $('#rdSearch').value=''; toast('added to your list ✦');
  }));
}
function addBook(b){
  const books=loadBooks();
  if(books.some(x=>x.key===b.key)){ toast('already on your list'); return; }
  books.push({id:uid(),key:b.key,title:b.title,author:b.author,cover:b.cover,year:b.year,status:'want',added:now(),formats:{}});
  saveBooks(books); renderReading(); recommend();
}
function bookHTML(b){
  const url=coverUrl(b,'M');
  const cover=url?`<img class="rd-cover" src="${url}" alt="" loading="lazy">`:`<div class="rd-noimg">${esc(b.title)}</div>`;
  const check=b.status==='finished'?'<div class="rd-check">✓</div>':'';
  return `<div class="rd-book ${b.status==='finished'?'done':''}" data-id="${b.id}"><div class="rd-coverwrap">${cover}${check}</div><div class="rd-bt">${esc(b.title)}</div></div>`;
}
function fillShelf(sel,books){
  const el=$(sel); el.innerHTML=books.map(bookHTML).join('');
  el.querySelectorAll('.rd-book').forEach(bk=>bk.addEventListener('click',()=>openBook(bk.dataset.id)));
}
function renderReading(){
  const books=loadBooks();
  const reading=books.filter(b=>b.status==='reading');
  const want=books.filter(b=>b.status==='want');
  const done=books.filter(b=>b.status==='finished');
  $('#rdReadingNow').hidden=!reading.length; if(reading.length) fillShelf('#rdShelfReading',reading);
  $('#rdWantCount').textContent=want.length?`(${want.length})`:'';
  $('#rdShelfWant').innerHTML = want.length?'':'<div class="rd-empty">search a title above to start your list ✦</div>';
  if(want.length) fillShelf('#rdShelfWant',want);
  $('#rdFinishedSec').hidden=!done.length; if(done.length) fillShelf('#rdShelfDone',done);
}
// recommendations: more from the authors she's saved (Open Library)
let recDone=false;
function recommend(){
  const books=loadBooks(); if(!books.length){ $('#rdRecSec').hidden=true; return; }
  const authors=[...new Set(books.map(b=>b.author).filter(Boolean))].slice(0,2);
  if(!authors.length) return;
  const have=new Set(books.map(b=>b.key));
  Promise.all(authors.map(a=>fetch(`https://openlibrary.org/search.json?author=${encodeURIComponent(a)}&limit=8&fields=key,title,author_name,cover_i`).then(r=>r.json()).catch(()=>null)))
    .then(rs=>{
      const recs=[];
      (rs||[]).forEach(j=>{ if(!j) return; (j.docs||[]).forEach(d=>{ if(d.cover_i && !have.has(d.key) && !recs.some(x=>x.key===d.key)) recs.push({id:'rec',key:d.key,title:d.title,author:(d.author_name||[])[0]||'',cover:d.cover_i}); }); });
      const show=recs.slice(0,10);
      if(!show.length){ $('#rdRecSec').hidden=true; return; }
      $('#rdRecSec').hidden=false;
      const el=$('#rdShelfRec'); el.innerHTML=show.map(bookHTML).join('');
      el.querySelectorAll('.rd-book').forEach((bk,i)=>bk.addEventListener('click',()=>{ addBook(show[i]); toast('added to your list ✦'); }));
    });
}
// book detail sheet: status, external sources, formats, buy
function openBook(id){
  const books=loadBooks(); const b=books.find(x=>x.id===id); if(!b) return;
  const q=encodeURIComponent(b.title+' '+b.author);
  const url=coverUrl(b,'L');
  const cover=url?`<img class="bk-cover" src="${url}" alt="">`:`<div class="rd-noimg">${esc(b.title)}</div>`;
  openSheet(`
    <div class="bk-head">
      ${cover}
      <div class="bk-info">
        <div class="bk-t">${esc(b.title)}</div>
        <div class="bk-a">${esc(b.author||'')}${b.year?' · '+b.year:''}</div>
        <div class="bk-status" id="bkStatus">
          <button data-s="want" class="${b.status==='want'?'on':''}">want</button>
          <button data-s="reading" class="${b.status==='reading'?'on':''}">reading</button>
          <button data-s="finished" class="${b.status==='finished'?'on':''}">finished</button>
        </div>
      </div>
    </div>
    <div class="bk-desc" id="bkDesc">…</div>
    ${b.formats&&(b.formats.epub||b.formats.audio)?`<div class="bk-files">attached: ${[b.formats.epub&&'▤ '+esc(b.formats.epub),b.formats.audio&&'♪ '+esc(b.formats.audio)].filter(Boolean).join(' · ')}</div>`:''}
    <div class="bk-actions">
      <button class="bk-act" data-open="https://openlibrary.org${b.key}"><span class="s-ico">▤</span> read / details</button>
      <button class="bk-act" data-open="https://www.gutenberg.org/ebooks/search/?query=${q}"><span class="s-ico">◇</span> free (Gutenberg)</button>
      <button class="bk-act" data-open="https://libbyapp.com/search/query-${q}/page-1"><span class="s-ico">⧉</span> Libby</button>
      <button class="bk-act" data-open="https://librivox.org/search?q=${q}&search_form=advanced"><span class="s-ico">♪</span> free audio</button>
      <button class="bk-act" data-open="https://www.audible.com/search?keywords=${q}"><span class="s-ico">♫</span> Audible</button>
      <button class="bk-act" data-open="https://openlibrary.org/search?author=${encodeURIComponent(b.author||'')}"><span class="s-ico">✎</span> more by author</button>
      <button class="bk-act" data-open="https://bookshop.org/beta-search?keywords=${q}"><span class="s-ico">🛒</span> Bookshop</button>
      <button class="bk-act" data-open="https://www.amazon.com/s?k=${q}&i=stripbooks"><span class="s-ico">🛒</span> Amazon</button>
      <button class="bk-act wide" data-open="https://www.goodreads.com/search?q=${q}"><span class="s-ico">📒</span> find on Goodreads</button>
      <button class="bk-act wide" id="bkEpub"><span class="s-ico">⬆️</span> ${b.formats&&b.formats.epub?'continue reading':'attach an ePub'}</button>
      <button class="bk-act wide" id="bkAudio"><span class="s-ico">⬆️</span> ${b.formats&&b.formats.audio?'continue listening':'attach an audiobook'}</button>
    </div>
    <button class="bk-remove" id="bkRemove">remove from list</button>
  `);
  // description (lazy from Open Library work)
  fetch(`https://openlibrary.org${b.key}.json`).then(r=>r.json()).then(j=>{
    let d=j.description; if(d&&typeof d==='object') d=d.value;
    $('#bkDesc').textContent=d?String(d).split('\n')[0].slice(0,400):'no description on file.';
  }).catch(()=>{ if($('#bkDesc')) $('#bkDesc').textContent=''; });
  $('#bkStatus').querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
    const arr=loadBooks(); const it=arr.find(x=>x.id===id); it.status=btn.dataset.s;
    if(btn.dataset.s==='finished') it.finished=now();
    saveBooks(arr); $('#bkStatus').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===btn));
    renderReading(); toast(btn.dataset.s==='finished'?'nice work ✦':'updated');
  }));
  $$('.bk-act[data-open]').forEach(btn=>btn.addEventListener('click',()=>window.open(btn.dataset.open,'_blank')));
  $('#bkEpub').addEventListener('click',()=>attachFormat(id,'epub'));
  $('#bkAudio').addEventListener('click',()=>attachFormat(id,'audio'));
  $('#bkRemove').addEventListener('click',()=>{ saveBooks(loadBooks().filter(x=>x.id!==id)); closeSheet(); renderReading(); toast('removed'); });
}
// attach / open an uploaded format (epub opens in a tab, audio plays)
let pendingFormat=null;
function attachFormat(id,kind){
  const b=loadBooks().find(x=>x.id===id);
  if(b && b.formats && b.formats[kind+'Url']){   // already attached this session → open it
    window.open(b.formats[kind+'Url'],'_blank'); return;
  }
  pendingFormat={id,kind};
  $(kind==='epub'?'#epubFile':'#audioFile').click();
}
function onFormatPicked(kind,file){
  if(!pendingFormat||!file) return;
  const {id}=pendingFormat; pendingFormat=null;
  const arr=loadBooks(); const b=arr.find(x=>x.id===id); if(!b) return;
  b.formats=b.formats||{};
  b.formats[kind]=file.name;
  b.formats[kind+'Url']=URL.createObjectURL(file);   // session-only handle
  if(b.status==='want') b.status='reading';
  saveBooks(arr); renderReading();
  toast(kind==='epub'?'ePub attached ✦':'audiobook attached ✦');
  openBook(id);   // refresh detail
}
$('#epubFile').addEventListener('change',e=>{ const f=e.target.files[0]; onFormatPicked('epub',f); e.target.value=''; });
$('#audioFile').addEventListener('change',e=>{ const f=e.target.files[0]; onFormatPicked('audio',f); e.target.value=''; });
/* ---- Goodreads: deep-link integration (no public API since 2020) ---- */
function loadGr(){ return DB.get('goodreads',null); }
function updateGrBar(){ const g=loadGr(); $('#grTxt').textContent=g?'your Goodreads ✦':'connect Goodreads'; }
function grShelf(shelf){ const g=loadGr(); return (g&&g.id)?`https://www.goodreads.com/review/list/${g.id}?shelf=${shelf}`:'https://www.goodreads.com/'; }
function openGoodreads(){
  const g=loadGr();
  openSheet(`
    <h3>Goodreads</h3>
    <div class="set-sub">Goodreads shut down its public API, so this links you straight into Goodreads in your browser (where you're signed in) — your shelves live there.</div>
    <div class="set-list">
      ${g?`<button class="set-btn" data-open="${g.profile}"><span class="s-ico">👤</span> my profile</button>`:''}
      ${g&&g.id?`<button class="set-btn" data-open="${grShelf('to-read')}"><span class="s-ico">⧉</span> want-to-read shelf</button>
                 <button class="set-btn" data-open="${grShelf('currently-reading')}"><span class="s-ico">▤</span> currently reading</button>`:''}
      <button class="set-btn" data-open="https://www.goodreads.com/user/sign_in"><span class="s-ico">🔑</span> ${g?'open Goodreads':'sign in to Goodreads'}</button>
      <button class="set-btn" id="grSet"><span class="s-ico">🔗</span> ${g?'change my profile link':'link my profile'}</button>
      ${g?`<button class="set-btn" id="grDisc"><span class="s-ico">✕</span> disconnect</button>`:''}
    </div>
  `);
  $$('#sheet .set-btn[data-open]').forEach(b=>b.addEventListener('click',()=>window.open(b.dataset.open,'_blank')));
  $('#grSet').addEventListener('click',()=>{
    const v=prompt('paste your Goodreads profile link\n(open Goodreads → your profile → copy the URL)\ne.g. https://www.goodreads.com/user/show/12345-katelynn');
    if(v && /goodreads\.com/.test(v)){ const id=(v.match(/user\/show\/(\d+)/)||[])[1]||''; DB.set('goodreads',{profile:v.trim(),id}); updateGrBar(); toast('Goodreads linked ✦'); openGoodreads(); }
    else if(v) toast('that doesn’t look like a Goodreads link');
  });
  if($('#grDisc')) $('#grDisc').addEventListener('click',()=>{ DB.set('goodreads',null); updateGrBar(); closeSheet(); toast('disconnected'); });
}

let readingWired=false;
function initReading(){
  if(!readingWired){
    $('#grBar').addEventListener('click',openGoodreads);
    const inp=$('#rdSearch');
    inp.addEventListener('input',async()=>{
      const q=inp.value.trim();
      if(q.length<2){ $('#rdResults').classList.remove('open'); return; }
      $('#rdResults').innerHTML='<div class="rd-loading">searching…</div>'; $('#rdResults').classList.add('open');
      const res=await olSearch(q);
      if(inp.value.trim()===q) renderResults(res);
    });
    document.addEventListener('click',e=>{ if(!e.target.closest('.rd-search')) $('#rdResults').classList.remove('open'); });
    readingWired=true;
  }
  $('#rdSearch').value=''; $('#rdResults').innerHTML=''; $('#rdResults').classList.remove('open');
  updateGrBar();
  renderReading(); recommend();
}

/* ============================================================
   MOVIES  (kate.movies — a watchlist built on the same shelves as reading)
   Catalog is the iTunes Search API: keyless, no sign-up, CORS-friendly,
   and it already backs the Apple Music card on the music screen.
   Nothing is streamed or stored here — a film's sheet links out to
   wherever she actually watches it, and "attach a video file" is for a
   copy she already owns (the same deal as attaching an ePub to a book).
   ============================================================ */
function loadMovies(){ return DB.get('movies', []); }
function saveMovies(m){ DB.set('movies', m); }
// artworkUrl100 ends in /100x100bb.jpg — swap the bounding box for a bigger one
function posterUrl(m,px){ const n=px||300; return m.art ? m.art.replace(/\/\d+x\d+bb/, `/${n}x${n}bb`) : null; }
// titles come back with curly or straight apostrophes depending on the field
const normT = s => String(s||'').toLowerCase().replace(/[’‘']/g,"'").replace(/\s+/g,' ').trim();

/* iTunes answers CORS, but a blocked XHR (extension, strict privacy mode)
   would kill search silently — its JSONP callback is the fallback. */
function jsonp(url){
  return new Promise((res,rej)=>{
    const cb='kitJsonp'+uid(), s=document.createElement('script');
    const done=()=>{ clearTimeout(timer); try{ delete window[cb]; }catch(_){ } s.remove(); };
    const timer=setTimeout(()=>{ done(); rej(new Error('timeout')); },9000);
    window[cb]=data=>{ done(); res(data); };
    s.onerror=()=>{ done(); rej(new Error('blocked')); };
    s.src=url+'&callback='+cb; document.head.appendChild(s);
  });
}
function itunes(url){ return fetch(url).then(r=>r.json()).catch(()=>jsonp(url)); }
// iTunes files the director under artistName for films
function mapFilm(r){
  return { key:String(r.trackId||''), title:r.trackName||'', director:r.artistName||'',
           year:String(r.releaseDate||'').slice(0,4), art:r.artworkUrl100||'',
           genre:r.primaryGenreName||'', rated:r.contentAdvisoryRating||'',
           desc:r.longDescription||r.shortDescription||'',
           mins:r.trackTimeMillis?Math.round(r.trackTimeMillis/60000):0,
           apple:r.trackViewUrl||'' };
}
function filmSearch(term,extra){
  return itunes(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=movie&entity=movie&limit=12${extra||''}`)
    .then(j=>(j.results||[]).map(mapFilm));
}
const mvLookup=(()=>{   // debounced title search
  let t=null;
  return function(q){
    clearTimeout(t);
    return new Promise(res=>{
      t=setTimeout(()=>{ filmSearch(q).then(l=>res(l.slice(0,8))).catch(()=>res(null)); },300);
    });
  };
})();
function renderMvResults(list){
  const box=$('#mvResults');
  if(list===null){ box.innerHTML='<div class="rd-loading">couldn’t reach the film catalog — check connection ✦</div>'; box.classList.add('open'); return; }
  if(!list.length){ box.classList.remove('open'); box.innerHTML=''; return; }
  box.innerHTML=list.map((m,i)=>{
    const u=posterUrl(m,100);
    const img=u?`<img src="${esc(u)}" alt="">`:`<div class="rd-noimg">▸</div>`;
    return `<div class="rd-res" data-i="${i}">${img}<div class="rd-meta"><div class="rd-t">${esc(m.title)}</div><div class="rd-a">${esc(m.director)}${m.year?' · '+esc(m.year):''}</div></div><div class="rd-add">＋</div></div>`;
  }).join('');
  box.classList.add('open');
  box.querySelectorAll('.rd-res').forEach(el=>el.addEventListener('click',()=>{
    addMovie(list[Number(el.dataset.i)]); box.classList.remove('open'); $('#mvSearch').value='';
  }));
}
function addMovie(m,opts){
  const quiet=!!(opts&&opts.quiet);
  const arr=loadMovies();
  const dupe=arr.some(x=>(x.key&&m.key&&x.key===m.key) || (normT(x.title)===normT(m.title) && (!x.year||!m.year||x.year===m.year)));
  if(dupe){ if(!quiet) toast('already on your watchlist'); return null; }
  const rec={id:uid(),key:m.key||'',title:m.title,director:m.director||'',year:m.year||'',
             art:m.art||'',genre:m.genre||'',rated:m.rated||'',desc:m.desc||'',mins:m.mins||0,
             apple:m.apple||'',status:'want',added:now(),file:''};
  arr.push(rec); saveMovies(arr);
  if(!quiet){ renderMovies(); mvRecommend(); toast('added to your watchlist ✦'); }
  return rec;
}
function movieHTML(m){
  const u=posterUrl(m,300);
  const cover=u?`<img class="rd-cover poster" src="${esc(u)}" alt="" loading="lazy">`:`<div class="rd-noimg">${esc(m.title)}</div>`;
  const check=m.status==='watched'?'<div class="rd-check">✓</div>':'';
  return `<div class="rd-book ${m.status==='watched'?'done':''}" data-id="${m.id}"><div class="rd-coverwrap">${cover}${check}</div><div class="rd-bt">${esc(m.title)}</div></div>`;
}
function fillMvShelf(sel,list){
  const el=$(sel); el.innerHTML=list.map(movieHTML).join('');
  el.querySelectorAll('.rd-book').forEach(b=>b.addEventListener('click',()=>openMovie(b.dataset.id)));
}
function renderMovies(){
  const arr=loadMovies();
  const want=arr.filter(m=>m.status!=='watched');
  const done=arr.filter(m=>m.status==='watched');
  $('#mvWantCount').textContent=want.length?`(${want.length})`:'';
  $('#mvShelfWant').innerHTML = want.length?'':'<div class="rd-empty">search a film above to start your watchlist ✦</div>';
  if(want.length) fillMvShelf('#mvShelfWant',want);
  $('#mvWatchedSec').hidden=!done.length; if(done.length) fillMvShelf('#mvShelfDone',done);
}
// recommendations: more from the directors already on her list
let mvRecs=[];
function mvRecommend(){
  const arr=loadMovies(); if(!arr.length){ $('#mvRecSec').hidden=true; return; }
  // newest saves first (reverse before the sort so same-millisecond adds tie-break
  // to most-recent too) — recommendations should follow what she just added
  const recent=arr.slice().reverse().sort((a,b)=>(b.added||0)-(a.added||0));
  const dirs=[...new Set(recent.map(m=>m.director).filter(Boolean))].slice(0,2);
  if(!dirs.length){ $('#mvRecSec').hidden=true; return; }
  const have=new Set(arr.map(m=>normT(m.title)));
  Promise.all(dirs.map(d=>filmSearch(d,'&attribute=directorTerm').catch(()=>[])))
    .then(sets=>{
      const recs=[];
      sets.forEach(list=>(list||[]).forEach(m=>{
        if(m.art && !have.has(normT(m.title)) && !recs.some(x=>x.key===m.key)) recs.push(Object.assign({},m,{id:'rec'}));
      }));
      mvRecs=recs.slice(0,10);
      if(!mvRecs.length){ $('#mvRecSec').hidden=true; return; }
      $('#mvRecSec').hidden=false;
      const el=$('#mvShelfRec'); el.innerHTML=mvRecs.map(movieHTML).join('');
      el.querySelectorAll('.rd-book').forEach((b,i)=>b.addEventListener('click',()=>addMovie(mvRecs[i])));
    }).catch(()=>{ $('#mvRecSec').hidden=true; });
}
// film sheet: status, facts, where to watch, and her own copy
function openMovie(id){
  const m=loadMovies().find(x=>x.id===id); if(!m) return;
  const q=encodeURIComponent(m.title+(m.year?' '+m.year:''));
  const dq=encodeURIComponent(m.director||'');
  const u=posterUrl(m,400);
  const cover=u?`<img class="bk-cover poster" src="${esc(u)}" alt="">`:`<div class="rd-noimg">${esc(m.title)}</div>`;
  const facts=[m.year,m.genre,m.rated,m.mins?m.mins+' min':''].filter(Boolean).map(f=>`<span>${esc(f)}</span>`).join('');
  const mine=videoUrls[id];
  openSheet(`
    <div class="bk-head">
      ${cover}
      <div class="bk-info">
        <div class="bk-t">${esc(m.title)}</div>
        <div class="bk-a">${esc(m.director||'')}</div>
        <div class="bk-status" id="mvStatus">
          <button data-s="want" class="${m.status!=='watched'?'on':''}">want to watch</button>
          <button data-s="watched" class="${m.status==='watched'?'on':''}">watched</button>
        </div>
      </div>
    </div>
    ${facts?`<div class="mv-facts">${facts}</div>`:''}
    <div class="bk-desc" id="mvDesc">${m.desc?esc(m.desc):'…'}</div>
    ${m.file?`<div class="bk-files">your copy: ▸ ${esc(m.file)}</div>`:''}
    <div class="bk-actions">
      <button class="bk-act wide" data-open="https://www.justwatch.com/us/search?q=${q}"><span class="s-ico">▸</span> where to watch it</button>
      <button class="bk-act" data-open="${esc(m.apple||('https://tv.apple.com/search?term='+q))}"><span class="s-ico">◈</span> Apple TV</button>
      <button class="bk-act" data-open="https://www.amazon.com/s?k=${q}&i=instant-video"><span class="s-ico">▹</span> Prime Video</button>
      <button class="bk-act" data-open="https://www.netflix.com/search?q=${q}"><span class="s-ico">◼</span> Netflix</button>
      <button class="bk-act" data-open="https://www.youtube.com/results?search_query=${q}+trailer"><span class="s-ico">▷</span> trailer</button>
      <button class="bk-act${dq?'':' wide'}" data-open="https://letterboxd.com/search/${q}/"><span class="s-ico">◉</span> Letterboxd</button>
      ${dq?`<button class="bk-act" data-open="https://letterboxd.com/search/${dq}/"><span class="s-ico">✎</span> more by director</button>`:''}
      <button class="bk-act wide" id="mvFileBtn"><span class="s-ico">⬆️</span> ${mine?'play your copy':(m.file?'re-attach '+esc(m.file):'attach a video file')}</button>
    </div>
    <div class="bk-files">rentals and purchases download for offline inside the Apple TV, Prime Video and Netflix apps themselves ✦</div>
    <button class="bk-remove" id="mvRemove">remove from watchlist</button>
  `);
  // blurb + facts fill in lazily the first time a film's sheet is opened
  if(!m.desc && m.key){
    itunes(`https://itunes.apple.com/lookup?id=${encodeURIComponent(m.key)}`).then(j=>{
      const r=(j.results||[])[0]; if(!r) return;
      const f=mapFilm(r), arr=loadMovies(), t=arr.find(x=>x.id===id);
      if(t){ t.desc=f.desc||t.desc; t.genre=t.genre||f.genre; t.rated=t.rated||f.rated;
             t.mins=t.mins||f.mins; t.apple=t.apple||f.apple; saveMovies(arr); }
      if($('#mvDesc')) $('#mvDesc').textContent=f.desc||'no description on file.';
    }).catch(()=>{ if($('#mvDesc')&&$('#mvDesc').textContent==='…') $('#mvDesc').textContent=''; });
  }
  $('#mvStatus').querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
    const arr=loadMovies(), t=arr.find(x=>x.id===id); if(!t) return;
    t.status=btn.dataset.s; if(t.status==='watched') t.watched=now();
    saveMovies(arr);
    $('#mvStatus').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===btn));
    renderMovies(); toast(t.status==='watched'?'hope it was a good one ✦':'back on the watchlist');
  }));
  $$('#sheet .bk-act[data-open]').forEach(b=>b.addEventListener('click',()=>window.open(b.dataset.open,'_blank')));
  $('#mvFileBtn').addEventListener('click',()=>attachVideo(id));
  $('#mvRemove').addEventListener('click',()=>{ saveMovies(loadMovies().filter(x=>x.id!==id)); closeSheet(); renderMovies(); mvRecommend(); toast('removed'); });
}
/* a film file she owns. The blob handle is session-only (localStorage can't
   hold a movie), so only the filename persists — after a reload she re-picks it. */
const videoUrls={};
let pendingVideo=null;
function attachVideo(id){
  if(videoUrls[id]){ window.open(videoUrls[id],'_blank'); return; }
  pendingVideo=id; $('#videoFile').click();
}
function onVideoPicked(e){
  const f=e.target.files[0]; e.target.value='';
  if(!pendingVideo||!f) return;
  const id=pendingVideo; pendingVideo=null;
  const arr=loadMovies(), m=arr.find(x=>x.id===id); if(!m) return;
  m.file=f.name; saveMovies(arr);
  videoUrls[id]=URL.createObjectURL(f);
  renderMovies(); toast('video attached ✦'); openMovie(id);
}
/* ---- Letterboxd: deep-link integration (no public API) ---- */
function loadLb(){ return DB.get('letterboxd',null); }
function updateLbBar(){ const g=loadLb(); $('#lbTxt').textContent=g?'your Letterboxd ✦':'connect Letterboxd'; }
function openLetterboxd(){
  const g=loadLb();
  openSheet(`
    <h3>Letterboxd</h3>
    <div class="set-sub">Letterboxd has no public API, so this links you straight into it in your browser (where you're signed in) — your diary and lists live there.</div>
    <div class="set-list">
      ${g?`<button class="set-btn" data-open="${esc(g.profile)}"><span class="s-ico">👤</span> my profile</button>`:''}
      ${g&&g.user?`<button class="set-btn" data-open="https://letterboxd.com/${encodeURIComponent(g.user)}/watchlist/"><span class="s-ico">⧉</span> my watchlist</button>
                   <button class="set-btn" data-open="https://letterboxd.com/${encodeURIComponent(g.user)}/films/diary/"><span class="s-ico">▤</span> my diary</button>`:''}
      <button class="set-btn" data-open="https://letterboxd.com/sign-in/"><span class="s-ico">🔑</span> ${g?'open Letterboxd':'sign in to Letterboxd'}</button>
      <button class="set-btn" id="lbSet"><span class="s-ico">🔗</span> ${g?'change my profile link':'link my profile'}</button>
      ${g?`<button class="set-btn" id="lbDisc"><span class="s-ico">✕</span> disconnect</button>`:''}
    </div>
  `);
  $$('#sheet .set-btn[data-open]').forEach(b=>b.addEventListener('click',()=>window.open(b.dataset.open,'_blank')));
  $('#lbSet').addEventListener('click',()=>{
    const v=prompt('paste your Letterboxd profile link\n(open Letterboxd → your profile → copy the URL)\ne.g. https://letterboxd.com/katelynn/');
    if(v && /letterboxd\.com/.test(v)){
      const user=(v.match(/letterboxd\.com\/([^\/?#]+)/)||[])[1]||'';
      DB.set('letterboxd',{profile:v.trim(),user}); updateLbBar(); toast('Letterboxd linked ✦'); openLetterboxd();
    } else if(v) toast('that doesn’t look like a Letterboxd link');
  });
  if($('#lbDisc')) $('#lbDisc').addEventListener('click',()=>{ DB.set('letterboxd',null); updateLbBar(); closeSheet(); toast('disconnected'); });
}
/* ---- the three she asked for, waiting on the shelf the first time she
   opens movies. They go in as stubs so they're there with no signal; the
   poster, runtime and blurb fill in from the catalog when there is one. ---- */
const SEED_MOVIES=[
  {title:"Wayne's World",   year:'1992', director:'Penelope Spheeris'},
  {title:"Wayne's World 2", year:'1993', director:'Stephen Surjik'},
  {title:'Old School',      year:'2003', director:'Todd Phillips'},
];
function seedMovies(){
  if(DB.get('moviesSeeded',false)) return [];
  DB.set('moviesSeeded',true);
  return SEED_MOVIES.map(s=>addMovie(s,{quiet:true})).filter(Boolean);
}
// match a stub against the catalog and fill in what we don't have
function fillMovie(id){
  const m=loadMovies().find(x=>x.id===id);
  if(!m || m.art) return Promise.resolve(false);
  return filmSearch(m.title).then(hits=>{
    const want=normT(m.title);
    const pick = hits.find(h=>normT(h.title)===want && h.year===m.year)
              || hits.find(h=>normT(h.title)===want)
              || hits.find(h=>h.year===m.year);
    if(!pick) return false;
    const arr=loadMovies(), t=arr.find(x=>x.id===id); if(!t) return false;
    t.key=pick.key||t.key; t.art=pick.art; t.genre=pick.genre; t.rated=pick.rated;
    t.desc=pick.desc; t.mins=pick.mins; t.apple=pick.apple;
    if(!t.director) t.director=pick.director;
    saveMovies(arr); return true;
  }).catch(()=>false);
}

let moviesWired=false;
function initMovies(){
  if(!moviesWired){
    $('#lbBar').addEventListener('click',openLetterboxd);
    const inp=$('#mvSearch');
    inp.addEventListener('input',async()=>{
      const q=inp.value.trim();
      if(q.length<2){ $('#mvResults').classList.remove('open'); return; }
      $('#mvResults').innerHTML='<div class="rd-loading">searching…</div>'; $('#mvResults').classList.add('open');
      const res=await mvLookup(q);
      if(inp.value.trim()===q) renderMvResults(res);
    });
    document.addEventListener('click',e=>{ if(!e.target.closest('.rd-search')) $('#mvResults').classList.remove('open'); });
    $('#videoFile').addEventListener('change',onVideoPicked);
    moviesWired=true;
  }
  $('#mvSearch').value=''; $('#mvResults').innerHTML=''; $('#mvResults').classList.remove('open');
  updateLbBar();
  const fresh=seedMovies();
  renderMovies();
  if(fresh.length) toast(`${fresh.length} films added to your watchlist ✦`);
  // top up anything still missing artwork (seeded stubs, or added offline)
  const gaps=loadMovies().filter(m=>!m.art).map(m=>fillMovie(m.id));
  if(gaps.length) Promise.all(gaps).then(rs=>{ if(rs.some(Boolean)) renderMovies(); mvRecommend(); });
  else mvRecommend();
}

/* ============================================================
   GENERIC SHEET
   ============================================================ */
function openSheet(html){ $('#sheetBody').innerHTML=html; $('#scrim').classList.add('open'); $('#sheet').classList.add('open'); orb.classList.add('hide'); $('.phone').classList.add('sheeting'); }
function closeSheet(){ $('#scrim').classList.remove('open'); $('#sheet').classList.remove('open'); orb.classList.remove('hide'); $('.phone').classList.remove('sheeting'); }
$('#scrim').addEventListener('click',closeSheet);

/* ============================================================
   IMPORTANT FILES  (photo → tidy "scanned" PDF, auto-filed in folders)
   ============================================================ */
const FILE_FOLDERS=['IDs & personal','medical','financial','insurance','housing','vehicle','work & school','receipts','other'];
const FOLDER_ICON={'IDs & personal':'🪪','medical':'🩺','financial':'💳','insurance':'🛡️','housing':'🏠','vehicle':'🚗','work & school':'🎓','receipts':'🧾','other':'🗂️'};

// PDFs are too big for localStorage → keep them in IndexedDB
let _fdb=null;
function filesDB(){ return new Promise((res,rej)=>{ if(_fdb) return res(_fdb);
  const r=indexedDB.open('kateFiles',1);
  r.onupgradeneeded=()=>{ const db=r.result; if(!db.objectStoreNames.contains('docs')){ const s=db.createObjectStore('docs',{keyPath:'id'}); s.createIndex('folder','folder'); } };
  r.onsuccess=()=>{ _fdb=r.result; res(_fdb); }; r.onerror=()=>rej(r.error); }); }
function fdbAll(){ return filesDB().then(db=>new Promise(res=>{ const out=[]; db.transaction('docs','readonly').objectStore('docs').openCursor().onsuccess=e=>{ const c=e.target.result; if(c){ out.push(c.value); c.continue(); } else res(out); }; })); }
function fdbPut(d){ return filesDB().then(db=>new Promise((res,rej)=>{ const t=db.transaction('docs','readwrite'); t.objectStore('docs').put(d); t.oncomplete=()=>res(); t.onerror=()=>rej(t.error); })); }
function fdbDel(id){ return filesDB().then(db=>new Promise(res=>{ const t=db.transaction('docs','readwrite'); t.objectStore('docs').delete(id); t.oncomplete=()=>res(); })); }
function blobToDataUrl(b){ return new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(b); }); }

// snap a photo → clean "scanned" look (grayscale + contrast) → jpeg
function imageToScan(file){ return new Promise((res,rej)=>{
  const img=new Image(), url=URL.createObjectURL(file);
  img.onload=()=>{ const max=1500; let w=img.naturalWidth,h=img.naturalHeight; const sc=Math.min(1,max/Math.max(w,h)); w=Math.round(w*sc); h=Math.round(h*sc);
    const c=document.createElement('canvas'); c.width=w; c.height=h; const ctx=c.getContext('2d');
    ctx.filter='grayscale(1) contrast(1.35) brightness(1.07)'; ctx.drawImage(img,0,0,w,h); URL.revokeObjectURL(url);
    c.toBlob(b=>{ b.arrayBuffer().then(ab=>res({bytes:new Uint8Array(ab),w,h,blob:b})); },'image/jpeg',0.82); };
  img.onerror=()=>{ URL.revokeObjectURL(url); rej(new Error('bad image')); }; img.src=url; }); }

// real multi-page PDF by embedding the JPEGs directly (DCTDecode) — no library
function pagesToPdf(pages){
  const enc=s=>new TextEncoder().encode(s); const chunks=[]; let len=0; const off=[];
  const push=u8=>{ chunks.push(u8); len+=u8.length; }; const pstr=s=>push(enc(s));
  pstr('%PDF-1.3\n'); const n=2+pages.length*3; const obj=id=>{ off[id]=len; };
  obj(1); pstr('1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n');
  const kids=pages.map((_,p)=>`${3+p*3} 0 R`).join(' ');
  obj(2); pstr(`2 0 obj\n<</Type/Pages/Kids[${kids}]/Count ${pages.length}>>\nendobj\n`);
  pages.forEach((pg,p)=>{ const pid=3+p*3,cid=4+p*3,iid=5+p*3; const content=`q ${pg.w} 0 0 ${pg.h} 0 0 cm /Im0 Do Q`;
    obj(pid); pstr(`${pid} 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pg.w} ${pg.h}]/Resources<</XObject<</Im0 ${iid} 0 R>>>>/Contents ${cid} 0 R>>\nendobj\n`);
    obj(cid); pstr(`${cid} 0 obj\n<</Length ${content.length}>>\nstream\n${content}\nendstream\nendobj\n`);
    obj(iid); pstr(`${iid} 0 obj\n<</Type/XObject/Subtype/Image/Width ${pg.w}/Height ${pg.h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${pg.bytes.length}>>\nstream\n`);
    push(pg.bytes); pstr('\nendstream\nendobj\n'); });
  const xref=len; let x='xref\n0 '+(n+1)+'\n0000000000 65535 f \n';
  for(let id=1;id<=n;id++) x+=String(off[id]).padStart(10,'0')+' 00000 n \n';
  pstr(x); pstr(`trailer\n<</Size ${n+1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`);
  const out=new Uint8Array(len); let o=0; chunks.forEach(c=>{ out.set(c,o); o+=c.length; });
  return new Blob([out],{type:'application/pdf'});
}

// let Claude file + name it (if connected); else null → she picks
function categorizeDoc(firstBlob){
  const base=DB.get('backendUrl','');
  if(!base) return Promise.resolve(null);
  return blobToDataUrl(firstBlob).then(img=>fetch(base.replace(/\/$/,'')+'/api/categorize-doc',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:img,folders:FILE_FOLDERS})
  }).then(r=>r.json()).then(j=>({folder:FILE_FOLDERS.includes(j.folder)?j.folder:'other',title:(j.title||'document').slice(0,60)}))).catch(()=>null);
}

let scanPages=[];   // [{bytes,w,h,blob}]
function fiShow(view){ ['fiHome','fiFolder','fiScan'].forEach(v=>$('#'+v).classList.toggle('on',v===view)); }
function startScan(){ scanPages=[]; renderScanPages(); fiShow('fiScan'); $('#fiFile').click(); }
function renderScanPages(){
  const box=$('#fiPages');
  if(!scanPages.length){ box.innerHTML='<div class="fi-empty">no pages yet — tap “add page” to snap one ✦</div>'; $('#fiSave').disabled=true; return; }
  $('#fiSave').disabled=false;
  box.innerHTML=scanPages.map((p,i)=>`<div class="fi-page"><img src="${URL.createObjectURL(p.blob)}" alt=""><button class="fi-px" data-i="${i}">×</button><span>page ${i+1}</span></div>`).join('');
  box.querySelectorAll('.fi-px').forEach(b=>b.addEventListener('click',()=>{ scanPages.splice(+b.dataset.i,1); renderScanPages(); }));
}
function onScanFile(e){ const f=e.target.files&&e.target.files[0]; e.target.value=''; if(!f) return;
  imageToScan(f).then(pg=>{ scanPages.push(pg); renderScanPages(); }).catch(()=>toast('couldn’t read that photo')); }
function saveScan(){
  if(!scanPages.length) return;
  const btn=$('#fiSave'); btn.disabled=true; btn.textContent='filing…';
  const pdf=pagesToPdf(scanPages), thumb=scanPages[0].blob;
  categorizeDoc(scanPages[0].blob).then(sug=>{ btn.textContent='save document'; fileItSheet(pdf,thumb,sug); });
}
function fileItSheet(pdf,thumb,sug){
  const title=(sug?sug.title:'document'), folder=(sug?sug.folder:'other');
  openSheet(`<div class="fi-file-sheet">
    <div class="fis-h">${sug?'filed by Kit ✦ — tweak if you like':'name it & pick a folder'}</div>
    <input id="fisTitle" class="fis-input" value="${title.replace(/"/g,'&quot;')}" placeholder="document name">
    <div class="fis-folders">${FILE_FOLDERS.map(f=>`<button class="fis-fold${f===folder?' on':''}" data-f="${f}">${FOLDER_ICON[f]} ${f}</button>`).join('')}</div>
    <button class="br-pill go" id="fisSave" style="width:100%;margin-top:8px">save to folder</button>
  </div>`);
  let pick=folder;
  $$('.fis-fold').forEach(b=>b.addEventListener('click',()=>{ pick=b.dataset.f; $$('.fis-fold').forEach(x=>x.classList.toggle('on',x===b)); }));
  $('#fisSave').addEventListener('click',()=>{
    const doc={id:'d'+Date.now(),title:($('#fisTitle').value.trim()||'document'),folder:pick,created:Date.now(),pages:scanPages.length,pdf,thumb};
    fdbPut(doc).then(()=>{ scanPages=[]; closeSheet(); fiShow('fiHome'); renderFolders(); toast('saved to '+pick+' ✦'); });
  });
}
function renderFolders(){
  fdbAll().then(docs=>{
    const counts={}; docs.forEach(d=>{ counts[d.folder]=(counts[d.folder]||0)+1; });
    const box=$('#fiFolders');
    box.innerHTML=FILE_FOLDERS.map(f=>`<button class="fi-folder" data-f="${f}"><span class="ff-ico">${FOLDER_ICON[f]}</span><span class="ff-name">${f}</span><span class="ff-n">${counts[f]||0}</span></button>`).join('');
    box.querySelectorAll('.fi-folder').forEach(b=>b.addEventListener('click',()=>openFolder(b.dataset.f)));
  });
}
function openFolder(folder){
  $('#fiFolderTitle').textContent=FOLDER_ICON[folder]+' '+folder;
  fdbAll().then(all=>{
    const docs=all.filter(d=>d.folder===folder).sort((a,b)=>b.created-a.created);
    const box=$('#fiDocs');
    if(!docs.length){ box.innerHTML='<div class="fi-empty">nothing filed here yet ✦</div>'; }
    else box.innerHTML=docs.map(d=>`<div class="fi-doc" data-id="${d.id}"><img src="${URL.createObjectURL(d.thumb)}" alt=""><div class="fd-meta"><div class="fd-t">${d.title}</div><div class="fd-s">${d.pages} page${d.pages>1?'s':''} · ${new Date(d.created).toLocaleDateString()}</div></div><button class="fd-open" data-id="${d.id}">open</button><button class="fd-del" data-id="${d.id}">✕</button></div>`).join('');
    box.querySelectorAll('.fd-open').forEach(b=>b.addEventListener('click',()=>openDoc(b.dataset.id,docs)));
    box.querySelectorAll('.fi-doc img').forEach(im=>im.addEventListener('click',()=>openDoc(im.closest('.fi-doc').dataset.id,docs)));
    box.querySelectorAll('.fd-del').forEach(b=>b.addEventListener('click',()=>{ if(confirm('delete this document?')) fdbDel(b.dataset.id).then(()=>{ openFolder(folder); renderFolders(); }); }));
    fiShow('fiFolder');
  });
}
function openDoc(id,docs){
  const d=(docs||[]).find(x=>x.id===id); if(!d) return;
  const url=URL.createObjectURL(d.pdf);
  const w=window.open(url,'_blank');
  if(!w){ const a=document.createElement('a'); a.href=url; a.download=(d.title||'document')+'.pdf'; a.click(); }
}
let filesWired=false;
function initFiles(){
  if(!filesWired){
    $('#fiScanBtn').addEventListener('click',startScan);
    $('#fiAddPage').addEventListener('click',()=>$('#fiFile').click());
    $('#fiSave').addEventListener('click',saveScan);
    $('#fiCancel').addEventListener('click',()=>{ scanPages=[]; fiShow('fiHome'); });
    $('#fiBack').addEventListener('click',()=>{ fiShow('fiHome'); renderFolders(); });
    $('#fiFile').addEventListener('change',onScanFile);
    filesWired=true;
  }
  fiShow('fiHome'); renderFolders();
}

/* ============================================================
   BOOT
   ============================================================ */
const APP_VERSION='v54';   // bump alongside the ?v= asset version
renderTodos();
saveTodos();   // persist seeded defaults on first run so list/home agree
rollQuote();
applyDaypart();       // paint the time-of-day scene + greeting
renderHome();         // "your day" card, mood row, insight teaser
applyCalm();          // restore calm-mode preference
renderLlamas();       // build the llama sprites
setActiveTab('home');

// keep the time-of-day scene honest if the app stays open across a boundary
document.addEventListener('visibilitychange',()=>{ if(document.hidden){ stopBreath(); } else { applyDaypart(); refreshEvePrompt(); armEveReminder(); } });
setInterval(applyDaypart, 15*60*1000);   // and re-check every ~15 min
armEveReminder();   // schedule the 8pm nudge if enabled (re-armed on every foreground)

// register the service worker so it installs as an offline-capable PWA
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{})); }

// dismiss the launch splash once everything's painted
setTimeout(()=>$('.phone').classList.add('loaded'), 900);
