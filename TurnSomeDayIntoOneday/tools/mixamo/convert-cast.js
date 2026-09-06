const {chromium}=require('/opt/node22/lib/node_modules/playwright');const fs=require('fs');const S=__dirname;
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader']});
const pg=await b.newPage();pg.on('pageerror',e=>console.log('PAGEERR',e.message));
for(const noanim of [false,true]){
  await pg.addInitScript(na=>{window.RATIO=0.2;window.TEX=192;window.DIR='./chars2/';window.MOVES='./ref-inplace.glb';window.NOANIM=na;},noanim);
  for(const [f,out] of [['Ch33_nonPBR','announcer'],['Peasant Girl','ringgirl']]){
    await pg.goto('file://'+S+'/conv-cast.html');await pg.waitForFunction(()=>window.READY,{timeout:60000});
    const r=await pg.evaluate(f=>window.convert(f),f);console.log(noanim?'body':'full',JSON.stringify(r));
    fs.writeFileSync(S+'/chars2/'+out+(noanim?'-body':'')+'.glb',Buffer.from(await pg.evaluate(()=>window.B64),'base64'));}}
await b.close();})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
