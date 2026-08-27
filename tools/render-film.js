// Render a seek(ms) film page to numbered PNG frames.
//   node tools/render-film.js source.html outdir [fps] [onlyFrames,csv]
// The page must set window.FILM_LEN (ms) and window.seek(ms).
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
(async()=>{
const src=path.resolve(process.argv[2]), out=path.resolve(process.argv[3]);
const fps=Number(process.argv[4]||30);
const only=process.argv[5]?process.argv[5].split(',').map(Number):null;
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await(await b.newContext({viewport:{width:1080,height:1920},deviceScaleFactor:1})).newPage();
await p.goto('file://'+src);
await p.waitForTimeout(300);
const len=await p.evaluate(()=>window.FILM_LEN);
const frames=Math.round(len/1000*fps);
const list=only||Array.from({length:frames},(_,i)=>i);
for(const i of list){
  await p.evaluate(ms=>window.seek(ms), i*1000/fps);
  await p.screenshot({path:path.join(out,'f'+String(i).padStart(4,'0')+'.png')});
}
console.log('frames',list.length,'of',frames,'len',len);
await b.close();
})();
