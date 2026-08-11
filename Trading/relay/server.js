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
const AUTO_FILE = path.join(__dirname, "autotrade.json");
const AUTO_DEFAULT = {
  enabled: false,
  account: "Sim101",
  contracts: 2,
  incoming: path.join(process.env.USERPROFILE || require("os").homedir(),
    "Documents", "NinjaTrader 8", "incoming"),
  // TradingView ticker → the actual contract NinjaTrader trades. Update at rollover.
  instruments: {
    "MNQ1!": { name: "MNQ 09-26", tick: 0.25 },
    "MES1!": { name: "MES 09-26", tick: 0.25 },
    "MGC1!": { name: "MGC 12-26", tick: 0.10 }
  }
};
let auto = AUTO_DEFAULT;
try {
  auto = Object.assign({}, AUTO_DEFAULT, JSON.parse(fs.readFileSync(AUTO_FILE, "utf8")));
} catch {
  fs.writeFileSync(AUTO_FILE, JSON.stringify(AUTO_DEFAULT, null, 2));
}

let oifSeq = 0;
function roundTick(px, tick) { return (Math.round(px / tick) * tick).toFixed(tick < 0.25 ? 1 : 2); }

// "MNQ1! MSB PURE dir 1 | entry 29940.00 | stop 29900.00 | risk 40.00 pts | T1 29980.00 | T2 30140.00 | room 5.0R"
function tryAutotrade(text) {
  if (!auto.enabled) return;
  const m = text.match(/^(\S+)\s+MSB PURE dir (-?1)(?:\.0+)?\s*\|/);
  if (!m) return;                                   // not a PURE signal — ignore
  const inst = auto.instruments[m[1]];
  if (!inst) { console.log("✗ autotrade: no instrument mapping for " + m[1]); return; }
  const num = re => { const g = text.match(re); return g ? parseFloat(g[1]) : NaN; };
  const entrySide = m[2] === "1";
  const stop = num(/stop\s+([\d.]+)/i);
  const t1   = num(/T1\s+([\d.]+)/);
  const t2   = num(/T2\s+([\d.]+)/);
  if (!(stop > 0 && t1 > 0 && t2 > 0)) { console.log("✗ autotrade: bad numbers in alert"); return; }

  const qty  = Math.max(2, auto.contracts);
  const half = Math.floor(qty / 2);
  const rest = qty - half;
  const buy  = entrySide ? "BUY" : "SELL";
  const sell = entrySide ? "SELL" : "BUY";
  const S = roundTick(stop, inst.tick), P1 = roundTick(t1, inst.tick), P2 = roundTick(t2, inst.tick);
  const id = Date.now().toString(36);

  // ATI order-instruction format:
  // COMMAND;ACCOUNT;INSTRUMENT;ACTION;QTY;ORDER TYPE;LIMIT;STOP;TIF;OCO ID;ORDER ID;;
  const lines = [
    `PLACE;${auto.account};${inst.name};${buy};${qty};MARKET;;;GTC;;${id}E;;`,
    `PLACE;${auto.account};${inst.name};${sell};${half};LIMIT;${P1};;GTC;${id}A;${id}T1;;`,
    `PLACE;${auto.account};${inst.name};${sell};${half};STOPMARKET;;${S};GTC;${id}A;${id}S1;;`,
    `PLACE;${auto.account};${inst.name};${sell};${rest};LIMIT;${P2};;GTC;${id}B;${id}T2;;`,
    `PLACE;${auto.account};${inst.name};${sell};${rest};STOPMARKET;;${S};GTC;${id}B;${id}S2;;`
  ];
  const file = path.join(auto.incoming, "oif" + (++oifSeq) + "." + id + ".txt");
  try {
    fs.writeFileSync(file, lines.join("\r\n") + "\r\n");
    console.log("🤖 AUTOTRADE → " + auto.account + "  " + inst.name + "  " + buy + " " + qty +
      "  stop " + S + "  T1 " + P1 + "  T2 " + P2);
  } catch (e) {
    console.log("✗ autotrade: could not write to " + auto.incoming);
    console.log("  Is NinjaTrader running with the AT interface enabled?  (" + e.message + ")");
  }
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
  if (req.method === "POST" && url.startsWith("/hook/")) {
    res.writeHead(403); res.end();
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
});

server.listen(PORT, () => {
  console.log("");
  console.log("  ┌─────────────────────────────────────────────────────────────┐");
  console.log("  │  MSB ALERT RELAY is running                                 │");
  console.log("  └─────────────────────────────────────────────────────────────┘");
  console.log("");
  console.log("  Your grader:      http://localhost:" + PORT);
  console.log("  Webhook path:     /hook/" + secret);
  console.log("");
  console.log("  To let TradingView reach it, run your tunnel in another window:");
  console.log("      ngrok http " + PORT);
  console.log("  then in the TradingView alert's Notifications tab, set Webhook URL to:");
  console.log("      https://YOUR-NGROK-DOMAIN/hook/" + secret);
  console.log("");
  console.log("  Keep this window open during the session. Ctrl+C to stop.");
  console.log("");
});
