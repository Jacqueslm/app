const {chromium}=require('playwright');
const path=require('path');
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
for(const f of process.argv.slice(2)){
  const p=await(await b.newContext()).newPage();
  await p.goto('file://'+path.resolve(f),{waitUntil:'networkidle'});
  await p.waitForTimeout(900);
  const out=f.replace(/\.html$/,'.pdf');
  await p.pdf({path:out,format:'Letter',printBackground:true,margin:{top:'0',bottom:'0',left:'0',right:'0'}});
  console.log('->',out);
  await p.close();
}
await b.close();})();
