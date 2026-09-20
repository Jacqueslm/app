// Step one of the practice game, as text for tools/apply-market-questions.js to
// splice into market-maker.html.
//
// market-maker.html is 755KB (the real tape is packed inside it as JSON), past
// what the editor can open, so the convention here is a block file plus an
// apply script. This file is never required by anything — it is read as text.
//
// Each block sits between its own `//===BLOCK:name` line and the next one, and
// there is NOTHING between blocks: no headings, no prose, nothing but a blank
// line. Whatever sits between two markers is spliced into the page, so a
// heading between them would land in the page too. (It did, once — the block
// reader was pulling the next block's heading in with the last block's code.)
//
//   frame         the frame the chart builds, so anything asked about is in it
//   steps         the inside, split into its two sides, and level means level
//   returnfields  the inside is handed out with the structure
//   qengine       the reads, the rotation, and the read that is always there
//   markers       the tape numbers its three lines, and names them after
//   dstruct       the inside status line, once you have answered
//   optlabel      the number the tape drew, then the option text
//   optloop       the buttons, carrying their number
//   verdict       step two, naming the same line the button does
//
// Jacques, 19 Sep 2026, looking at step one of the game, three times over:
//   "the number in the question answers and on the chart are incompatible
//    doesn't makes sense I'm still guessing"
//   "still doesn't make sense you might have to redo this whole game over"
//
// ── what was wrong, read off the page rather than assumed ───────────────────
//
//  1. The level read offered three prices that were arithmetic, not levels:
//     the last low, and that low plus and minus a fraction of the last leg.
//     Nothing on the tape said either wrong one existed. On his own screenshot
//     one came out at exactly the current price, so the price he was asked to
//     judge as "a low the market has not taken" sat under the yellow now tag;
//     the other sat below every bar on the screen.
//
//  2. The three prices were drawn on the chart as lines numbered 1, 2 and 3 —
//     and the answer buttons showed a bare price with no number on them. The
//     one thing the question asked him to do, match a number on the tape to a
//     number in the box, could not be done. Same numbers, two unrelated sets.
//
//  3. The inside read had two states that were not the words it used. Both
//     flags true (lows stepping up, highs stepping down) was called
//     "chopping"; neither flag true (lows stepping down, highs stepping up, a
//     range opening out) was called "neither yet". Two of the four possible
//     tapes got a name that described neither. And the comparison was >, so a
//     pair of turns a hair apart on floating point read as a step when the two
//     prices were level.
//
//  4. Nothing held any of it, and when no read could be built the clock stopped
//     and the gate asked nothing at all — 18% of gates, measured over the
//     game's own tape and 24 generated markets. A gate that stops the clock and
//     asks nothing teaches nothing.
//
// ── what holds it now ───────────────────────────────────────────────────────
// server/test/market-maker.test.js, which did not exist. It drives the page's
// real engine over the game's real packed tape and over generated markets, and
// every check is made against the bars rather than against the page's own
// flags — the flags are what was wrong. 9 tests.

//===BLOCK:frame
  // Anything the screen asks the player to judge has to be inside the frame. A
  // level the question is about, or a stop being priced, sitting outside the
  // last seventy bars would be off-screen - and that is a guess again. This
  // used to apply while the question was being asked and stop once it was
  // answered, so a line he had just been marked on could leave the screen.
  if(Gm.gate && Gm.gate.q && Gm.gate.q.prices)
    Gm.gate.q.prices.forEach(function(p){ if(p>hi)hi=p; if(p<lo)lo=p });

//===BLOCK:steps
  // Each side of the inside, on its own — 19 Sep 2026. The two flags above
  // cannot carry a question between them: when the small lows step up while
  // the small highs step down, both are true and the page called that
  // "chopping"; when the lows step down while the highs step up — a range
  // opening out — neither is true and the page called it "neither yet".
  // Neither word is the tape. With the two sides split it is one of four plain
  // things, and only three of them have a name worth asking about.
  //
  // A pair that is level is 0, not a direction. The comparison was >, so two
  // turns a hair apart on floating point came out -1 — down — and the inside
  // was named a way the bars do not support. 0 means "not stepping", which is
  // one of the four states, and it makes the inside reads decline rather than
  // invent an answer.
  var stepOf=function(arr){
    if(arr.length<2) return 0;
    var a=arr[arr.length-2].p, b=arr[arr.length-1].p;
    return Math.abs(b-a)<1e-9 ? 0 : (b>a ? 1 : -1);
  };
  var lowStep  = stepOf(innerLows);
  var highStep = stepOf(innerHighs);
  var innerDir    = (lowStep&&highStep&&lowStep===highStep) ? lowStep : 0;  // 1 up · -1 down · 0 not one thing
  var innerCoil   = (lowStep===1  && highStep===-1);   // narrowing
  var innerExpand = (lowStep===-1 && highStep===1);    // opening out — no read

//===BLOCK:returnfields
  return {seq:seq,lastH:lastH,lastL:lastL,trend:trend,legFrom:legFrom,legDir:legDir,
          inner:inner,innerUp:innerUp,innerDown:innerDown,
          lowStep:lowStep,highStep:highStep,innerDir:innerDir,innerCoil:innerCoil,innerExpand:innerExpand,
          last:ev[ev.length-1]||null,events:ev};

//===BLOCK:qengine
/* ── the reads ──────────────────────────────────────────────────────────────
   Every one of them has to be answerable from what is on the screen with
   nothing marked, because that is the whole of step one. When the tape cannot
   support a read it returns null and the next one is asked in its place — an
   unanswerable question is worse than a different question. The outside read
   is the last of them for that reason: it is the one the tape can always make.
   ─────────────────────────────────────────────────────────────────────────── */

function buildQ(){
  var st=stNow(); if(!st) return null;
  // The rotation, and the refusal to ask what the tape cannot support.
  //
  // Each read below returns null when the bars do not carry a clear answer and
  // the next one in line is asked instead. A question whose options cannot be
  // settled from what is drawn is not a question, it is a coin toss — and a
  // coin toss is what he said this screen had become.
  Gm.qn=(Gm.qn||0)+1;
  var kinds=["level","inner","event","agree"];
  for(var t=0;t<kinds.length;t++){
    var kind=kinds[(Gm.qn+t)%kinds.length], q=null;
    if(kind==="level") q=qLevel(st);
    else if(kind==="inner") q=qInner(st);
    else if(kind==="event") q=qEvent(st);
    else if(kind==="agree") q=qAgree(st);
    if(q) return q;
  }
  // Nothing the tape was carrying could be asked, so ask the one that is
  // always on it. Returning null here stopped the clock and asked nothing.
  return qOutside(st);
}

/* The read that can always be made.
   The other four all return null on a tape that cannot carry them — no untaken
   level, no nameable inside, no recent raid, no trend to agree with. The
   outside structure is on the tape at every single bar: the turns are drawn,
   and they are stepping up, stepping down, or overlapping. This one depends on
   nothing, which is why it is the last thing buildQ tries.

   It is deliberately NOT a fifth slot in the rotation. Being always available,
   as an equal partner it drowned the specific reads out — the level read fell
   from 130 questions to under half that. It is the fallback, which is its job. */
function qOutside(st){
  var labs=st.seq.filter(function(p){return p.lab}).slice(-4);
  if(labs.length<3) return null;
  var L=labs.map(function(p){return p.lab});
  var hh=L.indexOf("HH")>=0, hl=L.indexOf("HL")>=0, ll=L.indexOf("LL")>=0, lh=L.indexOf("LH")>=0;
  var a = (hh&&hl&&!ll) ? 0 : ((ll&&lh&&!hh) ? 1 : 2);
  return {kind:"outside", a:a,
    q:"Ignore the inside of the leg. From the turns drawn on the tape, what is the outside structure doing?",
    o:["Higher highs and higher lows — it is stepping up",
       "Lower lows and lower highs — it is stepping down",
       "Neither — the turns overlap and it is going sideways"],
    w:"Higher highs with higher lows is up. Lower lows with lower highs is down. Anything else is a range, and a range is a real answer — most of the time it is the correct one. Nothing else on this screen can be read until this is settled: the inside is only worth asking once you know which way the outside leans, and an entry is only worth taking with it."};
}

function qInner(st){
  if(st.inner.length<3) return null;
  // A coiling inside is a read. One opening out is not: the small lows going
  // down while the small highs go up has no single answer to "which way are
  // they stepping", so it is skipped rather than asked.
  if(st.innerDir===0 && !st.innerCoil) return null;
  var a = st.innerDir>0 ? 0 : st.innerDir<0 ? 1 : 2;
  return {kind:"inner", a:a,
    q:"Ignore the big swings. Inside the leg running right now, which way are the small highs and lows stepping?",
    o:["Up — the small lows are stepping higher",
       "Down — the small highs are stepping lower",
       "Coiling — one side stepping up while the other steps back"],
    w:"That is internal structure. It turns before the swing high or low ever breaks, which is the whole reason to watch it — by the time the outside confirms, the move has already been paid for."};
}

function qEvent(st){
  if(!st.last || !EVQ[st.last.kind]) return null;
  var e=EVQ[st.last.kind];
  return {kind:"event", a:e.a,
    q:"Price has just been back to a level it already made. What did it actually do there?",
    o:["Took the low and handed it straight back",
       "Took the high and handed it straight back",
       "Closed through the low and stayed below it",
       "Closed through the high and stayed above it"],
    w:e.w};
}

function qAgree(st){
  if(!st.lastH || !st.lastL || st.trend==="range") return null;
  if(st.innerDir===0 && !st.innerCoil) return null;   // opening out: the inside has not taken a side
  var up=st.trend==="up";
  var a = st.innerDir===0 ? 2 : ((up ? st.innerDir>0 : st.innerDir<0) ? 0 : 1);
  return {kind:"agree", a:a,
    q:"From the outside the structure reads "+(up?"UP — higher highs and higher lows":"DOWN — lower highs and lower lows")+
      ". Does the inside of the leg running now agree with it?",
    o:["Yes — the inside is pushing the same way",
       "No — the inside has already turned against it",
       "Neither — it is coiling, not stepping anywhere"],
    w:"When the outside and the inside disagree, the outside is the one about to be wrong. External structure is what already happened and it always looks tidy afterwards. Internal structure is how it is arriving — and that is where the manipulation lives."};
}

/* The level read, rebuilt 19 Sep 2026.
   He was asked which of three prices was "the resting low it has not taken
   yet", and he could not answer it from the chart, because the three prices
   were arithmetic — the last low, and that low plus and minus a fraction of
   the last leg. One of them came out exactly level with the current price, so
   it sat under the yellow tag looking like a level; another came out below
   every bar on the screen, a price the market had never traded. There was
   nothing on the tape to check either of them against, which is guessing.

   Now all three prices are real turns the market actually made, and exactly
   one of them has not been paid:
     · the answer      — the last low, still the near side of price, never
                         closed through since it was made
     · one overhead    — a low price is under already, so it is finished
     · one below price — a low price has been under and come back over
   Which of the three is still resting is settled by looking at each line:
   two of them the tape crosses and closes the other side of. And the two
   wrong ones straddle the current price, so the answer can never be worked
   out by which line is highest. */
function qLevel(st){
  if(!st.legDir) return null;
  var down = st.legDir<0;                        // coming down off the last high
  var ref = down ? st.lastL : st.lastH;
  if(!ref) return null;
  var start=Math.max(0,Gm.i-70);                 // the frame the chart draws
  if(ref.i<start) return null;
  var px=Gm.bars[Gm.i].c;
  if(down ? px<=ref.p : px>=ref.p) return null;  // price has to be on the near side of it
  // has price closed beyond it since it was made, and where on the screen
  var through=function(pt){
    for(var i=Math.max(pt.i+1,start);i<=Gm.i;i++){
      if(down ? Gm.bars[i].c<pt.p : Gm.bars[i].c>pt.p) return true;
    }
    return false;
  };
  if(through(ref)) return null;                  // the last low is gone: nothing resting here
  var turns=[];
  st.seq.forEach(function(pt){
    if(pt.t===ref.t && pt.i<ref.i && pt.i>=start && through(pt)) turns.push(pt);
  });
  if(turns.length<2) return null;
  var lo2=1e9, hi2=-1e9;
  for(var i=start;i<=Gm.i;i++){ if(Gm.bars[i].h>hi2)hi2=Gm.bars[i].h; if(Gm.bars[i].l<lo2)lo2=Gm.bars[i].l }
  var minGap=Math.max((hi2-lo2)*0.05,0.1);
  var apart=function(a,b){ return Math.abs(a-b)>=minGap };
  // two of them, one above the current price and one below it, both clear of
  // the answer: without that the answer is simply the outermost line, and
  // picking the outermost line is not a read of anything.
  var pick=null;
  for(var a=0;a<turns.length&&!pick;a++){
    for(var b=a+1;b<turns.length&&!pick;b++){
      if(!apart(turns[a].p,ref.p)||!apart(turns[b].p,ref.p)||!apart(turns[a].p,turns[b].p)) continue;
      if((turns[a].p>px)!==(turns[b].p>px)) pick=[turns[a],turns[b]];
    }
  }
  if(!pick) return null;
  var cand=[ref.p, pick[0].p, pick[1].p];
  var order=[0,1,2].sort(function(){return Math.random()-0.5});
  var word=down?"low":"high";
  return {kind:"level", a:order.indexOf(0),
    q:"Price is heading "+(down?"down":"up")+". Three "+(down?"lows":"highs")+
      " are drawn on the tape, numbered 1, 2 and 3. Two of them price has already been through. Which one is the resting "+
      word+" it has not taken yet — the one the stops are sitting "+(down?"under":"above")+"?",
    // the three prices, in option order. The chart draws each one as its own
    // line with its number on it, so the question is answered off the tape.
    prices:order.map(function(k){return +cand[k].toFixed(1)}),
    o:order.map(function(k){return cand[k].toFixed(1)}),
    w:"Two of the three are finished business — one sits "+(down?"overhead, where you are under it":"below you, where you are over it")+
      ", and the other you have been through and come back over. Being through a level is what takes it off the board. The one still resting is the only one with orders behind it. Untaken highs and lows are not targets because they are pretty — they are targets because that is where the orders are."};
}

//===BLOCK:markers
  // STEP ONE asks about prices, so the prices in the question are on the tape.
  // Three numbers in a box and one price in the corner is a coin toss: there
  // was nothing on the chart to compare them against. Option 1 is line 1, and
  // the answer is which line is the untaken one — a read, not a guess.
  //
  // Once it is answered the same three lines stay up and say what each one
  // was, because "why was that the answer" is the part worth keeping.
  if(Gm.gate && Gm.gate.q && Gm.gate.q.prices){
    var asking = Gm.gate.state==="ask";
    Gm.gate.q.prices.forEach(function(p,k){
      var py=Y(p); if(py<26||py>H-26) return;
      var right=(k===Gm.gate.q.a);
      x.strokeStyle = asking ? "rgba(124,108,255,.5)" : (right?"rgba(46,230,160,.75)":"rgba(136,145,180,.5)");
      x.lineWidth=1.2; x.setLineDash([3,4]);
      x.beginPath(); x.moveTo(0,py); x.lineTo(W-70,py); x.stroke(); x.setLineDash([]);
      x.fillStyle = asking ? "rgba(124,108,255,.95)" : (right?"rgba(46,230,160,.95)":"rgba(136,145,180,.85)");
      x.beginPath(); x.arc(W-72,py,8,0,7); x.fill();
      x.fillStyle="#0B0F1E"; x.font="700 11px JetBrains Mono, monospace"; x.textAlign="center";
      x.fillText(String(k+1),W-72,py+4);
      if(!asking){
        x.fillStyle = right?"rgba(46,230,160,.95)":"rgba(136,145,180,.85)";
        x.font="700 9.5px JetBrains Mono, monospace"; x.textAlign="left";
        x.fillText(right?"RESTING — price has not been here":"TAKEN — price has been through it",8,py-5);
      }
    });
  }

//===BLOCK:dstruct
  // one status line, bottom left, always readable
  var inside = st.inner.length<3 ? "nothing said yet"
    : st.innerDir>0 ? "higher lows and higher highs — being pushed"
    : st.innerDir<0 ? "lower highs and lower lows — being unwound"
    : st.innerCoil ? "coiling — one side stepping up, the other back"
    : "opening out — no read yet";
  x.textAlign="left"; x.font="700 10.5px JetBrains Mono, monospace";
  x.fillStyle="rgba(136,145,180,.85)";

//===BLOCK:optlabel
// The number the tape drew on this line, then the text. The one thing the
// question asks you to do is match a number on the tape to a number in the
// box, and the tape's numbers were not on the buttons — so "line 2" and the
// button for line 2 were not the same thing on screen. A question with no
// prices on the chart has nothing to number, so it is left alone.
function optLabel(q,k){
  return (q.prices ? (k+1)+"  ·  " : "") + q.o[k];
}

//===BLOCK:optloop
  var box=$("gOpts"); box.innerHTML="";
  g.q.o.forEach(function(t,k){
    var b=document.createElement("button");
    b.type="button"; b.textContent=optLabel(g.q,k);
    if(g.state==="ask"){ b.onclick=function(){ gatePick(k) } }
    else {
      b.disabled=true;
      if(k===g.q.a) b.className="right";
      else if(k===g.pick) b.className="wrong";
    }
    box.appendChild(b);
  });

//===BLOCK:verdict
      "The answer is <b>"+optLabel(g.q,g.q.a)+"</b>. "+g.q.w;
