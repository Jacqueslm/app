# Market Maker Warfare

A trading practice game. Thirty operations on real market tape — MES, MNQ and
MGC — with a briefing room of seven lessons in front of it and a campaign that
keeps going past thirty forever.

`mmw.html` is the whole thing: one self-contained page, no build step, no
server. Open it in a browser and it runs. The market data is packed into the
page itself as a `<script type="application/json">` block, so it works offline.

## The point of it

External structure — the swing highs and lows you can see — tells you where
price went, and it always looks tidy afterwards. The internal structure is what
happened inside the leg on the way there, and that is where the manipulation
is: the low swept and given back, the break that was never a break.

So the game gates the trigger behind a read. Ask first, observe second, execute
third. You answer a question about the inside of the current leg on a bare
chart, then it draws what was actually there, and only then do the fire buttons
unlock.

`Market-Maker-Warfare-Manual.pdf` explains all of it.

## Where it lives

It is also published as an artifact:
https://claude.ai/code/artifact/d3caf4a0-84d3-4e56-9f0f-3bda010d0783

This file and that artifact are the same page. Change one, change the other.
