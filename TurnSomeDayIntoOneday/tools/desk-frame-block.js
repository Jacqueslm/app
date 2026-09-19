/* ---------- the frame, read off this page's own candles -------------------- */
/* Jacques, 19 Sep 2026: "build the desk reading its own chart".

   The script on his chart (Someday) reads a frame, and he has to carry that read
   to the assistant himself. This is the same read, worked out here, on the same
   feed bars - so the assistant knows the frame on its own, and so his chart and
   this page can be held against each other instead of being taken on trust.

   His rules, as numbers:
     - a new LOWER LOW on the frame turns the frame down. The level is the swing
       high the drop came from; the frame low is that lower low.
     - only a CLOSE above the level cancels the frame. A poke above the level
       that never closed changes nothing, which is his own rule and the one that
       has been costing him.
     - the small chart is the step below the frame, read for higher highs with
       the last higher low still holding. A close under that low ends the hold.
     - then: short at the level, long scalp when the small chart turns up,
       otherwise wait.

   Three things are deliberate here:
   1. It is a READ, never a prediction. Every number is off bars that came back.
   2. A cancelled frame is DROPPED. A level from hours ago sitting next to a live
      price reads as nonsense - his own complaint about the box on his chart - so
      a cancelled frame shows no price at all until a fresh lower low sets the
      next one.
   3. It says which timeframe it read, which bar it read the close off, and how
      many swings the frame gave it, so an empty read explains itself rather
      than looking like the market's answer. */
var K_FRAME='tsid.desk.frame', FRAME_TFS=['15m','1h','4h'];
var FRAMETF=(function(){ var v=load(K_FRAME,null); return FRAME_TFS.indexOf(v)>=0?v:'1h' })();
var FRAME_LEN=2, SMALL_LEN=3;

/* The small chart is the step below the frame, so the same bars are never read
   twice as though they were two different things. */
function smallTfFor(){
  return FRAMETF==='15m' ? '5m' : '15m';
}
function frameBars(tf){
  var d=(FEED&&FEED.ok&&FEED.timeframes)?FEED.timeframes[tf]:null;
  return (d&&d.candles)?d.candles:[];
}
/* Is the small chart turning up? The last swing high above the one before it,
   AND the last higher low still holding on a CLOSE - a wick under it does not
   end the hold. The same two things the script on his chart asks for. */
function smallChart(bars){
  var out={ok:false, high:null, prevHigh:null, hold:null, close:null, up:false};
  if(!bars||bars.length<SMALL_LEN*2+3) return out;
  var sw=structure(bars, SMALL_LEN).swings, i;
  var hi=null, prevHi=null, hold=null, prevLo=null;
  for(i=0;i<sw.length;i++){
    if(sw[i].kind==='H'){ prevHi=hi; hi=sw[i].p }
    else { if(prevLo!==null && sw[i].p>prevLo) hold=sw[i].p; prevLo=sw[i].p }
  }
  out.ok=true; out.high=hi; out.prevHigh=prevHi; out.hold=hold;
  out.close=bars[bars.length-1].c;
  out.up=(prevHi!==null && hi!==null && hi>prevHi && hold!==null && out.close>hold);
  return out;
}
/* The frame, worked out on the bars that came back. It returns the read and the
   sentence that goes with it, and it never fills a number in. */
function frameRead(){
  var r={tf:FRAMETF, smallTf:smallTfFor(), ok:false, why:'no candles came back',
         bars:0, swings:0, highs:0, lows:0, level:null, low:null,
         levelBar:null, lowBar:null, close:null, closedAt:null,
         state:'no frame yet', verdict:'wait', lowerLow:false, atLevel:false,
         underLow:false, changed:false, up:false, cancelAgo:null, cancelLive:false};
  if(!FEED||!FEED.ok||!FEED.timeframes) return r;
  var bars=frameBars(FRAMETF), i, j;
  r.bars=bars.length;
  if(bars.length<FRAME_LEN*2+3){
    r.why='not enough '+FRAMETF+' bars came back to read a swing off';
    return r;
  }
  r.ok=true;
  var sw=structure(bars, FRAME_LEN).swings;
  for(i=0;i<sw.length;i++){ if(sw[i].kind==='H') r.highs++; else r.lows++ }
  r.swings=sw.length;
  var last=bars[bars.length-1];
  r.close=last.c;
  r.closedAt=last.t;
  /* The most recent lower low: the newest swing low that sits under the low
     before it. No lower low in the bars means no frame, and the page says so
     rather than dressing the run above it up as one. */
  var lowIdx=-1, prevLow=-1;
  for(i=sw.length-1;i>=0;i--){
    if(sw[i].kind!=='L') continue;
    prevLow=-1;
    for(j=i-1;j>=0;j--){ if(sw[j].kind==='L'){ prevLow=j; break } }
    if(prevLow>=0 && sw[i].p<sw[prevLow].p){ lowIdx=i; break }
  }
  if(lowIdx<0){ r.why='no lower low on '+FRAMETF+' in the bars that came back'; return r }
  var lvlIdx=-1;
  for(j=lowIdx-1;j>=0;j--){ if(sw[j].kind==='H'){ lvlIdx=j; break } }
  if(lvlIdx<0){ r.why='the '+FRAMETF+' lower low has no swing high before it to set a level'; return r }
  r.level=sw[lvlIdx].p; r.low=sw[lowIdx].p; r.lowerLow=true;
  r.levelBar=sw[lvlIdx].t; r.lowBar=sw[lowIdx].t;
  /* A close above the level cancels the frame, and it is the bar's own close off
     the feed - a poke above the level with no close above it cancels nothing,
     which is the rule he wrote himself. */
  var cancelAt=-1;
  for(i=0;i<bars.length;i++){
    if(bars[i].t<=r.lowBar) continue;
    if(bars[i].c>r.level){ cancelAt=i; break }
  }
  if(cancelAt>=0){
    r.changed=true; r.level=null; r.low=null;
    r.state='frame changed'; r.verdict='wait - the frame changed';
    r.cancelAgo=bars.length-1-cancelAt;
    r.cancelLive=(cancelAt===bars.length-1);
    r.why='the frame closed above its level';
    return r;
  }
  r.underLow=(last.c<r.low);
  r.atLevel=!r.underLow && last.h>=r.level;
  r.state=r.underLow ? 'under the low' : (r.atLevel ? 'level in play' : 'retracing');
  r.up=smallChart(frameBars(r.smallTf)).up;
  r.verdict=r.atLevel ? 'short' : ((r.state==='retracing'&&r.up) ? 'long scalp' : 'wait');
  return r;
}

function paintFrameTf(){
  for(var i=0;i<FRAME_TFS.length;i++){
    var el=document.getElementById('ftf-'+FRAME_TFS[i]);
    if(!el||!el.classList) continue;
    if(FRAME_TFS[i]===FRAMETF) el.classList.add('on'); else el.classList.remove('on');
  }
}
function setFrameTf(tf){
  if(FRAME_TFS.indexOf(tf)<0) return;
  FRAMETF=tf;
  save(K_FRAME,tf);
  paintFrameTf();
  paintFrame();
}
/* Painted from the same function the assistant is handed, so the box on the page
   and the block in the instructions cannot say different things about the same
   bars. */
function paintFrame(){
  var out=document.getElementById('frOut'), when=document.getElementById('frWhen');
  if(!out) return;
  if(!FEED||!FEED.ok||!FEED.timeframes){
    out.innerHTML='';
    if(when) when.textContent='No candles loaded, so there is no frame to read. Load them on the feed above.';
    return;
  }
  var r=frameRead();
  var h='<div class="stcard">'
    +'<div class="sthd"><b>'+esc(r.tf)+'</b><span class="sttrend">'+esc(r.verdict)+'</span></div>'
    +stRow('State', esc(r.state))
    +stRow('The level', r.level===null ? 'none shown' : ('<b>'+esc(money(r.level))+'</b>'))
    +stRow('The frame low', r.low===null ? 'none shown' : ('<b>'+esc(money(r.low))+'</b>'))
    +stRow('Lower low made', r.lowerLow ? 'yes' : 'no')
    +stRow('At the level / working back', (r.atLevel||r.state==='retracing') ? 'yes' : 'no')
    +stRow('Small chart ('+esc(r.smallTf)+') turned up', r.up ? 'yes' : 'no')
    +stRow('Close above the level', r.changed ? 'yes' : 'no')
    +stRow('Swings the frame gave', esc(r.highs+' high / '+r.lows+' low'))
    +'</div>';
  if(!r.ok) h+='<div class="stflag">Nothing to read: '+esc(r.why)+'.</div>';
  out.innerHTML=h;
  if(!when) return;
  /* Nothing to read and nothing to do are two different things: a frame with no
     lower low in it is a real read of a market that has not made the pattern,
     while !ok is the bars not coming back at all. Both say which one it is
     rather than leaving a blank where an answer goes. */
  if(!r.lowerLow){
    when.textContent='No frame read: '+r.why+'.';
    return;
  }
  if(r.changed){
    when.textContent='The frame was closed above its level '
      +(r.cancelAgo===0 ? 'on the last bar that came back' : r.cancelAgo+(r.cancelAgo===1?' bar ago':' bars ago'))
      +', so no level is shown. A fresh lower low sets the next one.'
      +(r.cancelLive ? ' That last bar may not have finished closing yet.' : '');
    return;
  }
  when.textContent='Read off the '+r.tf+' bars that came back, the last of them opening '+utcStamp(r.closedAt)
    +'. The same rules the script on your chart runs, on this page\'s own candles.';
}

/* The block the assistant reads. Same rules, and the same rule about what it may
   never become: the verdict is one of three answers, and "wait" is a complete
   one. */
function frameText(){
  var head=['THE FRAME - his own rules, worked out on this page from the candle block below, and from nothing else. IT IS THE SAME READ THE SCRIPT ON HIS CHART RUNS, on the same bars, so the two can be held against each other.','',
    'How it is worked out, so any line can be checked: a frame is down when the frame\'s own bars make a LOWER LOW. The level is the swing high the drop came from - the lower high he would short back to - and the frame low is that lower low. Only a CLOSE above the level cancels the frame; a poke above it cancels nothing. The small chart is the step below the frame, read on its own bars for higher highs with the last higher low still holding, and a close under that low ends the hold. Then: short at the level, long scalp while the small chart is turned up, otherwise wait.',''];
  if(!FEED||!FEED.ok||!FEED.timeframes){
    head.push('NOT READ - no candles are loaded, so there is no frame. Say you cannot read the frame without candles: do not describe one, do not name a level, and do not guess where the last lower low is.','');
    return head.join('\n');
  }
  var r=frameRead();
  head.push('Frame: '+r.tf+'. Small chart: '+r.smallTf+'.');
  head.push('State: '+r.state+'.');
  if(r.level!==null){
    head.push('The level: '+money(r.level)+'. The frame low: '+money(r.low)+'.');
  }else{
    head.push('NO LEVEL IS SHOWN, and that is deliberate: '+(r.changed
      ? 'the frame closed above its level, so it is cancelled and its prices are dropped rather than left standing next to a live price'
      : r.why)+'. Do not supply one.');
  }
  head.push('Lower low made: '+(r.lowerLow?'yes':'no')+'. At the level or working back: '+((r.atLevel||r.state==='retracing')?'yes':'no')+'. Small chart turned up: '+(r.up?'yes':'no')+'. Close above the level: '+(r.changed?'yes':'no')+'.');
  head.push('Swings the frame gave it: '+r.highs+' highs and '+r.lows+' lows'+(r.swings?'':', so an empty read here is the bars and not the market')+'.');
  head.push('Verdict, by his own rules: '+r.verdict+'.');
  if(r.cancelAgo!==null) head.push('The frame was cancelled '+(r.cancelAgo===0?'on the last bar that came back':r.cancelAgo+(r.cancelAgo===1?' bar before it':' bars before it'))+(r.cancelLive?' - and a bar that has not finished closing can still change.':'.'));
  if(r.closedAt!==null) head.push('The last bar it read the close off opens '+utcStamp(r.closedAt)+'.');
  head.push('');
  head.push('WHAT THIS IS AND IS NOT: it is his own rules as arithmetic on bars that came back. The verdict is one of wait, short or long scalp and nothing else. Wait is the answer most of the time and it is a complete answer - never apologise for it or pad it into a maybe. Never turn the verdict into a promise, a probability or a target, never supply a level when this block shows none, and where he is wrong still comes first.');
  head.push('');
  return head.join('\n');
}
