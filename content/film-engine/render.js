const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const out=process.argv[3];
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await(await b.newContext({viewport:{width:1080,height:1920},deviceScaleFactor:1})).newPage();
await p.goto('file://'+__dirname+'/film.html#'+encodeURIComponent(JSON.stringify(data)));
await p.waitForTimeout(300);
const len=await p.evaluate(()=>window.FILM_LEN);
const fps=30, frames=Math.round(len/1000*fps);
for(let i=0;i<frames;i++){
  await p.evaluate(ms=>window.seek(ms), i*1000/fps);
  await p.screenshot({path:out+'/f'+String(i).padStart(4,'0')+'.png'});
}
console.log('frames',frames,'len',Math.round(len));
await b.close();
})();
