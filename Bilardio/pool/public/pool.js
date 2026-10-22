// İstemci: çizim, girdi ve WebSocket. Siteye gömmek için: window.POOL_WS = 'wss://oyun.siteniz.com' tanımlayın.
(()=>{
const {W,H,R,PK,DT,step,moving,hit}=Phys,M=50,CW=W+2*M,CH=H+2*M;
const $=i=>document.getElementById(i),cv=$('c'),ctx=cv.getContext('2d');
const COL=['#fff','#f2c200','#1a5fd0','#d8321f','#6a2d9a','#f07a12','#1b8f3f','#8e1b1b'];
const colr=i=>i===8?'#141414':COL[(i-1)%8+1];
const G={s:'düz (1-7)',t:'çizgili (9-15)'};
let S={balls:[],me:-1,turn:0,groups:[null,null],bih:false,winner:-1,n:0,msg:'Bağlanıyor…'};
let pend=null,ev=null,ws,drag=null,ac,simT=0;

const room=new URLSearchParams(location.search).get('room')||Math.random().toString(36).slice(2,8);
if(!/[?&]room=/.test(location.search))history.replaceState(0,'','?room='+room);

function load(s){
  S.balls=s.balls.map((a,i)=>({id:i,x:a[0],y:a[1],in:!!a[2],vx:0,vy:0}));
  Object.assign(S,{turn:s.turn,groups:s.groups,bih:s.bih,winner:s.winner,msg:s.msg||''});
}
function connect(){
  ws=new WebSocket((window.POOL_WS||(location.protocol==='https:'?'wss://':'ws://')+location.host)+'/?room='+room);
  ws.onmessage=e=>{
    const m=JSON.parse(e.data);
    if(m.t==='init'){S.me=m.you;pend=null;load(m.s)}
    else if(m.t==='st')S.n=m.n;
    else if(m.t==='shot'){
      if(pend){load(pend);pend=null}
      const c=S.balls[0];
      if(m.cue){c.x=m.cue[0];c.y=m.cue[1]}
      c.in=false;hit(S.balls,m.a,m.p);
      pend=m.s;ev={pocketed:[],on:snd};simT=0;S.msg='';
    }
  };
  ws.onclose=()=>{S.msg='Bağlantı koptu, yeniden deneniyor…';setTimeout(connect,2000)};
}
function snd(v){
  try{
    if(!ac)return;const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();
    o.type='triangle';o.frequency.value=170+Math.min(v,700)/3;
    g.gain.setValueAtTime(Math.min(.3,v/2200),t);g.gain.exponentialRampToValueAtTime(.001,t+.09);
    o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+.1);
  }catch(_){}
}

// ---- girdi: beyaz topun arkasından geri çek ve bırak ----
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const canShoot=()=>S.me>=0&&S.me===S.turn&&!pend&&S.winner<0&&S.n>=2;
const pt=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width*CW-M,(e.clientY-r.top)/r.height*CH-M]};
const valid=()=>{const c=S.balls[0];return c.x>=R&&c.x<=W-R&&c.y>=R&&c.y<=H-R&&S.balls.every(o=>!o.id||o.in||Math.hypot(o.x-c.x,o.y-c.y)>=2*R)};
cv.onpointerdown=e=>{
  ac=ac||new (window.AudioContext||window.webkitAudioContext)();ac.resume();
  if(!canShoot())return;
  cv.setPointerCapture(e.pointerId);
  const p=pt(e),c=S.balls[0];
  drag=S.bih&&Math.hypot(p[0]-c.x,p[1]-c.y)<30?{mv:1}:{p};
};
cv.onpointermove=e=>{
  if(!drag)return;const p=pt(e);
  if(drag.mv){const c=S.balls[0];c.x=clamp(p[0],R,W-R);c.y=clamp(p[1],R,H-R)}else drag.p=p;
};
cv.onpointerup=()=>{
  if(!drag)return;const d=drag;drag=null;if(d.mv||!canShoot())return;
  const c=S.balls[0],dx=c.x-d.p[0],dy=c.y-d.p[1],L=Math.hypot(dx,dy);
  if(L<25||(S.bih&&!valid()))return;
  ws.send(JSON.stringify({t:'shot',a:Math.atan2(dy,dx),p:Math.min(1,L/260),cue:S.bih?[c.x,c.y]:undefined}));
};
$('cp').onclick=()=>navigator.clipboard&&navigator.clipboard.writeText(location.href);
$('rm').onclick=()=>ws.send('{"t":"rematch"}');

// ---- çizim ----
function circ(x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,7)}
function ball(id,x,y,r){
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='rgba(0,0,0,.35)';circ(2.5,3.5,r);ctx.fill();
  circ(0,0,r);ctx.clip();
  ctx.fillStyle=id>8?'#f4efe2':colr(id);ctx.fillRect(-r,-r,2*r,2*r);
  if(id>8){ctx.fillStyle=colr(id);ctx.fillRect(-r,-r*.55,2*r,r*1.1)}
  if(id>0){
    ctx.fillStyle='#f4efe2';circ(0,0,r*.48);ctx.fill();
    ctx.fillStyle='#111';ctx.font='bold '+r*.66+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(id,0,r*.04);
  }
  const g=ctx.createRadialGradient(-r*.35,-r*.4,r*.05,0,0,r);
  g.addColorStop(0,'rgba(255,255,255,.6)');g.addColorStop(.35,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,.4)');
  ctx.fillStyle=g;ctx.fillRect(-r,-r,2*r,2*r);ctx.restore();
}
function aim(a){
  const c=S.balls[0],dx=Math.cos(a),dy=Math.sin(a);let best=1e9,hb=null;
  for(const o of S.balls){
    if(!o.id||o.in)continue;
    const fx=o.x-c.x,fy=o.y-c.y,pr=fx*dx+fy*dy;if(pr<=0)continue;
    const d2=fx*fx+fy*fy-pr*pr;if(d2>=4*R*R)continue;
    const t=pr-Math.sqrt(4*R*R-d2);if(t<best){best=t;hb=o}
  }
  const tw=Math.min(dx>0?(W-R-c.x)/dx:dx<0?(R-c.x)/dx:1e9,dy>0?(H-R-c.y)/dy:dy<0?(R-c.y)/dy:1e9);
  return tw<best?[tw,null]:[best,hb];
}
function draw(){
  const dpr=window.devicePixelRatio||1;
  if(cv.width!==Math.round(CW*dpr)){cv.width=Math.round(CW*dpr);cv.height=Math.round(CH*dpr)}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  let g=ctx.createLinearGradient(0,0,0,CH);g.addColorStop(0,'#5a3820');g.addColorStop(.5,'#3d2414');g.addColorStop(1,'#2a180c');
  ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(0,0,CW,CH,30);ctx.fill();
  g=ctx.createRadialGradient(M+W/2,M+H/2,40,M+W/2,M+H/2,W*.62);g.addColorStop(0,'#1f8f56');g.addColorStop(1,'#0c5232');
  ctx.fillStyle=g;ctx.fillRect(M,M,W,H);
  ctx.save();ctx.translate(M,M);
  ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(250,0);ctx.lineTo(250,H);ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.18)';circ(250,H/2,3);ctx.fill();circ(700,H/2,3);ctx.fill();
  for(const p of PK){ctx.fillStyle='#050403';circ(p[0],p[1],p[2]*.78);ctx.fill()}
  ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=10;ctx.strokeRect(-5,-5,W+10,H+10);
  for(const o of S.balls)if(!o.in)ball(o.id,o.x,o.y,R);
  const c=S.balls[0];
  if(c&&canShoot()&&S.bih&&!drag){ctx.strokeStyle=valid()?'#9fe0b0':'#ff7b6b';ctx.lineWidth=2;circ(c.x,c.y,R+5);ctx.stroke()}
  if(drag&&drag.p&&c){
    const dx=c.x-drag.p[0],dy=c.y-drag.p[1],L=Math.hypot(dx,dy);
    if(L>=25){
      const a=Math.atan2(dy,dx),pw=Math.min(1,L/260),[d,h]=aim(a),gx=c.x+Math.cos(a)*d,gy=c.y+Math.sin(a)*d;
      ctx.setLineDash([7,7]);ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(gx,gy);ctx.stroke();ctx.setLineDash([]);
      circ(gx,gy,R);ctx.stroke();
      if(h){const nx=h.x-gx,ny=h.y-gy,nl=Math.hypot(nx,ny);ctx.beginPath();ctx.moveTo(h.x,h.y);ctx.lineTo(h.x+nx/nl*55,h.y+ny/nl*55);ctx.stroke()}
      ctx.save();ctx.translate(c.x,c.y);ctx.rotate(a);
      const off=R+6+pw*70,cg=ctx.createLinearGradient(-off-330,0,-off,0);
      cg.addColorStop(0,'#2e1a0c');cg.addColorStop(.85,'#d9a866');cg.addColorStop(1,'#f3e6c8');
      ctx.fillStyle=cg;ctx.beginPath();ctx.moveTo(-off,-2.5);ctx.lineTo(-off-330,-6.5);ctx.lineTo(-off-330,6.5);ctx.lineTo(-off,2.5);ctx.fill();ctx.restore();
      ctx.fillStyle='#fff';ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.fillText(Math.round(pw*100)+'%',c.x,c.y-R-12);
    }
  }
  ctx.restore();
  let k=0;for(const o of S.balls)if(o.in&&o.id)ball(o.id,M+26+k++*24,CH-M/2,9);
}
function hud(){
  let t=S.msg;
  if(S.n<2)t='Rakip bekleniyor. Davet linkini gönder.';
  else if(S.winner>=0)t=(S.me<0?'Oyun bitti. ':S.winner===S.me?'Kazandın! ':'Kaybettin. ')+S.msg;
  else{
    t=(S.me<0?'Oyuncu '+(S.turn+1)+' oynuyor':S.turn===S.me?'Sıra sende':'Rakibin sırası');
    if(S.me>=0&&S.groups[S.me])t+=' · Topların: '+G[S.groups[S.me]];
    if(S.bih&&S.turn===S.me)t+=' · Beyaz topu sürükleyip yerleştir';
    if(S.msg)t+=' · '+S.msg;
  }
  $('st').textContent=t;$('rm').hidden=!(S.winner>=0&&S.me>=0);
}
let last=performance.now(),acc=0;
function frame(t){
  acc+=Math.min(.05,(t-last)/1000);last=t;
  if(pend){
    while(acc>=DT){
      step(S.balls,DT,ev);acc-=DT;simT+=DT;
      if(!moving(S.balls)||simT>45){load(pend);pend=null;break}
    }
  }else acc=0;
  draw();hud();requestAnimationFrame(frame);
}
connect();requestAnimationFrame(frame);
})();
