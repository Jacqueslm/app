  /* ── the turn off the level ───────────────────────────────────────────────
     The pullback used to end ON the level, which left the entry and the
     structural stop the same price: on some seeds the stop question offered
     "just beyond the level (104.62)" against "close in at 104.60", two prices
     nobody can tell apart — not by eye, not on the scale, not by reading the
     number. His own words: "the number in the question answers and on the chart
     are incompatible doesn't makes sense I'm still guessing."

     It is also not the trade the lessons describe. Price comes into the level
     and TURNS: that turn is the entry, and it is what puts distance between the
     entry and the place the idea dies. So the bars are walked off the level
     until the entry has cleared an ATR, and only then is the decision made. */
  function turnOff(level, dir){
    var guard = 0;
    while(guard++ < 8){
      var a = atrAt(bars, bars.length - 1);
      var away = (base - level) * dir;          /* how far past the level, signed */
      if(away >= a * 1.2) break;
      push(1, dir * Math.max(a * 0.6, a * 1.3 - away), 0.5);
    }
  }
