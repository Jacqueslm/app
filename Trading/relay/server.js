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
