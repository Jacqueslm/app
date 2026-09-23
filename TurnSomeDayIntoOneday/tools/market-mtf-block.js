/* The blocks that tools/apply-market-mtf.js writes into market-maker.html.
   Nothing here runs on its own — the apply script pulls each one out by name
   and splices it into the page. Same shape as tools/market-q-block.js.

   Why a script and not an editor: market-maker.html is 756KB, most of it the
   real tape packed in as JSON, and the file tools cannot reach past that line.
   The page is patched by script, which is how every change to it has been made.

   Jacques, 23 Sep 2026, both halves of this in one message:

     "it counts wicks as breaks when i see wicks as close a wick break close
      back in the leg or zone it thats ok"

     "i want to be able to switch a time frame say a daily get a bias then zoom
      down on timeframes to make a decision because i need to improve stops and
      targets it to make me better through repetition and mechanical without
      being emotional"

   So two things change and nothing else does. The break rule now needs the
   close, and a wick that closes back is a raid that moves nothing. And the
   frame you execute on can be changed inside an operation, on the same tape and
   the same clock, with the frame above it stating its bias.
*/

//===BLOCK:labels
  // A turn only earns its word if the CLOSE went through the previous turn.
  // Wick above the last high and close back under it and nothing has broken —
  // that is a raid, and the stops above the high were the whole reason for the
  // poke. Jacques, 23 Sep 2026: "it counts wicks as breaks when i see wicks as
  // close a wick break close back in the leg or zone it thats ok". The four
  // words need the close now, not just the wick:
  //   HH  a new high with the close above the previous high   — a real break
  //   SH  a new high with the close back under it             — a raid, no change
  // and the mirror for lows. SH and SL are still turns, still drawn, still
  // where the stops are sitting — they just do not move the trend on their own.
  // It is the turn's own bar that decides, so the same bars always give the
  // same answer: this is a read, not a judgement call.
  for(var i=2;i<seq.length;i++){
    var prev=seq[i-2], tb=bars[seq[i].i];
    if(seq[i].t==='H') seq[i].lab = seq[i].p>prev.p ? (tb.c>prev.p?'HH':'SH') : 'LH';
    else               seq[i].lab = seq[i].p<prev.p ? (tb.c<prev.p?'LL':'SL') : 'HL';
  }
  var sweeps=seq.filter(function(p){return p.lab==='SH'||p.lab==='SL'});
//===BLOCK:returnfields
  return {seq:seq,lastH:lastH,lastL:lastL,trend:trend,legFrom:legFrom,legDir:legDir,
          sweeps:sweeps,lastSweep:sweeps[sweeps.length-1]||null,
          inner:inner,innerUp:innerUp,innerDown:innerDown,
          lowStep:lowStep,highStep:highStep,innerDir:innerDir,innerCoil:innerCoil,innerExpand:innerExpand,
          last:ev[ev.length-1]||null,events:ev};
//===BLOCK:reads
/* ── the raid ───────────────────────────────────────────────────────────────
   The read the wick rule makes possible. A previous version of this page
   counted a wick through a level as a break of structure, which is what he
   said was wrong: the wick goes through, the close comes back inside, and
   nothing about the structure has changed. That shape is a raid, and it points
   the other way. The answer mirrors with the direction of the sweep, so it can
   never be guessed off the shape of the question. */
function qRaid(st){
  var sw=st.lastSweep;
  if(!sw || sw.i < Gm.i-14) return null;
  var low=sw.lab==='SL';
  return {kind:"raid", a: low?0:1,
    q:"The last turn was a wick: price went "+(low?"below the last low":"above the last high")+
      " and closed back "+(low?"above":"under")+" it. Nothing about the structure changed. "+
      "Which way does that shape point?",
    o:["Up — the low was taken and handed back, so the stops under it were the fuel",
       "Down — the high was taken and handed back, so the stops over it were the fuel",
       "Nowhere — a wick that closes back says nothing at all"],
    w: low
      ? "A low taken and closed back above is a failed break, and the fill that came with it was the point of the move. The stop belongs under the wick, not under the old low, and the trade points up."
      : "A high taken and closed back under is a failed break, and the fill that came with it was the point of the move. The stop belongs over the wick, not over the old high, and the trade points down."};
}

/* ── the bridge ─────────────────────────────────────────────────────────────
   The higher frame, and whether the frame he is executing on agrees with it.
   Jacques asked for exactly this on 23 Sep 2026: get a bias on the day, zoom
   down, and make the decision mechanically off what is on the tape.

   The bias is structure() run on the same hours grouped bigger on the real
   clock, so the two frames are made of one tape and cannot disagree about what
   the market did. It declines when either frame has nothing to say, the same
   way every other read does. */
function qBridge(){
  var bt=bridgeTrend(); if(!bt || bt.trend==="range") return null;
  var st=stNow(); if(!st) return null;
  var up = bt.trend==="up";
  return {kind:"bridge", a: st.trend==="range" ? 2 : ((up?st.trend==="up":st.trend==="down") ? 0 : 1),
    q:"The "+(Gm&&Gm.tf?Gm.tf.bn:"higher")+" bridge reads "+bt.word+
      ". Read against it, is the "+(Gm&&Gm.tf?Gm.tf.n:"bar")+" you are executing stepping the same way?",
    o:["Yes — the bar below is stepping the same way as the bridge",
       "No — the bar below has already turned against the bridge",
       "The bar below has no trend to compare — its turns overlap"],
    w:"The bridge is the bias and the bar below is the entry. When they agree you are trading with the bigger money. When the smaller one turns first the bridge is the one about to be wrong — but that trade has the room against it, so it is the one that needs the read to be sharp. The outside is what already happened and it always looks tidy afterwards; the smaller frame is how it is arriving."};
}
//===BLOCK:rotation
  var kinds=["level","inner","event","raid","agree","bridge"];
//===BLOCK:dstructlabel
    // A swept turn is drawn as a sweep, not as a break. It is still a turn and
    // the stops still sit behind it; it just did not move the structure, and
    // the page says so in the same breath as the four words.
    var swept = pt.lab==="SH"||pt.lab==="SL";
    x.fillStyle = swept ? "rgba(255,197,61,.95)"
      : (pt.lab==="HH"||pt.lab==="HL") ? "rgba(46,230,160,.95)" : "rgba(255,92,108,.95)";
    x.fillText(swept?"SWEPT":pt.lab,cx,Y(pt.p)+(hi?-9:16));
    if(swept){
      x.strokeStyle=x.fillStyle; x.lineWidth=1.2;
      x.beginPath(); x.moveTo(cx,Y(pt.p)); x.lineTo(cx,Y(pt.p)+(hi?-7:7)); x.stroke();
    }
//===BLOCK:raidmark
  // The raid, named where it happened, in the words he uses for it.
  if(st.lastSweep && st.lastSweep.i>=start){
    var sw=st.lastSweep, swx=X(sw.i);
    if(swx<=R-6){
      x.fillStyle="rgba(255,197,61,.95)"; x.font="700 9.5px JetBrains Mono, monospace";
      x.textAlign="center";
      x.fillText("WICK THROUGH, CLOSED BACK",swx,Y(sw.p)+(sw.lab==="SL"?28:-28));
    }
  }
//===BLOCK:bridge
/* ═══════════════════════════════════════════════════════════════════
   THE BRIDGE, AND THE FRAME YOU EXECUTE ON — 23 Sep 2026.

   The bridge is the same hours he is trading, grouped bigger on the real
   clock. Its bias is structure() run on those bars — the same swings, the
   same four words, the same close-not-wick rule — so the two frames cannot
   disagree about what the tape did, only about what is happening now.

   And the frame he executes on can be changed in the middle of an operation.
   Same tape, same moment: the bars are only grouped bigger or smaller, which
   is what makes the day's bias and the entry one chart instead of two. An open
   position is a price, so it survives the change untouched — what changes is
   how big a bar has to be to reach the stop.
   ═══════════════════════════════════════════════════════════════════ */
function bridgeBars(){
  if(!Gm||!Gm.bars||!Gm.bars.length) return [];
  return rollAny(Gm.bars.slice(0,Gm.i+1), Gm.tf?Gm.tf.bh:TFS[0].bh);
}
function bridgeTrend(){
  var g=bridgeBars();
  if(g.length<10 || !g[0].t) return null;   // no clock: there is no honest bridge
  var st=structure(g,g.length-1);
  return {trend:st.trend, word:st.trend.toUpperCase(), sweep:st.lastSweep, bars:g};
}
function paintBias(){
  var bc=$("bcap"), w=$("biasWord");
  var bt = Gm ? bridgeTrend() : null;
  if(w){
    w.textContent = bt ? bt.word : "—";
    w.style.color = !bt ? "var(--dim)"
      : bt.trend==="up" ? "var(--up)" : bt.trend==="down" ? "var(--down)" : "var(--dim)";
  }
  if(bc) bc.innerHTML = Gm
    ? (Gm.tf?Gm.tf.bn:"")+" — the bridge <em>bias "+
      (bt ? (bt.trend==="range"?"sideways":bt.trend) : "unreadable")+
      " · the entry is the "+(Gm.tf?Gm.tf.n:"bar")+" below</em>"
    : "the bridge <em>the frame above the one you execute on</em>";
}

// Same bars, grouped bigger. On the real tape this is done on the clock, so a
// 4H bar is four real hours. A generated market has no clock at all, so there
// the only honest thing is to count the bars in and say so.
function rollAny(hourly,hours){
  if(hours<=1) return hourly.slice();
  if(hourly.length && !hourly[0].t){
    var step=Math.max(1,Math.round(hours)), out=[];
    for(var i=0;i<hourly.length;i+=step){
      var g=hourly.slice(i,i+step); if(!g.length) continue;
      var hi=g[0].h, lo=g[0].l;
      g.forEach(function(b){ if(b.h>hi)hi=b.h; if(b.l<lo)lo=b.l });
      out.push({o:g[0].o,h:hi,l:lo,c:g[g.length-1].c});
    }
    return out;
  }
  return roll(hourly,hours);
}
function windowBarsTf(w,ti){
  var tf=TFS[Math.max(0,Math.min(TFS.length-1,ti))];
  var b=roll(reel(w.r).slice(w.o, w.o+TAPE.n*tf.h), tf.h);
  return b.length>TAPE.n ? b.slice(0,TAPE.n) : b;
}
// The bar the clock is standing on, in the new grouping. This is what keeps a
// switch honest: the moment does not move, only the size of the bar carrying it.
function indexAtClock(bars,t,fallback){
  if(t==null || !bars.length || !bars[0].t) return fallback;
  for(var i=bars.length-1;i>=0;i--) if(bars[i].t<=t) return i;
  return 0;
}
function tfIndexOf(){
  if(!Gm||!Gm.tf) return (G.tf||0);
  var i=TFS.indexOf(Gm.tf); return i<0 ? (G.tf||0) : i;
}
function execTf(i){
  if(!Gm||Gm.over) return;
  i=Math.max(0,Math.min(TFS.length-1,i));
  if(i===tfIndexOf()) return;
  var want=TFS[i], cur=Gm.tf?Gm.tf.h:1;
  var curT=(Gm.bars[Gm.i]||{}).t, fallback=Math.round(Gm.i*cur/want.h);
  var bars, ni;
  if(Gm.win){ bars=windowBarsTf(Gm.win,i); ni=indexAtClock(bars,curT,fallback) }
  else { bars=rollAny(Gm.bars,want.h/cur); ni=fallback }
  if(!bars || bars.length<8){ say("Not enough tape at that size."); return }
  if(ni<5) ni=5;
  if(ni>bars.length-3) ni=Math.max(5,bars.length-3);
  // The clock is kept, so what is left of the session is the same amount of
  // time rather than the same number of bars.
  var leftHours=(Gm.left||0)*cur, roundHours=(Gm.roundLen||0)*cur;
  Gm.bars=bars; Gm.i=ni; Gm.tf=want;
  Gm.left=Math.max(4,Math.round(leftHours/want.h));
  Gm.roundLen=Math.max(4,Math.round(roundHours/want.h));
  Gm.st=null; Gm.stAt=-1; Gm.gate=null;
  var bt=bridgeTrend();
  say((want.h>cur?"Zoomed out":"Zoomed in")+" to "+want.n+" — same tape, same clock. Bridge bias: "+
      (bt?bt.word:"unreadable")+". Your stop and target are prices and they have not moved.");
  paintHud(); paintDuel(); drawChart(); gateAsk();
}
// The dial is built here rather than written into the page, in the order it has
// to read: the word EXECUTION, the three frames, then the bias above them. One
// place builds it, so the order cannot drift from the markup.
function buildTfSwitch(){
  var box=$("tfswitch"); if(!box) return;
  if(box.querySelector('button')) return;
  var cap=document.createElement("span");
  cap.className="cap"; cap.textContent="Execution";
  var cap2=document.createElement("span");
  cap2.className="cap"; cap2.style.marginLeft="8px"; cap2.textContent="Bridge bias";
  var w=document.createElement("span");
  w.className="pill"; w.id="biasWord"; w.style.cursor="default"; w.textContent="—";
  box.innerHTML="";
  box.appendChild(cap);
  TFS.forEach(function(t,i){
    var b=document.createElement("button");
    b.type="button"; b.className="pill"; b.textContent=t.n;
    b.setAttribute("data-tf",String(i));
    b.onclick=function(){ execTf(i) };
    box.appendChild(b);
  });
  box.appendChild(cap2);
  box.appendChild(w);
}
function paintTfSwitch(){
  var box=$("tfswitch"); if(!box) return;
  var at=tfIndexOf();
  TFS.forEach(function(t,i){
    var b=box.querySelector('[data-tf="'+i+'"]');
    if(b) b.setAttribute("aria-pressed", i===at ? "true":"false");
  });
}
//===BLOCK:dial
    <div class="dial" id="tfswitch" style="margin-top:12px"></div>
//===BLOCK:boot
buildTfSwitch(); paintBias();
