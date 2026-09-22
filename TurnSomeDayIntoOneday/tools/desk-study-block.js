/* ---------- study the timing --------------------------------------------- */
/* Jacques, 19 Sep 2026: "the trading desk needs a part in there where it helps
   me ... research for me to get better timing".

   So: four questions, and every one of them is something he already says out
   loud about his own trading. Each is answered by counting what the bars did,
   on the same swing code the structure block above uses, so the letters on the
   page and the counts in here cannot disagree with each other.

     1. THE POKE. "A wick is not a break, a close is." How many times did price
        trade above a 4h swing high, and how many of those did it then CLOSE
        above? The ones that never closed are the grab — the exact thing that
        has been costing him, because he reacts to the poke.
     2. THE RETRACE. He waits for price to come back to the level instead of
        chasing it. So: of the down legs in these bars, how many came all the
        way back to the swing high that started them, and how many never came
        back at all?
     3. THE HOLD. "Holding for a period of time" is a number of bars or it is
        not a rule. So: every higher low on the 15m, and how many bars it took
        before the first close below it.
     4. THE WINDOW. What share of the range a day made was inside his own
        session window, and how often the high or the low of the day was made
        in there.

   WHAT THIS IS NOT. It is not a backtest. No setup of his is entered, exited
   or priced anywhere in this file, so there is no result to show him, and the
   assistant is told that in as many words. It is counting on bars that came
   back, every figure is printed with the count behind it, and nothing is
   projected from any of it.

   AND IT IS A SMALL SAMPLE ON PURPOSE. One loaded window of bars is a few
   weeks of 4h and a few days of 15m. The page says which dates and how many
   bars, and the assistant is told to say how thin a count is whenever it
   repeats one.

   It pulls its own bars, at 500 a timeframe, because the read above only holds
   the last few of each and a study needs a stretch. STUDY holds exactly what
   came back: a failed load leaves nothing behind rather than the previous
   study, so nothing on the page can be read as a measurement it is not. */
var STUDY=null, STUDY_BARS=500, POKE_LOOK=6;

function studyMsg(text, isErr){
  var el=document.getElementById('studyMsg');
  if(!el) return;
  el.textContent=text;
  el.className='feedwhen'+(isErr?' err':'');
}
function studyBars(tf){
  if(!STUDY||!STUDY.ok||!STUDY.timeframes) return null;
  var d=STUDY.timeframes[tf];
  return (d&&d.candles&&d.candles.length)?d.candles:null;
}
var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function dayText(ms){
  var d=new Date(ms);
  return d.getDate()+' '+MONTHS[d.getMonth()];
}
/* Bars come back with a time on them and the swings come back as prices and
   times, and every count below needs to know which bar a swing came from. */
function barIndex(candles){
  var m={}, i;
  for(i=0;i<candles.length;i++) m[candles[i].t]=i;
  return m;
}
function midOf(list){
  if(!list||!list.length) return null;
  return list[Math.floor(list.length/2)];
}
/* 1. THE POKE AND THE CLOSE. One count per swing high that a later bar traded
   above: did a bar then CLOSE above it within POKE_LOOK bars, or not? The
   deepest poke that failed is kept too, in points, because how far a grab goes
   is the difference between a stop that survives it and one that does not. */
function pokeStudy(candles){
  var sw=structure(candles, WING).swings, at=barIndex(candles);
  var out={pokes:0, closed:0, failed:0, deep:null, level:null}, i, k;
  for(i=0;i<sw.length;i++){
    if(sw[i].kind!=='H') continue;
    var a=at[sw[i].t];
    if(a===undefined) continue;
    var j=-1;
    for(k=a+1;k<candles.length;k++){ if(candles[k].h>sw[i].p){ j=k; break } }
    if(j<0) continue;                 /* never traded above: not a poke */
    out.pokes++;
    var closed=false, top=candles[j].h, end=Math.min(candles.length, j+POKE_LOOK);
    for(k=j;k<end;k++){
      if(candles[k].h>top) top=candles[k].h;
      if(candles[k].c>sw[i].p){ closed=true; break }
    }
    if(closed) out.closed++;
    else {
      out.failed++;
      var d=top-sw[i].p;
      if(out.deep===null||d>out.deep){ out.deep=d; out.level=sw[i].p }
    }
  }
  return out;
}
/* 2. THE RETRACE. A down leg is a swing high followed by the next swing low.
   The retrace is the highest price after that low, before the first bar that
   CLOSES back below the low — his own close-not-wick rule again. So a leg back
   at the swing high is 100% of itself, and a leg that broke its low without
   coming back is 0%. A leg whose low has not gone yet is counted as live and
   kept in the list, because it has not finished doing anything. */
function retraceStudy(candles){
  var sw=structure(candles, WING).swings, at=barIndex(candles);
  var pcts=[], live=0, whole=0, twoThirds=0, under=0, none=0, i, k;
  for(i=0;i<sw.length-1;i++){
    if(sw[i].kind!=='H'||sw[i+1].kind!=='L') continue;
    var h=sw[i], low=sw[i+1], b=at[low.t];
    if(b===undefined) continue;
    var leg=h.p-low.p;
    if(!(leg>0)) continue;
    var top=null, broke=false;
    for(k=b+1;k<candles.length;k++){
      if(candles[k].c<=low.p){ broke=true; break }
      if(top===null||candles[k].h>top) top=candles[k].h;
    }
    if(!broke) live++;
    var pct=(top===null)?0:((top-low.p)/leg);
    pcts.push(pct);
    if(pct>=0.99) whole++;
    if(pct>=2/3) twoThirds++;
    if(pct<1/3) under++;
    if(pct<=0) none++;
  }
  var sorted=pcts.slice().sort(function(a,b){ return a-b });
  return {n:pcts.length, live:live, whole:whole, twoThirds:twoThirds, under:under, none:none, mid:midOf(sorted)};
}
/* 3. THE HOLD. Every higher low in the bars, and how many bars it lasted before
   the first bar CLOSED below it. A higher low still standing when the bars run
   out is counted as still holding and is not given a length, because it has not
   had one yet. */
function holdStudy(candles){
  var st=structure(candles, WING), sw=st.swings, lab=st.labels, at=barIndex(candles);
  var holds=[], holding=0, i, k;
  for(i=0;i<sw.length;i++){
    if(sw[i].kind!=='L'||lab[i]!=='HL') continue;
    var a=at[sw[i].t];
    if(a===undefined) continue;
    var end=-1;
    for(k=a+1;k<candles.length;k++){ if(candles[k].c<sw[i].p){ end=k; break } }
    if(end<0) holding++; else holds.push(end-a);
  }
  holds.sort(function(x,y){ return x-y });
  return {n:holds.length, holding:holding, holds:holds, mid:midOf(holds),
          lo:holds.length?holds[0]:null, hi:holds.length?holds[holds.length-1]:null};
}
/* 4. THE WINDOW. Each day on HIS clock (the clock on the device this page is
   open on, the same one the session block reads), the whole range the day made
   and the range that was made inside his session window. A day with no bars in
   the window contributes its full range and zero inside it — that is a real
   answer, and it is why the share can come out low. */
function windowStudy(candles){
  if(inWindow(0, SESS)===null) return {ok:false, days:0};
  var days={}, order=[], i;
  for(i=0;i<candles.length;i++){
    var d=new Date(candles[i].t);
    var key=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
    if(!days[key]){ days[key]={hi:null,lo:null,inHi:null,inLo:null,in:0,n:0}; order.push(key) }
    var g=days[key], b=candles[i];
    if(g.hi===null||b.h>g.hi) g.hi=b.h;
    if(g.lo===null||b.l<g.lo) g.lo=b.l;
    g.n++;
    if(inWindow(localMins(b.t), SESS)){
      g.in++;
      if(g.inHi===null||b.h>g.inHi) g.inHi=b.h;
      if(g.inLo===null||b.l<g.inLo) g.inLo=b.l;
    }
  }
  var total=0, inside=0, hiIn=0, loIn=0, used=0;
  for(i=0;i<order.length;i++){
    var day=days[order[i]];
    if(!day.n||day.hi===null||day.lo===null||day.hi===day.lo) continue;
    used++;
    total+=(day.hi-day.lo);
    inside+=(day.in?Math.max(0,day.inHi-day.inLo):0);
    if(day.in&&day.inHi!==null&&day.inHi>=day.hi) hiIn++;
    if(day.in&&day.inLo!==null&&day.inLo<=day.lo) loIn++;
  }
  return {ok:true, days:used, share:(total>0?inside/total:null), hi:hiIn, lo:loIn,
          from:candles.length?candles[0].t:null, to:candles.length?candles[candles.length-1].t:null};
}
/* The four, worked out once, so the page and the assistant cannot be handed
   different arithmetic. A timeframe that came back with too few bars to carry a
   swing is counted as nothing rather than as a result. */
function studyFacts(){
  var b4=studyBars('4h'), b15=studyBars('15m');
  var enough=function(b){ return !!(b&&b.length>=WING*2+3) };
  return {
    b4:b4, b15:b15,
    poke:enough(b4)?pokeStudy(b4):null,
    retrace:enough(b4)?retraceStudy(b4):null,
    hold:enough(b15)?holdStudy(b15):null,
    window:enough(b15)?windowStudy(b15):null
  };
}

/* The study, on the page. Labelled lines, the same shape as the structure block
   above, and every row carries the count it came from. */
function paintStudy(){
  var out=document.getElementById('studyOut');
  if(!out) return;
  if(!STUDY||!STUDY.ok||!STUDY.timeframes){ out.innerHTML=''; return }
  var f=studyFacts(), h='';
  h+='<div class="stcard"><div class="sthd"><b>4h</b><span class="sttrend">At your levels</span></div>';
  if(!f.b4){
    h+=stRow('Bars','no 4h bars came back for the study');
  }else{
    h+='<div class="stsw">'+f.b4.length+' bars, '+esc(dayText(f.b4[0].t))+' to '+esc(dayText(f.b4[f.b4.length-1].t))+'</div>';
    var p=f.poke;
    if(!p||!p.pokes){
      h+=stRow('Traded above','no swing high in these bars was traded above — nothing to count');
    }else{
      h+=stRow('Traded above','<b>'+p.pokes+'</b> swing highs in these bars');
      h+=stRow('Then closed above','<b>'+p.closed+'</b> of '+p.pokes+' — the frame changed on those');
      h+=stRow('Poke only','<b>'+p.failed+'</b> of '+p.pokes+' never closed above — the grab');
      if(p.deep!==null) h+=stRow('Deepest poke','went <b>'+esc(money(p.deep))+'</b> past the level and came back');
    }
    var r=f.retrace;
    if(!r||!r.n){
      h+=stRow('Down legs','no down leg with a swing high and a swing low came back in these bars');
    }else{
      h+=stRow('Down legs','<b>'+r.n+'</b>'+(r.live?(' &middot; '+r.live+' still live, the low not taken yet'):''));
      h+=stRow('Back to the level','<b>'+r.whole+'</b> of '+r.n+' came all the way back to the high that started them');
      h+=stRow('Two thirds','<b>'+r.twoThirds+'</b> of '+r.n+' got at least two thirds of the way back');
      h+=stRow('Barely at all','<b>'+r.under+'</b> of '+r.n+' never got past a third'
        +(r.none?(' — '+r.none+' had no retrace before the low went'):''));
      if(r.mid!==null) h+=stRow('Middle','the middle leg came back <b>'+Math.round(r.mid*100)+'%</b> of itself');
    }
  }
  h+='<div class="feedwhy">A swing high counts as poked when a later bar trades above it, and as closed above when a bar crosses it on the close within the next '
    +POKE_LOOK+' bars — your own rule: a wick is not a break, a close is. A down leg is a swing high followed by the next swing low, so coming back to the high that started it is 100% of that leg.</div></div>';
  h+='<div class="stcard"><div class="sthd"><b>15m</b><span class="sttrend">The hold, and your clock</span></div>';
  if(!f.b15){
    h+=stRow('Bars','no 15m bars came back for the study');
  }else{
    h+='<div class="stsw">'+f.b15.length+' bars, '+esc(dayText(f.b15[0].t))+' to '+esc(dayText(f.b15[f.b15.length-1].t))+'</div>';
    var ho=f.hold;
    if(!ho||(!ho.n&&!ho.holding)){
      h+=stRow('Higher lows','no higher low came back in these bars');
    }else if(!ho.n){
      h+=stRow('Higher lows','<b>'+ho.holding+'</b> still holding when the bars ran out — none failed in these bars');
    }else{
      h+=stRow('Higher lows','<b>'+ho.n+'</b> of them failed in these bars'
        +(ho.holding?(', and '+ho.holding+' '+(ho.holding===1?'is':'are')+' still holding so far'):''));
      h+=stRow('Middle hold','<b>'+ho.mid+'</b> bars &middot; '+esc(fmtMins(ho.mid*15))+' on the 15m');
      h+=stRow('Shortest / longest','<b>'+ho.lo+'</b> bars and <b>'+ho.hi+'</b> bars');
    }
    var w=f.window;
    if(!w||!w.ok){
      h+=stRow('Your window','no session window is set, so there is nothing to count inside');
    }else if(!w.days){
      h+=stRow('Days','no full day of bars came back for this');
    }else{
      h+=stRow('Days','<b>'+w.days+'</b> days on your clock, '+esc(dayText(w.from))+' to '+esc(dayText(w.to)));
      h+=stRow('In your window','<b>'+Math.round(w.share*100)+'%</b> of the whole range over those days was made inside '+esc(hhmmText(hhmm(SESS.a)))+'&ndash;'+esc(hhmmText(hhmm(SESS.b))));
      h+=stRow('Day&rsquo;s high','made inside your window on <b>'+w.hi+'</b> of '+w.days+' days');
      h+=stRow('Day&rsquo;s low','made inside your window on <b>'+w.lo+'</b> of '+w.days+' days');
    }
  }
  h+='<div class="feedwhy">A hold is measured on the 15m only, from a higher low to the first bar that closes below it. The days are days on your own clock, the same clock as the session block above.</div></div>';
  out.innerHTML=h;
}

async function loadStudy(){
  var symEl=document.getElementById('fSym'), go=document.getElementById('studyGo');
  var sym=((symEl&&symEl.value)||'').trim()||'NQ';
  if(go) go.disabled=true;
  studyMsg('Loading '+sym.toUpperCase()+' to study…', false);
  try{
    var r=await fetch('/api/candles?bars='+STUDY_BARS+'&symbol='+encodeURIComponent(sym),{credentials:'same-origin'});
    if(r.status===401){ studyMsg('Sign in again and the study bars will load.', true); return }
    if(r.status===429){ studyMsg('The feed is being asked too often. Give it a moment.', true); return }
    var d=null;
    try{ d=await r.json() }catch(e){ d=null }
    if(!d||!d.ok){
      STUDY=null; paintStudy();
      studyMsg((d&&d.error)||'The feed did not answer, so there is nothing to study.', true);
      return;
    }
    STUDY=d;
    paintStudy();
    var b4=studyBars('4h'), b15=studyBars('15m');
    studyMsg('Studied '
      +(b4?(b4.length+' bars of 4h, '+dayText(b4[0].t)+' to '+dayText(b4[b4.length-1].t)):'no 4h bars')
      +(b15?(', and '+b15.length+' bars of 15m'):', and no 15m bars')+'.', false);
  }catch(e){
    STUDY=null; paintStudy();
    studyMsg('The feed could not be reached, so nothing was studied. Nothing was made up in its place.', true);
  }finally{
    if(go) go.disabled=false;
  }
}

/* The same four counts, in the assistant's instructions, with the rules that
   keep them from turning into a promise. */
function studyText(){
  var head=['HIS TIMING STUDY — counts this page worked out itself, from bars the study loaded. It is counting on real bars and it is NOT a backtest: none of his setups was entered, exited or priced, so there is no result, no profit, no win rate and no edge anywhere in it.'];
  if(!(STUDY&&STUDY.ok&&STUDY.timeframes)){
    head.push('');
    head.push('NOT LOADED. He has not pressed Load bars to study, so there is nothing here and nothing to quote. If he asks about the study, say in one line that the bars have to be loaded first. Do not describe a study, do not invent a count, and never say what his bars usually do.');
    head.push('');
    return head.join('\n');
  }
  var f=studyFacts();
  head.push('');
  head.push('Every figure below is printed with the count it came from. Keep the two welded together, and say plainly when a count is small — a handful of legs or holds is a handful.');
  head.push('');
  head.push('THE BARS IT COUNTED ARE ITS OWN. The study pulled more bars than the CANDLES block above, so a count here is about that longer window and the dates in it, not about the bars in the CANDLES block. Say which window a count came from when you repeat it, and never mix the two together.');
  head.push('');
  if(f.poke&&f.poke.pokes){
    head.push('THE POKE (4h, '+f.b4.length+' bars, '+dayText(f.b4[0].t)+' to '+dayText(f.b4[f.b4.length-1].t)+'): price traded above a swing high '+f.poke.pokes+' times. It CLOSED above the level within the next '+POKE_LOOK+' bars on '+f.poke.closed+' of those '+f.poke.pokes+' — the frame changed on those — and on '+f.poke.failed+' of '+f.poke.pokes+' it never closed above, which is the poke and nothing else'
      +(f.poke.deep!==null?('. The deepest of those went '+two(f.poke.deep)+' points past the level before coming back, which is the distance a stop has to sit outside of'):'')+'.');
  }else{
    head.push('THE POKE (4h): no swing high in these bars was traded above, so there is nothing to quote here. Say that rather than reaching for an example.');
  }
  if(f.retrace&&f.retrace.n){
    head.push('THE RETRACE (4h): '+f.retrace.n+' down legs in these bars'
      +(f.retrace.live?(', '+f.retrace.live+' of them still live because the low has not gone yet'):'')+'. '
      +f.retrace.whole+' of '+f.retrace.n+' came all the way back to the swing high that started them, '+f.retrace.twoThirds+' of '+f.retrace.n+' got at least two thirds of the way back, and '+f.retrace.under+' of '+f.retrace.n+' never got past a third'
      +(f.retrace.none?(', of which '+f.retrace.none+' had no retrace at all before the low went'):'')+'.'
      +(f.retrace.mid!==null?(' The middle leg came back '+Math.round(f.retrace.mid*100)+'% of itself.'):''));
  }else{
    head.push('THE RETRACE (4h): no down leg came back in these bars, so there is nothing to quote. Say that.');
  }
  if(f.hold&&(f.hold.n||f.hold.holding)){
    head.push('THE HOLD (15m): '+(f.hold.n
      ? (f.hold.n+(f.hold.n===1?' higher low failed in these bars, ':' higher lows failed in these bars, ')+'the middle one lasting '+f.hold.mid+' bars of 15 minutes ('+fmtMins(f.hold.mid*15)+'), the shortest '+f.hold.lo+' bars and the longest '+f.hold.hi+' bars'+(f.hold.holding?(', with '+f.hold.holding+' still holding so far'):''))
      : ('no higher low failed in these bars, and '+f.hold.holding+' were still holding when the bars ran out'))+'.');
  }else{
    head.push('THE HOLD (15m): the bars that came back have no higher low in them, so there is nothing to quote. Say that.');
  }
  if(f.window&&f.window.ok&&f.window.days){
    head.push('THE WINDOW (15m, on his own clock): over '+f.window.days+' days, '+Math.round(f.window.share*100)+'% of the whole range those days made was inside his session window. The high of the day was made inside the window on '+f.window.hi+' of those '+f.window.days+' days, and the low of the day on '+f.window.lo+' of '+f.window.days+'.');
  }else if(f.window&&!f.window.ok){
    head.push('THE WINDOW: he has no usable session window set, so nothing was counted inside one. Say that.');
  }else{
    head.push('THE WINDOW: no full day of bars came back for it, so there is nothing to quote.');
  }
  head.push('');
  head.push('WHAT THIS CANNOT SAY: it is one loaded window of bars and a small sample — one count of four is not a pattern, and three months of 4h bars is not a market. It says what his own rules did in these bars, and nothing about what happens next. Never turn a count into a percentage on its own, never average two of them together, never carry one onto a timeframe it did not come from, and never call any of it an edge.');
  head.push('');
  return head.join('\n');
}

/* The rules for the one chip that reads the study. Same house rules, plus the
   one that matters here: counts stay counts, and it ends in one change. */
var STUDY_SYS=[
  'HE IS ASKING YOU TO READ THE TIMING STUDY, WHICH IS ALREADY IN YOUR INSTRUCTIONS.',
  '',
  'Use only the counts in the STUDY block. Every one of them came from bars that loaded, and every one is printed with the count it came from — keep the figure and its count welded together, and never turn one figure into a probability.',
  '',
  'WHEN A COUNT IS SMALL, SAY SO IN THE SAME SENTENCE. Four legs, six pokes and a handful of holds are a handful: the honest read of a small count is that it is small, and that is a complete answer.',
  '',
  'NEVER: call the study a backtest, a test you ran, a win rate, an edge or a proof; say a level "usually" holds because of a count this size; promise an outcome; or tell him the study says what the next trade will do.',
  '',
  'END WITH ONE CHANGE, and name the count it came from: the single thing his own bars say to do differently about timing — the moment he enters, the level he waits for, or how long he gives a hold before he calls it failed. One change, something he can do on the next trade.',
  '',
  'House rules otherwise unchanged: where he is wrong comes first, and plain English.'
].join('\n');
