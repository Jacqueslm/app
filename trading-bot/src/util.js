'use strict';

const fs = require('fs');
const path = require('path');

function round(n, d = 2) {
  const m = 10 ** d;
  return Math.round((n + Number.EPSILON) * m) / m;
}

function pct(a, b) {
  if (!a) return 0;
  return (b - a) / a * 100;
}

function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function saveJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Tiny .env loader so the bot has zero install dependencies.
function loadEnv(file) {
  const out = {};
  try {
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[m[1]] = v;
    }
  } catch (_) { /* no .env file */ }
  return out;
}

function fmtTime(t) {
  if (t == null) return '-';
  return new Date(t).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function fmtMoney(n) {
  const sign = n >= 0 ? '+' : '';
  return sign + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPrice(n) {
  if (n == null) return '-';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

module.exports = { round, pct, loadJson, saveJson, loadEnv, fmtTime, fmtMoney, fmtPrice };
