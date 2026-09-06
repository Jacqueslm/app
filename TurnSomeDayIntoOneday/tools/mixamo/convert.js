const {chromium}=require('/opt/node22/lib/node_modules/playwright');const fs=require('fs');
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader']});
const pg=await b.newPage();
pg.on('pageerror',e=>console.log('PAGEERR',e.message));pg.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,300))});
await pg.addInitScript(()=>{window.RATIO=0.3;window.FILES=['Fighting Idle','Lead Jab','Hook','Uppercut','Left Block','Right Block','Center Block','Dodging','Stomach Hit','Taking Punch','Knocked Out','Getting Up','Victory'];});
await pg.goto('file:///tmp/claude-0/-home-user-app/453451a7-47bf-524d-b141-0975730740ac/scratchpad/conv.html');
await pg.waitForFunction(()=>window.READY,{timeout:60000});
const r=await pg.evaluate(()=>window.convert());
console.log(JSON.stringify(r,null,1));
const b64=await pg.evaluate(()=>window.B64);
fs.writeFileSync('/tmp/claude-0/-home-user-app/453451a7-47bf-524d-b141-0975730740ac/scratchpad/fighter.glb',Buffer.from(b64,'base64'));
await b.close();
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
