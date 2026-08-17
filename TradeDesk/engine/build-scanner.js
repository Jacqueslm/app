'use strict';
/* Bakes the engine into a self-contained scanner.html — no server, no fetch. */
const fs = require('fs'), path = require('path');
const strip = f => fs.readFileSync(path.join(__dirname, f), 'utf8')
  .replace(/^'use strict';/, '')
  .replace(/const S = require\('\.\/structure'\);/, '')
  .replace(/if\(typeof module[\s\S]*?module\.exports = \{[^}]*\};/g, '')
  .replace(/module\.exports = \{[\s\S]*?\};\s*$/, '');

const engine = `
${strip('structure.js')}
const Structure = API;
const Resample = (function(){ ${strip('resample.js')} return {resample, resampleDaily}; })();
const Align = (function(){ const S = Structure; ${strip('align.js')}
  return {align, findSetups, findPullbacks, evaluate, evaluateToLevel, evaluateFraction,
          barDuration, lastClosedAt}; })();
const Csv = (function(){
  ${fs.readFileSync(path.join(__dirname,'csv.js'),'utf8')
      .replace(/^'use strict';/,'').replace(/const fs = require\('fs'\);/,'')
      .replace(/const load = [\s\S]*?$/m,'').replace(/module\.exports[\s\S]*$/,'')}
  return {parse, audit, ET};
})();
const Gaps = (function(){ ${strip('gaps.js')} return {create, update, detect, openAt, displacedBy}; })();
const Loop = (function(){ ${strip('loop.js')} return {create, tick, DEFAULTS}; })();
const LiveSetup = (function(){ ${strip('setup-live.js')} return {liveState}; })();
`;

const out = fs.readFileSync(path.join(__dirname,'scanner-template.html'),'utf8')
  .replace('/*__ENGINE__*/', engine);
fs.writeFileSync(path.join(__dirname,'..','scanner.html'), out);
console.log(`scanner.html  ${(out.length/1024).toFixed(0)} KB`);
