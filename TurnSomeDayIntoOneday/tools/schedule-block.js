// ─── MY SCHEDULE — the times you set for yourself ─────────────────────────────
// Jacques, 19 Sep 2026: "can you put a scheduler with time calendar and alarm in
// the recovery app its own section".
//
// His own times, in his own words, on a calendar, with an alarm that rings when
// they arrive. Everything lives in S.schedule inside the same state blob as the
// journal and the day counter, so it stays on the account and survives a
// reinstall like everything else.
//
// Three rules, because an alarm in a recovery app can do damage a calendar
// alarm cannot:
//   1. NOTHING HERE KEEPS SCORE. A time that passes unmarked just passes. There
//      is no list of misses, no streak of kept times, and this screen never says
//      missed, late, skipped or failed. Somebody who slept through 7am does not
//      need the app to tell them about it.
//   2. NOTHING RINGS THAT WAS NOT ASKED FOR. An entry that is off is off, a time
//      rings once a day, and there is no "you have 4" badge anywhere.
//   3. DISCRETION MODE HIDES THE WORDS. If the phone is handed to somebody, the
//      card says "A time you set" instead of what it is for.
//
// WHAT IT HONESTLY CANNOT DO: wake a phone with the app fully closed. No web page
// can do that on a timer - it needs a push from the server at the minute (see
// server/push.js, which does exactly that hourly for the daily lesson). While the
// app is open, or sitting in another tab, this rings for real, and the phone's own
// notification carries it while the app is in the background. The screen says so
// in as many words rather than implying otherwise.
const SCHEDULE_RING_WINDOW_MIN=3;   // a time rings for three minutes past its minute
const SCHEDULE_SNOOZE_MIN=10;       // "10 more minutes" is ten, not fifteen
const SCHEDULE_DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const SCHEDULE_DAYS_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SCHEDULE_MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const SCHEDULE_MONTHS_SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// The things a person actually sets a time for. They are only words — a chip
// fills the box in and can be typed over.
const SCHEDULE_PRESETS=['A meeting','Call someone','The lesson','Journal','Wind down','Walk'];

function scheduleAll(){
  if(!Array.isArray(S.schedule))S.schedule=[];
  return S.schedule;
}
function schPad2(n){ return n<10?('0'+n):String(n); }
function scheduleEsc(t){
  return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function scheduleDayKey(d){ return d.getFullYear()+'-'+schPad2(d.getMonth()+1)+'-'+schPad2(d.getDate()); }
function scheduleMinuteOfDay(hhmm){
  const m=/^([0-2]?\d):([0-5]\d)$/.exec(String(hhmm==null?'':hhmm));
  if(!m)return null;
  const h=Number(m[1]);
  if(h>23)return null;
  return h*60+Number(m[2]);
}
function scheduleTimeLabel(hhmm){
  const t=scheduleMinuteOfDay(hhmm);
  if(t===null)return String(hhmm==null?'':hhmm);
  const h=Math.floor(t/60),m=t%60,ap=h<12?'am':'pm',h12=(h%12)||12;
  return h12+':'+schPad2(m)+' '+ap;
}
function scheduleShortDate(key){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key==null?'':key));
  if(!m)return String(key==null?'':key);
  return SCHEDULE_MONTHS_SHORT[Number(m[2])-1]+' '+Number(m[3]);
}
// Words for the row and the repeat. Kept beside the matching rule so the two
// cannot drift: every string here describes exactly what scheduleMatchesDay does.
function scheduleRepeatText(e){
  if(!e)return '';
  if(e.repeat==='once')return e.date?('One day — '+scheduleShortDate(e.date)):'One day';
  if(e.repeat==='weekdays')return 'Weekdays, Monday to Friday';
  if(e.repeat==='weekly')return 'Every '+SCHEDULE_DAYS[Number(e.day)||0];
  return 'Every day';
}
function scheduleOn(e){ return !!e&&e.on!==false; }
// Which days an entry belongs to. `d` is a Date; only its calendar day is read.
function scheduleMatchesDay(e,d){
  if(!e)return false;
  const key=scheduleDayKey(d);
  if(e.repeat==='once')return String(e.date||'')===key;
  if(e.repeat==='weekdays'){ const w=d.getDay(); return w>=1&&w<=5; }
  if(e.repeat==='weekly')return Number(e.day)===d.getDay();
  return true;   // daily, and anything unrecognised, is every day
}
// Due: its minute has arrived within the last few minutes and it has not already
// rung today. Anything older than the window is simply behind you — it is not a
// debt, and the app does not ring late to make a point.
function scheduleDueAt(e,now){
  if(!scheduleOn(e))return false;
  const t=scheduleMinuteOfDay(e.time);
  if(t===null)return false;
  if(!scheduleMatchesDay(e,now))return false;
  const mins=now.getHours()*60+now.getMinutes();
  const late=mins-t;
  if(late<0||late>SCHEDULE_RING_WINDOW_MIN)return false;
  return e.lastFired!==scheduleDayKey(now);
}
// A snoozed time rings again on its own, even though it has already rung today.
function scheduleSnoozedAt(e,now){
  if(!scheduleOn(e))return false;
  const list=Array.isArray(S.scheduleSnooze)?S.scheduleSnooze:[];
  const s=list.find(x=>x&&x.id===e.id);
  return !!(s&&now.getTime()>=Number(s.until||0));
}
function scheduleDue(now){
  return scheduleAll().filter(e=>scheduleDueAt(e,now)||scheduleSnoozedAt(e,now));
}
function scheduleByTime(a,b){
  return (scheduleMinuteOfDay(a&&a.time)||0)-(scheduleMinuteOfDay(b&&b.time)||0);
}
// The soonest time still coming, looking eight days out so a weekly entry is
// always found. Today's already-rung times are skipped rather than counted as
// still ahead.
function scheduleNext(now){
  let best=null;
  scheduleAll().forEach(e=>{
    if(!scheduleOn(e))return;
    const t=scheduleMinuteOfDay(e.time);
    if(t===null)return;
    for(let d=0;d<8;d++){
      const day=new Date(now.getFullYear(),now.getMonth(),now.getDate()+d);
      if(!scheduleMatchesDay(e,day))continue;
      if(d===0&&e.lastFired===scheduleDayKey(day))continue;
      const at=new Date(day.getFullYear(),day.getMonth(),day.getDate(),0,t);
      if(at.getTime()<=now.getTime())continue;
      if(!best||at.getTime()<best.at.getTime())best={entry:e,at:at};
      break;
    }
  });
  return best;
}
function scheduleInText(ms){
  const m=Math.round(Math.max(0,ms)/60000);
  if(m<1)return 'any minute now';
  if(m<60)return 'in '+m+' min';
  const h=Math.floor(m/60),mm=m%60;
  if(h<24)return 'in '+h+'h'+(mm?(' '+mm+'m'):'');
  const d=Math.round(h/24);
  return d===1?'in a day':('in '+d+' days');
}
function scheduleDayName(d,now){
  now=now||new Date();
  const key=scheduleDayKey(d);
  if(key===scheduleDayKey(now))return 'Today';
  const t=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  if(key===scheduleDayKey(t))return 'Tomorrow';
  return SCHEDULE_DAYS[d.getDay()];
}
// Discretion mode: the words are his, and what he is doing at 7pm is nobody
// else's business if the phone is not in his hand.
function scheduleLabelFor(e){
  if(S.discretionMode)return 'A time you set';
  const w=e&&e.what?String(e.what).trim():'';
  return w||'A time you set';
}

/* ── the screen ──────────────────────────────────────────────────────────── */
let schCalY=null, schCalM=null, schCalKey=null, schEditingId=null, schRinging=null;

function openSchedule(){
  renderSchedule();
  switchTo('schedule');
  actBn('bn-tools');
}
// Every row on this screen is built as markup after boot, and an <i class="ti">
// created after renderIcons() has run draws NOTHING — the invisible-button bug
// that hid the header back arrow. So anything drawn here is handed to
// renderIcons on the way out, the same way the journal, the timeline and the
// lesson player do it.
function scheduleIcons(){
  try{
    ['sch-today','sch-list','sch-cal-hd','sch-day'].forEach(id=>{
      const el=document.getElementById(id);
      if(el)renderIcons(el);
    });
  }catch(e){}
}
function renderSchedule(){
  const now=new Date();
  renderScheduleNext(now);
  renderScheduleToday(now);
  renderScheduleCalendar(now);
  renderScheduleList(now);
  updateScheduleNotifRow();
  scheduleIcons();
}
function renderScheduleNext(now){
  const timeEl=document.getElementById('sch-next-time');
  const titleEl=document.getElementById('sch-next-title');
  const subEl=document.getElementById('sch-next-sub');
  if(!titleEl||!subEl)return;
  const nx=scheduleNext(now);
  if(!nx){
    if(timeEl)timeEl.textContent='—';
    titleEl.textContent='Nothing set yet';
    subEl.textContent='Add a time below and this is where you will see it coming.';
    return;
  }
  if(timeEl)timeEl.textContent=scheduleTimeLabel(nx.entry.time);
  titleEl.textContent=scheduleLabelFor(nx.entry);
  subEl.textContent=scheduleInText(nx.at.getTime()-now.getTime())+' · '+scheduleDayName(nx.at,now)+' · '+scheduleRepeatText(nx.entry);
}
function scheduleDayEntries(key){
  const d=new Date(key+'T12:00:00');
  return scheduleAll().filter(e=>scheduleMatchesDay(e,d)).sort(scheduleByTime);
}
function renderScheduleToday(now){
  const box=document.getElementById('sch-today');
  if(!box)return;
  const key=scheduleDayKey(now);
  const list=scheduleDayEntries(key);
  if(!list.length){
    box.innerHTML='<div class="sch-none">Nothing set for today.</div>';
    return;
  }
  box.innerHTML=list.map(e=>{
    const done=e.doneOn===key;
    const meta=done?'Done for today':(scheduleOn(e)?scheduleRepeatText(e):'Turned off');
    return '<div class="sch-row'+(scheduleOn(e)?'':' off')+(done?' done':'')+'">'
      +'<div class="sch-time">'+scheduleEsc(scheduleTimeLabel(e.time))+'</div>'
      +'<div class="sch-what">'+scheduleEsc(scheduleLabelFor(e))+'<div class="sch-meta">'+scheduleEsc(meta)+'</div></div>'
      +'<button class="sch-btn" title="'+(done?'Not done after all':'Done')+'" onclick="scheduleMarkDone(\''+scheduleEsc(e.id)+'\')"><i class="ti ti-check"></i></button>'
      +'<button class="sch-btn" title="Change this time" onclick="scheduleEdit(\''+scheduleEsc(e.id)+'\')"><i class="ti ti-pencil"></i></button>'
      +'</div>';
  }).join('');
  scheduleIcons();
}
// A month, six weeks of cells so the grid never jumps in height. Every cell
// knows its own calendar day, which is what the dots and the tap are read from.
function scheduleMonthGrid(y,m){
  const start=new Date(y,m,1).getDay();
  const cells=[];
  for(let i=0;i<42;i++){
    const d=new Date(y,m,1-start+i);
    cells.push({key:scheduleDayKey(d),day:d.getDate(),inMonth:d.getMonth()===m,weekday:d.getDay()});
  }
  return cells;
}
function renderScheduleCalendar(now){
  now=now||new Date();
  if(schCalY===null||schCalM===null){schCalY=now.getFullYear();schCalM=now.getMonth();}
  const hd=document.getElementById('sch-cal-hd');
  const box=document.getElementById('sch-cal');
  if(hd)hd.innerHTML='<span>'+SCHEDULE_MONTHS[schCalM]+' '+schCalY+'</span>'
    +'<span class="sch-nav">'
    +'<button class="sch-btn" title="The month before" onclick="scheduleMonth(-1)"><i class="ti ti-arrow-left"></i></button>'
    +'<button class="sch-btn" title="The month after" onclick="scheduleMonth(1)"><i class="ti ti-arrow-right"></i></button>'
    +'</span>';
  if(!box)return;
  const todayKey=scheduleDayKey(now);
  box.innerHTML=scheduleMonthGrid(schCalY,schCalM).map(c=>{
    const n=scheduleDayEntries(c.key).filter(scheduleOn).length;
    return '<div class="sch-cd'+(c.inMonth?'':' out')+(c.key===todayKey?' today':'')+(c.key===schCalKey?' sel':'')+'" onclick="schedulePickDay(\''+c.key+'\')">'
      +'<span>'+c.day+'</span>'+(n?'<i class="sch-dot"></i>':'')+'</div>';
  }).join('');
  renderScheduleDay();
}
function renderScheduleDay(){
  const box=document.getElementById('sch-day');
  if(!box)return;
  if(!schCalKey){box.innerHTML='';return;}
  const list=scheduleDayEntries(schCalKey);
  const title=scheduleShortDate(schCalKey)+' — '+(list.length?list.length+(list.length===1?' time':' times'):'nothing set');
  box.innerHTML='<div class="sch-dayhd">'+scheduleEsc(title)+'</div>'
    +(list.length?list.map(e=>'<div class="sch-row'+(scheduleOn(e)?'':' off')+'">'
      +'<div class="sch-time">'+scheduleEsc(scheduleTimeLabel(e.time))+'</div>'
      +'<div class="sch-what">'+scheduleEsc(scheduleLabelFor(e))+'<div class="sch-meta">'+scheduleEsc(scheduleOn(e)?scheduleRepeatText(e):'Turned off')+'</div></div>'
      +'</div>').join(''):'');
  scheduleIcons();
}
function scheduleMonth(step){
  const now=new Date();
  if(schCalY===null||schCalM===null){schCalY=now.getFullYear();schCalM=now.getMonth();}
  let m=schCalM+Number(step||0),y=schCalY;
  while(m<0){m+=12;y--;}
  while(m>11){m-=12;y++;}
  schCalY=y;schCalM=m;
  renderScheduleCalendar(now);
}
function schedulePickDay(key){
  schCalKey=(schCalKey===key)?null:key;
  renderScheduleCalendar(new Date());
}
function renderScheduleList(now){
  const box=document.getElementById('sch-list');
  if(!box)return;
  const list=scheduleAll().slice().sort(scheduleByTime);
  if(!list.length){
    box.innerHTML='<div class="sch-none">Nothing set yet.</div>';
    return;
  }
  box.innerHTML=list.map(e=>'<div class="sch-row'+(scheduleOn(e)?'':' off')+'">'
    +'<div class="sch-time">'+scheduleEsc(scheduleTimeLabel(e.time))+'</div>'
    +'<div class="sch-what">'+scheduleEsc(scheduleLabelFor(e))+'<div class="sch-meta">'+scheduleEsc(scheduleRepeatText(e))+'</div></div>'
    +'<div class="toggle-sw'+(scheduleOn(e)?' on':'')+'" title="Turn this time on or off" onclick="scheduleToggle(\''+scheduleEsc(e.id)+'\')"><div class="toggle-knob"></div></div>'
    +'<button class="sch-btn" title="Change this time" onclick="scheduleEdit(\''+scheduleEsc(e.id)+'\')"><i class="ti ti-pencil"></i></button>'
    +'<button class="sch-btn" title="Delete this time" onclick="scheduleDelete(\''+scheduleEsc(e.id)+'\')"><i class="ti ti-x"></i></button>'
    +'</div>').join('');
  scheduleIcons();
}

/* ── setting one ─────────────────────────────────────────────────────────── */
function scheduleNextHour(now){
  return schPad2((now.getHours()+1)%24)+':00';
}
function scheduleFormRepeat(){
  const r=document.getElementById('sch-form-repeat');
  if(!r)return;
  const once=document.getElementById('sch-form-date-wrap');
  const wk=document.getElementById('sch-form-day-wrap');
  if(once)once.style.display=(r.value==='once')?'':'none';
  if(wk)wk.style.display=(r.value==='weekly')?'':'none';
  const d=document.getElementById('sch-form-date');
  if(d&&!d.value)d.value=scheduleDayKey(new Date());
}
function schedulePreset(what){
  const el=document.getElementById('sch-form-what');
  if(el)el.value=what;
}
function scheduleFormDefaults(){
  const t=document.getElementById('sch-form-time');
  if(t&&!t.value)t.value=scheduleNextHour(new Date());
  scheduleFormRepeat();
}
function scheduleSave(){
  const whatEl=document.getElementById('sch-form-what');
  const timeEl=document.getElementById('sch-form-time');
  const repEl=document.getElementById('sch-form-repeat');
  const dateEl=document.getElementById('sch-form-date');
  const dayEl=document.getElementById('sch-form-day');
  const time=(timeEl&&timeEl.value)||'';
  if(scheduleMinuteOfDay(time)===null){
    appInfo('A time needs a time','Pick the hour and the minute first — then it has somewhere to ring.');
    return;
  }
  const what=(((whatEl&&whatEl.value)||'').trim().slice(0,60))||'A time you set';
  const repeat=(repEl&&repEl.value)||'daily';
  const entry={
    id:schEditingId||('sch_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),
    what:what,time:time,repeat:repeat,on:true
  };
  if(repeat==='once')entry.date=(dateEl&&dateEl.value)||scheduleDayKey(new Date());
  if(repeat==='weekly')entry.day=Number((dayEl&&dayEl.value)||0);
  const all=scheduleAll();
  const at=schEditingId?all.findIndex(x=>x&&x.id===schEditingId):-1;
  if(at>-1){
    // A change to a time keeps whether it was on and where it had got to.
    entry.on=scheduleOn(all[at]);
    entry.doneOn=all[at].doneOn;
    entry.lastFired=all[at].lastFired;
    all[at]=entry;
  }else{
    all.push(entry);
  }
  schEditingId=null;
  save();
  scheduleCancelEdit();
  renderSchedule();
  scheduleAlarmCheck();
}
function scheduleCancelEdit(){
  schEditingId=null;
  const whatEl=document.getElementById('sch-form-what');
  if(whatEl)whatEl.value='';
  const timeEl=document.getElementById('sch-form-time');
  if(timeEl)timeEl.value=scheduleNextHour(new Date());
  const note=document.getElementById('sch-editing');
  if(note){note.textContent='';note.style.display='none';}
  const btn=document.getElementById('sch-save-btn');
  if(btn)btn.textContent='Set this time';
  scheduleFormRepeat();
}
function scheduleEdit(id){
  const e=scheduleAll().find(x=>x&&x.id===id);
  if(!e)return;
  schEditingId=id;
  const set=(elId,v)=>{const el=document.getElementById(elId);if(el)el.value=v;};
  set('sch-form-what',scheduleLabelFor(e));
  set('sch-form-time',e.time||'');
  set('sch-form-repeat',e.repeat||'daily');
  if(e.date)set('sch-form-date',e.date);
  if(e.day!=null)set('sch-form-day',String(e.day));
  const note=document.getElementById('sch-editing');
  if(note){note.textContent='Changing the '+scheduleTimeLabel(e.time)+' one — save when it reads right.';note.style.display='';}
  const btn=document.getElementById('sch-save-btn');
  if(btn)btn.textContent='Save this change';
  scheduleFormRepeat();
}
function scheduleToggle(id){
  const e=scheduleAll().find(x=>x&&x.id===id);
  if(!e)return;
  e.on=!scheduleOn(e);
  // Turning one off takes any snooze with it, so a time cannot ring after it
  // was switched off.
  if(!e.on&&Array.isArray(S.scheduleSnooze))S.scheduleSnooze=S.scheduleSnooze.filter(x=>x&&x.id!==id);
  save();
  renderSchedule();
}
function scheduleDelete(id){
  const e=scheduleAll().find(x=>x&&x.id===id);
  if(!e)return;
  if(!confirm('Delete the '+scheduleTimeLabel(e.time)+' one?'))return;
  S.schedule=scheduleAll().filter(x=>x&&x.id!==id);
  if(Array.isArray(S.scheduleSnooze))S.scheduleSnooze=S.scheduleSnooze.filter(x=>x&&x.id!==id);
  if(schEditingId===id)scheduleCancelEdit();
  save();
  renderSchedule();
}
function scheduleMarkDone(id){
  const e=scheduleAll().find(x=>x&&x.id===id);
  if(!e)return;
  const key=scheduleDayKey(new Date());
  e.doneOn=(e.doneOn===key)?null:key;
  save();
  renderScheduleToday(new Date());
}

/* ── the alarm ───────────────────────────────────────────────────────────── */
// A soft two-note, made here rather than shipped as a file: nothing to download,
// and it can never turn up late from the network. Fails silently on a browser
// that will not give a page an audio context — the card still shows.
function scheduleChime(){
  try{
    const Ctx=(typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext))
      ||(typeof AudioContext!=='undefined'?AudioContext:null);
    if(!Ctx)return;
    const ctx=new Ctx();
    [0,0.34].forEach((off,i)=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type='sine';
      o.frequency.value=i?587.33:523.25;      // C5, then D5
      const t=ctx.currentTime+off;
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(i?0.16:0.2,t+0.04);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.75);
      o.connect(g);g.connect(ctx.destination);
      o.start(t);o.stop(t+0.8);
    });
    setTimeout(()=>{try{ctx.close();}catch(e){}},1600);
  }catch(e){}
}
function scheduleAlarmCheck(){
  if(schRinging)return;         // one card at a time; the next tick takes the rest
  const now=new Date();
  const due=scheduleDue(now);
  if(!due.length)return;
  scheduleRing(due.slice().sort(scheduleByTime)[0],now);
}
function scheduleRing(e,now){
  now=now||new Date();
  if(!e)return;
  schRinging=e.id;
  // Marked as rung before anything is drawn, so a second tick, a re-render or a
  // reload cannot ring the same time twice.
  e.lastFired=scheduleDayKey(now);
  if(Array.isArray(S.scheduleSnooze))S.scheduleSnooze=S.scheduleSnooze.filter(x=>x&&x.id!==e.id);
  save();
  const card=document.getElementById('sch-alarm');
  const timeEl=document.getElementById('sch-alarm-time');
  const whatEl=document.getElementById('sch-alarm-what');
  if(timeEl)timeEl.textContent=scheduleTimeLabel(e.time);
  if(whatEl)whatEl.textContent=scheduleLabelFor(e);
  if(card)card.style.display='block';
  scheduleChime();
  try{ if(navigator.vibrate)navigator.vibrate([90,120,90]); }catch(x){}
  // The phone's own notification, for when the app is not the thing being looked
  // at. With the app open there is already a card and a chime, and a second buzz
  // on top of it would be noise.
  if(document.hidden){
    sendPhoneNotification(scheduleTimeLabel(e.time)+' — '+scheduleLabelFor(e),'You asked to be reminded at this time.');
  }
}
function scheduleRingClose(){
  schRinging=null;
  const card=document.getElementById('sch-alarm');
  if(card)card.style.display='none';
}
function scheduleRingDone(){
  const e=scheduleAll().find(x=>x&&x.id===schRinging);
  if(e){e.doneOn=scheduleDayKey(new Date());save();}
  scheduleRingClose();
  renderSchedule();
}
function scheduleRingSnooze(){
  const id=schRinging;
  if(id){
    const list=Array.isArray(S.scheduleSnooze)?S.scheduleSnooze:[];
    S.scheduleSnooze=list.filter(x=>x&&x.id!==id);
    S.scheduleSnooze.push({id:id,until:Date.now()+SCHEDULE_SNOOZE_MIN*60000});
    save();
  }
  scheduleRingClose();
  renderSchedule();
}
function scheduleRingLater(){
  scheduleRingClose();
  renderSchedule();
}
function updateScheduleNotifRow(){
  const sub=document.getElementById('sch-notif-sub');
  if(!sub)return;
  if(typeof Notification==='undefined'){sub.textContent='Not supported in this browser';return;}
  if(Notification.permission==='granted')sub.textContent='On — the phone\'s own notification carries a time while you are in another app';
  else if(Notification.permission==='denied')sub.textContent='Blocked — turn notifications back on for this app in your device settings';
  else sub.textContent='Tap to allow the phone\'s notification sound';
}
// Every twenty seconds, and again the moment the app comes back to the front:
// a backgrounded phone throttles timers hard, so the return is what closes the
// gap after the screen has been off.
let scheduleTimer=null;
function startScheduleTimer(){
  clearInterval(scheduleTimer);
  scheduleTimer=setInterval(scheduleAlarmCheck,20000);
  scheduleAlarmCheck();
}
document.addEventListener('visibilitychange',()=>{ if(!document.hidden)scheduleAlarmCheck(); });
// ─── END OF MY SCHEDULE ───────────────────────────────────────────────────────
