// Bigger-text QA sweep: open every screen and full-screen overlay at 412x915
// with fontSize:'bigger', and verify the content's top and bottom can actually
// be scrolled into view. Run against a local server:
//   node tools/bigtext-audit.js [http://localhost:3000]
// Requires playwright on NODE_PATH. Exits 1 if anything is unreachable.
const {chromium}=require('playwright');
const BASE=process.argv[2]||'http://localhost:3000';
const EXE=process.env.PW_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
(async()=>{
const b=await chromium.launch({executablePath:EXE});
const pg=await(await b.newContext({viewport:{width:412,height:915}})).newPage();
await pg.goto(BASE+'/app');
await pg.evaluate(()=>{
  const S=JSON.parse(localStorage.getItem('tsid_v2')||'{}');
  Object.assign(S,{onboarded:true,isPro:true,name:'QA',fontSize:'bigger',seenWelcome:true,
    selectedAddictions:['Porn & Sex','Food / Binging'],currentAddiction:'Porn & Sex',
    faithPath:'yes',startDate:new Date(Date.now()-8*864e5).toISOString(),
    lessonProgress:{'Porn & Sex':9,'Food / Binging':9}});
  localStorage.setItem('tsid_v2',JSON.stringify(S));
});
await pg.goto(BASE+'/app');await pg.waitForTimeout(900);
await pg.evaluate(()=>enterApp());await pg.waitForTimeout(1200);
await pg.evaluate(()=>{document.querySelectorAll('#welcome-overlay,#morning-sheet,.sos-sheet').forEach(e=>e.style.display='none');});
const problems=[];
// 1) every main screen: bottom of last visible element reachable
const screens=await pg.evaluate(()=>[...document.querySelectorAll('.screen')].map(e=>e.id).filter(Boolean));
for(const id of screens){
  const p=await pg.evaluate((id)=>{
    try{switchTo(id.replace(/^scr-/,''));}catch(e){}
    const scr=document.getElementById('screens');
    const el=document.getElementById(id);
    if(!el||el.offsetParent===null)return null;
    scr.scrollTop=scr.scrollHeight;
    const els=[...el.querySelectorAll('button,.setting-row,.log-btn,input,textarea,select')].filter(x=>x.offsetParent!==null);
    const last=els[els.length-1];
    if(!last)return null;
    const r=last.getBoundingClientRect();
    const limit=window.innerHeight+2;
    return r.bottom>limit?{id,kind:'screen-bottom',bottom:Math.round(r.bottom),limit:Math.round(limit)}:null;
  },id);
  if(p)problems.push(p);
}
// 2) every fixed overlay: top and bottom reachable
const overlays=await pg.evaluate(()=>[...document.querySelectorAll('div[id]')].filter(e=>{
  const st=e.getAttribute('style')||'';return st.includes('position:fixed')&&st.includes('inset:0');
}).map(e=>e.id));
for(const id of overlays){
  const p=await pg.evaluate((id)=>{
    const ov=document.getElementById(id);
    const prev=ov.style.display;
    ov.style.display=ov.style.display==='none'?(getComputedStyle(ov).flexDirection?'flex':'block'):prev;
    ov.scrollTop=0;
    const kids=[...ov.querySelectorAll('*')].filter(x=>x.offsetParent!==null&&x.getBoundingClientRect().height>8);
    let bad=null;
    if(kids.length){
      const first=kids[0].getBoundingClientRect();
      if(first.top<-2&&ov.scrollTop===0)bad={id,kind:'overlay-top-clipped',top:Math.round(first.top)};
      ov.scrollTop=ov.scrollHeight;
      const last=kids[kids.length-1].getBoundingClientRect();
      const limit=window.innerHeight+2;
      if(!bad&&last.bottom>limit+4)bad={id,kind:'overlay-bottom-clipped',bottom:Math.round(last.bottom),limit:Math.round(limit)};
    }
    ov.style.display=prev;
    return bad;
  },id);
  if(p)problems.push(p);
}
console.log(problems.length?JSON.stringify(problems,null,1):'ALL CLEAR - every screen and overlay fits at Bigger text');
await b.close();
process.exit(problems.length?1:0);
})();
