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
// 3) Android font-scale mode: the OS "Font size" accessibility setting reaches
// a TWA as a larger root font size. Text sized in px ignores it; text in
// rem/em follows it. Set html to 130%, then flag every visible text element
// whose computed font-size did not move - those are the px holdouts a user
// with large system fonts cannot read. Findings are grouped by tag+class so
// 600 identical declarations read as one line, not six hundred.
const fontScale=await pg.evaluate(()=>{
  const sample=()=>{
    const m=new Map();
    document.querySelectorAll('body *').forEach(e=>{
      if(!e.offsetParent&&e.offsetParent!==document.body)return;
      const hasText=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
      if(!hasText)return;
      const key=e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):'' )+(e.id?'#'+e.id:'');
      m.set(key,parseFloat(getComputedStyle(e).fontSize));
    });
    return m;
  };
  const before=sample();
  document.documentElement.style.fontSize='130%';
  const after=sample();
  document.documentElement.style.fontSize='';
  const frozen=[];
  for(const [k,v] of before){
    const a=after.get(k);
    if(a!==undefined&&Math.abs(a-v)<0.5)frozen.push({sel:k,px:v});
  }
  return frozen;
});
if(fontScale.length){
  problems.push({kind:'px-font-ignores-android-font-scale',count:fontScale.length,
    examples:fontScale.slice(0,12)});
}
// 4) overflow / truncation: at 130% root font, walk every visible element and
// flag text that spills or is clipped by its own box. Scroll containers
// (overflow auto/scroll) are fine - clipping is what they are for.
await pg.evaluate(()=>{document.documentElement.style.fontSize='130%';});
await pg.waitForTimeout(400);
for(const id of screens){
  const found=await pg.evaluate((id)=>{
    try{switchTo(id.replace(/^scr-/,''));}catch(e){}
    const el=document.getElementById(id);
    if(!el||el.offsetParent===null)return [];
    const bad=[];
    el.querySelectorAll('*').forEach(e=>{
      if(e.offsetParent===null)return;
      const cs=getComputedStyle(e);
      if(/(auto|scroll)/.test(cs.overflowY)||/(auto|scroll)/.test(cs.overflowX))return;
      const hasText=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
      if(!hasText)return;
      const xOver=e.scrollWidth>e.clientWidth+2;
      const yOver=e.scrollHeight>e.clientHeight+2&&cs.overflowY!=='visible';
      const clipped=(cs.overflow==='hidden'||cs.overflowX==='hidden'||cs.textOverflow==='ellipsis');
      if((xOver&&clipped)||yOver){
        bad.push({screen:id,sel:e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(typeof e.className==='string'&&e.className?'.'+e.className.trim().split(/\s+/)[0]:''),
          text:(e.textContent||'').trim().slice(0,40),
          sw:e.scrollWidth,cw:e.clientWidth,sh:e.scrollHeight,ch:e.clientHeight});
      }
    });
    return bad.slice(0,10);
  },id);
  found.forEach(f=>problems.push({kind:'text-overflow',...f}));
}
await pg.evaluate(()=>{document.documentElement.style.fontSize='';});

console.log(problems.length?JSON.stringify(problems,null,1):'ALL CLEAR - every screen and overlay fits at Bigger text, scales with Android font size, and nothing overflows');
await b.close();
process.exit(problems.length?1:0);
})();
