# Getting this on your TradingView chart

`structure.pine` is a port of the engine. It draws the swings, the labels, the
protected level, breaks of structure, and the live entry / stop / target.

## Installing it

1. TradingView → **Pine Editor** (bottom panel)
2. Open a new indicator, delete the template, paste the whole file
3. **Save**, then **Add to chart**
4. Put it on MES 1H — that is the timeframe everything was measured on

## Settings worth knowing

| setting | default | why |
|---|---|---|
| Swing sensitivity | 2 | Five-bar swing. Labels appear **2 bars late on purpose** — that is when the swing became knowable. |
| Require 4H and daily to agree | on | The measured edge depends on it. Without it the same rules were roughly breakeven over 3.6 years. |
| Entry depth | 0.75 | Deeper pulled better, monotonically. |
| Exit fraction | 0.80 | Top of your 50–80% band. It tested best once intrabar paths were resolved. |

## One difference from the engine, stated rather than hidden

The engine computes a full structural bias on the 4H and daily — protected
levels and all. Pine cannot run three copies of that cheaply, so the indicator
uses **the direction of the last closed 4H and daily candle** as a proxy.

It is coarser. Expect it to disagree with `scanner.html` sometimes, and treat
the scanner as authoritative when they do.

## What it will not do

It does not repaint, and that costs you something: every label lands `N` bars
after the swing, and the higher timeframes are read with `lookahead_off` **and**
indexed `[1]` so an unfinished 4H bar can never leak backwards. Most structure
indicators on TradingView do neither, which is why their history looks so much
better than their live behaviour.

It also places no orders and sets no alerts beyond one — price reaching the
entry level.

## The numbers behind it

Roughly **+0.20R to +0.46R a trade, about one a week**, on MES, over 55 trades
whose intrabar path could be verified against 15M data. Positive in every
calendar year tested, and in both directions.

That is a real edge on a small verified sample. `../SPEC.md` §21 explains what
is proven, what is bracketed, and what was withdrawn — including the +0.62R
figure that turned out to be an artifact of assuming a price path the data did
not contain.
