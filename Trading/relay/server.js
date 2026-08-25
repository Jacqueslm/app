// =============================================================================
//  MSB ALERT RELAY — makes the grader fill itself when a TradingView alert fires
//
//  What it does, in one line: TradingView webhook → this little server → the
//  grader page (served at http://localhost:4410) auto-fills the trade numbers.
//
//  Pure Node, no npm installs, no dependencies. Start it with the
//  "Start Trade Grader.bat" one folder up, or:  node relay/server.js
//
//  It serves the SAME trade-grader.html that lives in the Trading folder —
//  one grader, two doorways. The webhook needs a public URL (TradingView's
//  servers live on the internet and cannot see your PC), so a tunnel like
//  ngrok points a public address at this server. Setup: GETTING-STARTED.md.
// =============================================================================

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = 4410;
const GRADER = path.join(__dirname, "..", "trade-grader.html");
const SECRET_FILE = path.join(__dirname, "secret.txt");
const LOG_FILE = path.join(__dirname, "alerts.log");
const STATE_FILE = path.join(__dirname, "state.json");

// A private token in the webhook path so random internet noise can't inject
// fake alerts. Generated once, kept in relay/secret.txt.
let secret;
try {
  secret = fs.readFileSync(SECRET_FILE, "utf8").trim();
  if (!/^[a-f0-9]{16}$/.test(secret)) throw new Error("bad secret");
} catch {
  secret = crypto.randomBytes(8).toString("hex");
  fs.writeFileSync(SECRET_FILE, secret);
}

// Last alerts live in memory (and append to alerts.log for your records).
let alerts = [];
let nextId = 1;

// ═══ AUTOTRADE — the TradingView bot ═════════════════════════════════════════
// When an "MSB PURE" alert arrives, write an order file into NinjaTrader's
// incoming folder (the ATI). NinjaTrader places the bracket: market entry,
// then two OCO pairs — half at T1, half at T2, both protected by the stop.
//
// OFF until you turn it on in relay/autotrade.json, and it starts on Sim101.
// Requirements in NinjaTrader: Tools → Options → Automated trading interface
// → tick "AT interface". That folder only exists while NinjaTrader is running.
//
// Between the alert and the order sit the SAFETY RAILS. Every one of them can
// only ever block a trade, never invent one, and every decision is printed
// and written to alerts.log so you can audit what the bot did and why.
//   · kill switch   — /bot page (phone-friendly). DISARMED survives restarts.
//   · one a day     — maxPerDay, counted in state.json, restart-proof.
//   · duplicates    — the same alert text inside dupWindowMin places once.
//   · session gate  — orders only inside that instrument's ET window, Mon–Fri.
//   · sanity        — stop/T1/T2 on the correct side, risk within maxRiskPts.
//   · rollover      — expired contract month blocks; rollover month warns.
const AUTO_FILE = path.join(__dirname, "autotrade.json");
const AUTO_DEFAULT = {
  enabled: false,
  account: "Sim101",
  // Size is COMPUTED, not fixed: contracts = floor( (balance x riskPct%) /
  // (stop points x dollars per point) ). The stop distance comes from the
  // alert, so a wide-stop trade automatically gets fewer contracts and the
  // dollars at risk stay the same. Keep `balance` current — it is the one
  // number here the relay cannot look up for itself, and a stale balance
  // makes every contract count wrong in the same direction.
  balance: 25000,
  riskPct: 10,         // set by choice. Reference: the paper record averages 0.87% a
                       // trade, and the sweeps put 10% at a 30-99% drawdown on the same edge.
  maxContracts: 50,       // a hard ceiling no arithmetic can talk its way past
  maxPerDay: 1,           // the bot's bullet count — same rule as yours
  dupWindowMin: 10,       // identical alert text inside this window trades once
  incoming: path.join(process.env.USERPROFILE || require("os").homedir(),
    "Documents", "NinjaTrader 8", "incoming"),
  // TradingView ticker → the actual contract NinjaTrader trades. Update at rollover.
  // session = the ET window orders are allowed; maxRiskPts = a stop wider than
  // this is treated as a bad alert, not a big trade; perPoint = dollars per
  // whole point of price, which is what turns a stop distance into a size.
  instruments: {
    "MNQ1!": { name: "MNQ 09-26", tick: 0.25, perPoint: 2,  session: "0930-1500", maxRiskPts: 250 },
    "MES1!": { name: "MES 09-26", tick: 0.25, perPoint: 5,  session: "0930-1500", maxRiskPts: 90 },
    "MGC1!": { name: "MGC 12-26", tick: 0.10, perPoint: 10, session: "0800-1300", maxRiskPts: 35 }
  }
};
let auto = AUTO_DEFAULT;
try {
  auto = Object.assign({}, AUTO_DEFAULT, JSON.parse(fs.readFileSync(AUTO_FILE, "utf8")));
} catch {
  fs.writeFileSync(AUTO_FILE, JSON.stringify(AUTO_DEFAULT, null, 2));
}

// Bot state that must survive a restart: the kill switch, today's trade count,
// and recent alert fingerprints. Lives in relay/state.json.
let state = { killed: false, day: "", placed: [], recent: [] };
try { state = Object.assign(state, JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))); } catch {}
const saveState = () => { try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch {} };

// Everything the bot decides, on one line: console + alerts.log + the /bot page.
let decisions = [];
function decide(placed, msg) {
  const line = (placed ? "🤖 " : "✗ bot: ") + msg;
  console.log(line);
  fs.appendFile(LOG_FILE, new Date().toISOString() + "  BOT " + (placed ? "PLACED " : "blocked ") + msg + "\n", () => {});
  decisions.push({ t: Date.now(), placed, msg });
  if (decisions.length > 20) decisions = decisions.slice(-20);
}

// New York clock, no libraries: weekday, date and HHMM in ET.
function etNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hourCycle: "h23", weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  }).formatToParts(new Date());
  const g = t => (parts.find(p => p.type === t) || {}).value;
  return { wd: g("weekday"), date: `${g("year")}-${g("month")}-${g("day")}`,
           hm: +g("hour") * 100 + +g("minute"), month: +g("month"), year: +g("year") };
}

// "MNQ 09-26" → how close is that contract to the grave?
//   ok        — trades fine
//   rollover  — we're inside the contract month; roll to the next one soon
//   expired   — the month is behind us; the order would hit a dead contract
function contractStatus(name) {
  const m = /(\d{2})-(\d{2})\s*$/.exec(name || "");
  if (!m) return "unknown";
  const cm = +m[1], cy = 2000 + +m[2];
  const now = etNow();
  if (cy < now.year || (cy === now.year && cm < now.month)) return "expired";
  if (cy === now.year && cm === now.month) return "rollover";
  return "ok";
}

function inSession(sess) {
  const m = /^(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(sess || "");
  if (!m) return true;                              // no window configured = no gate
  const now = etNow();
  if (now.wd === "Sat" || now.wd === "Sun") return false;
  const from = +m[1] * 100 + +m[2], to = +m[3] * 100 + +m[4];
  return now.hm >= from && now.hm <= to;
}

let oifSeq = 0;
function roundTick(px, tick) { return (Math.round(px / tick) * tick).toFixed(tick < 0.25 ? 1 : 2); }

// "MNQ1! MSB PURE dir 1 | entry 29940.00 | stop 29900.00 | risk 40.00 pts | T1 29980.00 | T2 30140.00 | room 5.0R"
function tryAutotrade(text) {
  if (!auto.enabled) return;
  const m = text.match(/^(\S+)\s+MSB PURE dir (-?1)(?:\.0+)?\s*\|/);
  if (!m) return;                                   // not a PURE signal — ignore

  // ── the rails, in order ────────────────────────────────────────────────────
  if (state.killed) { decide(false, "KILL SWITCH is on — no orders until you re-arm at /bot"); return; }

  const today = etNow().date;
  if (state.day !== today) { state.day = today; state.placed = []; saveState(); }

  // Duplicate: TradingView retries, double-fired alerts, a re-sent webhook.
  const hash = crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);
  const winMs = (auto.dupWindowMin || 10) * 60000;
  state.recent = (state.recent || []).filter(r => Date.now() - r.t < Math.max(winMs, 7200000));
  const dup = state.recent.find(r => r.h === hash && Date.now() - r.t < winMs);
  state.recent.push({ h: hash, t: Date.now() });
  saveState();
  if (dup) { decide(false, "duplicate of an alert " + Math.round((Date.now() - dup.t) / 60000) + " min ago — placed once, not twice"); return; }

  if (state.placed.length >= (auto.maxPerDay || 1)) {
    decide(false, "bullet already spent — " + state.placed.length + "/" + (auto.maxPerDay || 1) + " trade(s) placed today. This one is tomorrow's.");
    return;
  }

  const inst = auto.instruments[m[1]];
  if (!inst) { decide(false, "no instrument mapping for " + m[1]); return; }

  // Late is the same as wrong: an alert that lands outside the session window
  // (delayed webhook, relay started mid-day, a stale retry) executes at a
  // price the levels no longer describe.
  if (!inSession(inst.session)) {
    decide(false, m[1] + " alert outside the " + (inst.session || "?") + " ET window — stale levels, no order");
    return;
  }

  const cs = contractStatus(inst.name);
  if (cs === "expired") {
    decide(false, inst.name + " looks EXPIRED — update the contract month in relay/autotrade.json");
    return;
  }

  const num = re => { const g = text.match(re); return g ? parseFloat(g[1]) : NaN; };
  const entrySide = m[2] === "1";
  const entry = num(/entry\s+([\d.]+)/i);
  const stop = num(/stop\s+([\d.]+)/i);
  const t1   = num(/T1\s+([\d.]+)/);
  const t2   = num(/T2\s+([\d.]+)/);
  if (!(stop > 0 && t1 > 0 && t2 > 0)) { decide(false, "bad numbers in alert"); return; }

  // Sanity: every level on the side it belongs. A mangled alert fails here
  // instead of becoming a live position with the stop above a long entry.
  if (entry > 0) {
    const wrong = entrySide
      ? (stop >= entry || t1 <= entry || t2 <= entry)
      : (stop <= entry || t1 >= entry || t2 >= entry);
    if (wrong) { decide(false, "levels on the wrong side of entry for a " + (entrySide ? "LONG" : "SHORT") + " — mangled alert, no order"); return; }
    if (inst.maxRiskPts > 0 && Math.abs(entry - stop) > inst.maxRiskPts) {
      decide(false, "stop is " + Math.abs(entry - stop).toFixed(2) + " pts from entry — over the " + inst.maxRiskPts + " pt cap for " + m[1] + ". That is a bad alert, not a big trade.");
      return;
    }
  }

  // ── size, from the stop distance ───────────────────────────────────────────
  // The alert measured the stop; the config holds the money. Multiply out and
  // the dollars at risk are the same whether the stop is 12 points or 90.
  const riskPts = Math.abs(entry - stop);
  const perPt   = inst.perPoint > 0 ? inst.perPoint : 0;
  if (!(perPt > 0)) { decide(false, "no perPoint set for " + m[1] + " in autotrade.json — cannot size the trade"); return; }
  const riskUsd = (auto.balance || 0) * (auto.riskPct || 0) / 100;
  const qty = Math.min(auto.maxContracts || 50, Math.floor(riskUsd / (riskPts * perPt)));

  // Zero contracts means the stop is too wide for the account at this risk.
  // The answer to that is to skip the trade, never to shrink the stop to fit.
  if (qty < 1) {
    decide(false, "0 contracts — a " + riskPts.toFixed(2) + " pt stop on " + m[1] +
      " costs $" + (riskPts * perPt).toFixed(0) + " per contract, over the $" +
      riskUsd.toFixed(0) + " this trade is allowed to risk. Stop too wide for the account.");
    return;
  }

  // ── the order ──────────────────────────────────────────────────────────────
  // Two contracts or more: half comes off at 1R, the rest runs to T2.
  // One contract cannot be halved, and this relay has no way to move a stop to
  // break-even (it writes an order file and never hears about the fill), so a
  // single contract takes the 1R and is done rather than riding a trade that
  // reached +1R all the way back to -1R.
  const half = Math.floor(qty / 2);
  const rest = qty - half;
  const buy  = entrySide ? "BUY" : "SELL";
  const sell = entrySide ? "SELL" : "BUY";
  const S = roundTick(stop, inst.tick), P1 = roundTick(t1, inst.tick), P2 = roundTick(t2, inst.tick);
  const id = Date.now().toString(36);

  // ATI order-instruction format:
  // COMMAND;ACCOUNT;INSTRUMENT;ACTION;QTY;ORDER TYPE;LIMIT;STOP;TIF;OCO ID;ORDER ID;;
  const lines = [`PLACE;${auto.account};${inst.name};${buy};${qty};MARKET;;;GTC;;${id}E;;`];
  if (half > 0) {
    lines.push(`PLACE;${auto.account};${inst.name};${sell};${half};LIMIT;${P1};;GTC;${id}A;${id}T1;;`);
    lines.push(`PLACE;${auto.account};${inst.name};${sell};${half};STOPMARKET;;${S};GTC;${id}A;${id}S1;;`);
    lines.push(`PLACE;${auto.account};${inst.name};${sell};${rest};LIMIT;${P2};;GTC;${id}B;${id}T2;;`);
    lines.push(`PLACE;${auto.account};${inst.name};${sell};${rest};STOPMARKET;;${S};GTC;${id}B;${id}S2;;`);
  } else {
    lines.push(`PLACE;${auto.account};${inst.name};${sell};${qty};LIMIT;${P1};;GTC;${id}A;${id}T1;;`);
    lines.push(`PLACE;${auto.account};${inst.name};${sell};${qty};STOPMARKET;;${S};GTC;${id}A;${id}S1;;`);
  }
  const file = path.join(auto.incoming, "oif" + (++oifSeq) + "." + id + ".txt");
  try {
    fs.writeFileSync(file, lines.join("\r\n") + "\r\n");
    state.placed.push({ t: Date.now(), inst: inst.name, dir: buy, qty });
    saveState();
    decide(true, "AUTOTRADE → " + auto.account + "  " + inst.name + "  " + buy + " " + qty +
      "  stop " + S + "  T1 " + P1 + (half > 0 ? "  T2 " + P2 : "  (1 lot — full exit at 1R)") +
      "   risking $" + (qty * riskPts * perPt).toFixed(0) +
      " of $" + riskUsd.toFixed(0) + " (" + (auto.riskPct || 0) + "% of " + (auto.balance || 0) + ")" +
      (cs === "rollover" ? "   ⚠ rollover month — update the contract soon" : ""));
  } catch (e) {
    decide(false, "could not write to " + auto.incoming +
      " — is NinjaTrader running with the AT interface enabled? (" + e.message + ")");
  }
}

// ── the /bot page: status + the kill switch, phone-sized ─────────────────────
function botPage() {
  const armed = auto.enabled && !state.killed;
  const today = etNow().date;
  const used = state.day === today ? state.placed.length : 0;
  const live = auto.account !== "Sim101";
  const rows = Object.entries(auto.instruments).map(([tk, i]) => {
    const cs = contractStatus(i.name);
    const warn = cs === "expired" ? ' <b style="color:#ef5350">EXPIRED — fix autotrade.json</b>'
               : cs === "rollover" ? ' <b style="color:#f0a020">rollover month</b>' : "";
    return `<tr><td>${tk}</td><td>${i.name}${warn}</td><td>${i.session || "—"} ET</td></tr>`;
  }).join("");
  const dec = decisions.slice().reverse().map(d =>
    `<li>${new Date(d.t).toLocaleTimeString()} — ${d.placed ? "✅" : "🚫"} ${d.msg}</li>`).join("") ||
    "<li>Nothing yet this session.</li>";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>MSB Bot</title>
<style>body{background:#0e1116;color:#e6edf3;font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;
max-width:520px;margin:0 auto;padding:20px}h1{font-size:20px}table{width:100%;border-collapse:collapse;font-size:14px}
td{padding:6px 4px;border-bottom:1px solid #2a3341}li{font-size:13px;color:#8b96a5;margin-bottom:6px}
.big{font-size:26px;font-weight:800;padding:14px;border-radius:10px;text-align:center;margin:14px 0}
button{width:100%;padding:16px;font-size:18px;font-weight:700;border:0;border-radius:10px;cursor:pointer}
.pill{padding:2px 10px;border-radius:20px;font-size:13px;font-weight:700}</style></head><body>
<h1>MSB Bot — ${today}</h1>
<div class="big" style="background:${armed ? "rgba(38,166,154,.15);color:#26a69a" : "rgba(239,83,80,.15);color:#ef5350"}">
${armed ? "ARMED" : state.killed ? "KILLED" : "OFF (autotrade.json)"}</div>
<p>Account: <span class="pill" style="background:${live ? "rgba(239,83,80,.25);color:#ef5350" : "rgba(38,166,154,.25);color:#26a69a"}">
${auto.account}${live ? " — REAL MONEY" : " — sim"}</span>
&nbsp; Bullets: <b>${Math.max(0, (auto.maxPerDay || 1) - used)} / ${auto.maxPerDay || 1}</b> left today</p>
<p>Risk: <b>${auto.riskPct || 0}%</b> of <b>$${(auto.balance || 0).toLocaleString()}</b>
= <b>$${Math.round((auto.balance || 0) * (auto.riskPct || 0) / 100).toLocaleString()}</b> per trade.
Contracts are computed from that and the stop distance in the alert.</p>
<p style="font-size:13px;color:#f0a020">⚠ This path cannot move a stop to break-even — it writes an
order file and never hears about the fill. Trades of 2+ contracts take half at 1R and let the rest
run to T2 against the <i>original</i> stop. For break-even after 1R, run the NinjaScript
(ninjatrader/MSBPure.cs) instead, which sees its own fills.</p>
<form method="POST" action="/bot/${secret}/toggle">
<button style="background:${state.killed ? "#26a69a" : "#ef5350"};color:#fff">
${state.killed ? "RE-ARM THE BOT" : "KILL — stop placing orders"}</button></form>
<p style="font-size:13px;color:#8b96a5">The kill switch survives restarts. It stops new orders only —
anything already working in NinjaTrader stays yours to manage.</p>
<table>${rows}</table>
<h1 style="font-size:16px;margin-top:22px">Decisions this session</h1><ul>${dec}</ul>
</body></html>`;
}
// ═════════════════════════════════════════════════════════════════════════════

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  // The grader itself
  if (req.method === "GET" && (url === "/" || url === "/index.html")) {
    fs.readFile(GRADER, (err, html) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Could not find trade-grader.html one folder up from relay/. Keep the Trading folder together.");
        return;
      }
      // no-store: the grader gets updated in place, and a browser holding a
      // stale copy looks exactly like a broken system. Always serve fresh.
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, must-revalidate",
      });
      res.end(html);
    });
    return;
  }

  // The grader polls this for fresh alerts
  if (req.method === "GET" && url === "/alerts.json") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ alerts }));
    return;
  }

  // Bot status + kill switch. Same secret as the webhook — the page is yours alone.
  if (req.method === "GET" && url === "/bot/" + secret) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(botPage());
    return;
  }
  if (req.method === "POST" && url === "/bot/" + secret + "/toggle") {
    state.killed = !state.killed;
    saveState();
    console.log(state.killed ? "🔴 KILL SWITCH ON — the bot will not place orders."
                             : "🟢 Bot re-armed from the /bot page.");
    res.writeHead(303, { Location: "/bot/" + secret });
    res.end();
    return;
  }

  // TradingView posts the alert text here
  if (req.method === "POST" && url === "/hook/" + secret) {
    let body = "";
    req.on("data", c => { body += c; if (body.length > 10000) req.destroy(); });
    req.on("end", () => {
      const text = body.trim();
      if (text) {
        alerts.push({ id: nextId++, t: Date.now(), text });
        if (alerts.length > 20) alerts = alerts.slice(-20);
        fs.appendFile(LOG_FILE, new Date().toISOString() + "  " + text.replace(/\n/g, " | ") + "\n", () => {});
        console.log("⚡ Alert received " + new Date().toLocaleTimeString() + " — " + text.split("\n")[0]);
        tryAutotrade(text);
      }
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
    });
    return;
  }

  // Wrong secret on the hook path — say nothing useful to strangers.
  if ((req.method === "POST" || req.method === "GET") && (url.startsWith("/hook/") || url.startsWith("/bot/"))) {
    res.writeHead(403); res.end();
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
});

server.listen(PORT, () => {
  const armed = auto.enabled && !state.killed;
  console.log("");
  console.log("  ┌─────────────────────────────────────────────────────────────┐");
  console.log("  │  MSB ALERT RELAY is running                                 │");
  console.log("  └─────────────────────────────────────────────────────────────┘");
  console.log("");
  console.log("  Your grader:      http://localhost:" + PORT);
  console.log("  Webhook path:     /hook/" + secret);
  console.log("  Bot switch:       http://localhost:" + PORT + "/bot/" + secret);
  console.log("");
  console.log("  Autotrade:        " + (armed ? "🟢 ARMED → " + auto.account + (auto.account !== "Sim101" ? "  ⚠ REAL MONEY" : " (sim)")
                                             : state.killed ? "🔴 KILLED — re-arm on the /bot page"
                                             : "⚪ off (relay/autotrade.json)"));
  console.log("  Risk per trade:   " + (auto.riskPct || 0) + "% of $" + (auto.balance || 0) +
              " = $" + Math.round((auto.balance || 0) * (auto.riskPct || 0) / 100) +
              "   (contracts computed from the stop distance)");
  if (armed) console.log("  ⚠ No break-even on this path — it cannot see fills. Use ninjatrader/MSBPure.cs for that.");
  for (const [tk, i] of Object.entries(auto.instruments)) {
    const cs = contractStatus(i.name);
    if (cs === "expired") console.log("  ⚠ " + tk + " → " + i.name + " looks EXPIRED — update autotrade.json before trading.");
    else if (cs === "rollover") console.log("  ⚠ " + tk + " → " + i.name + " is in its rollover month — update it soon.");
  }
  console.log("");
  console.log("  To let TradingView reach it, run your tunnel in another window:");
  console.log("      ngrok http " + PORT);
  console.log("  then in the TradingView alert's Notifications tab, set Webhook URL to:");
  console.log("      https://YOUR-NGROK-DOMAIN/hook/" + secret);
  console.log("");
  console.log("  Keep this window open during the session. Ctrl+C to stop.");
  console.log("");
});
