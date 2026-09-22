# TradingView Lightweight Charts

The chart engine behind the Trading Desk's chart card. TradingView's own — the
free and open-source one, not the TradingView platform.

**Licence: Apache License 2.0.** The full text is in `LICENSE` beside this file,
which is a condition of shipping it. The build carries its own copyright header
on its first line, and the desk page carries a credit line. Both stay.

    LICENSE                                     the licence text
    5.2.1/lightweight-charts.standalone.production.js   the build, unmodified

## Why the version is in the folder name

`sw.js` serves static assets cache-first. A new build dropped in under the old
name would reach the browser **after** the page that calls it, so an upgraded
desk could run against a downgraded engine — a renamed API, and a chart that
draws nothing with no error to see. Putting the version in the path makes every
build its own URL, and then the cache can never hand over the wrong one.

## Why it is a file here and not a `<script src="https://...">`

This app's whole stance is that nothing third-party runs on its pages. A script
tag pointing at a CDN would put a third-party address in the desk's HTML, tell
that host who is reading and from where, and break the page the moment the CDN is
blocked or offline. The desk is opened on a phone, on a mobile network. So the
file is served by this app's own server, by the same `express.static` that serves
every other asset, and the page still contains no address belonging to anybody
else.

The library's own attribution mark (a small TradingView logo in the chart's
corner, part of the licence) is drawn from data inside the build. It does not
fetch anything.

## Updating it

    cd /tmp && mkdir -p lwc && cd lwc && npm pack lightweight-charts
    tar -xzf lightweight-charts-*.tgz
    mkdir -p <this folder>/<new version>
    cp package/dist/lightweight-charts.standalone.production.js <this folder>/<new version>/
    cp package/LICENSE <this folder>/

Then, in the same commit: point the `<script src>` in `desk.html` at the new
folder, update the version in the page's credit line and in
`ENGINE_VERSION` — `server/test/desk-chart.test.js` asserts the page, the path
and the build's own header all name the same version, and that every function the
page calls is one this build exports. That check is what catches a rename (v4's
`addCandlestickSeries` does not exist in v5, which uses
`addSeries(CandlestickSeries, ...)`) before it reaches his phone.

Leave the old folder in place until the next commit after his, so a page he has
open does not 404 mid-session. Delete it once the new one is live.
