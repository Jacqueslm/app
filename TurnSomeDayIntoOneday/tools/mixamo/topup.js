const {chromium}=require('/opt/node22/lib/node_modules/playwright');const fs=require('fs');const S=__dirname;
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader']});
const pg=await b.newPage();pg.on('pageerror',e=>console.log('PAGEERR',e.message));
const names=['Ch19_nonPBR','Ch03_nonPBR','Ch18_nonPBR','Ch29_nonPBR','passive_marker_man'];
for(let i=0;i<names.length;i++){await pg.goto('file://'+S+'/topup.html');await pg.waitForFunction(()=>window.READY,null,{timeout:120000});
 const r=await pg.evaluate(f=>window.topup(f),names[i]);console.log(JSON.stringify(r));
 fs.writeFileSync(S+'/fighters/f'+(i+1)+'.glb',Buffer.from(await pg.evaluate(()=>window.B64),'base64'));}
await b.close();})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
