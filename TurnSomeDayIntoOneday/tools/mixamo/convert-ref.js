const {chromium}=require('/opt/node22/lib/node_modules/playwright');const fs=require('fs');
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader']});
const pg=await b.newPage();
pg.on('pageerror',e=>console.log('PAGEERR',e.message));pg.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('CONSOLE',m.text().slice(0,300))});
await pg.addInitScript(()=>{window.RATIO=0.35;window.TEX=512;window.BASE='character';window.FILES=['Standing Idle','Counting','Walking','Talking','Waving','Hand Raising'];});
await pg.goto('file://'+__dirname+'/convert-ref.html');
await pg.waitForFunction(()=>window.READY,{timeout:60000});
const r=await pg.evaluate(()=>window.convert());
console.log(JSON.stringify(r,null,1));
const b64=await pg.evaluate(()=>window.B64);
fs.writeFileSync(__dirname+'/ref.glb',Buffer.from(b64,'base64'));
await b.close();
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
