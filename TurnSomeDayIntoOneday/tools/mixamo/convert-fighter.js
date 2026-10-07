const {chromium}=require('/opt/node22/lib/node_modules/playwright');const fs=require('fs');const S=__dirname;
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader']});
const pg=await b.newPage();pg.on('pageerror',e=>console.log('PAGEERR',e.message));
await pg.addInitScript(()=>{window.RATIO=0.16;window.TEX=160;});
for(const f of ['Ch19_nonPBR','Ch03_nonPBR','Ch18_nonPBR','claire','kaya','passive_marker_man']){
  await pg.goto('file://'+S+'/conv-fighter.html');await pg.waitForFunction(()=>window.READY,{timeout:60000});
  const r=await pg.evaluate(f=>window.convert(f),f);console.log(JSON.stringify(r));
  fs.writeFileSync(S+'/fighters/'+f+'.glb',Buffer.from(await pg.evaluate(()=>window.B64),'base64'));}
await b.close();})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
