// Çalıştır: npm install && node server.js   (PORT ortam değişkeni ile port seçilir)
const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer}=require('ws');
const P=require('./public/physics.js');
const {W,H,R,DT}=P,PUB=path.join(__dirname,'public'),rooms=new Map();
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const grp=id=>id===8?'8':id<8?'s':'t'; // s: düz 1-7, t: çizgili 9-15

const srv=http.createServer((q,r)=>{
  let f=q.url.split('?')[0];if(f==='/')f='/index.html';
  const fp=path.join(PUB,f);
  if(!fp.startsWith(PUB)){r.writeHead(403);return r.end()}
  fs.readFile(fp,(e,d)=>{
    if(e){r.writeHead(404);return r.end('404')}
    r.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'application/octet-stream'});r.end(d);
  });
});
const wss=new WebSocketServer({server:srv});

const newGame=()=>({balls:P.rack(),turn:0,groups:[null,null],bih:false,winner:-1,lock:0,msg:''});
const snap=g=>({balls:g.balls.map(o=>[+o.x.toFixed(2),+o.y.toFixed(2),o.in?1:0]),turn:g.turn,groups:g.groups,bih:g.bih,winner:g.winner,msg:g.msg});

// Vuruşu sunucuda simüle eder ve kuralları uygular (sunucu yetkili).
function play(g,a,p,cue){
  const b=g.balls,me=g.turn,op=1-me,mine=g.groups[me];
  const cleared=!!mine&&!b.some(o=>o.id>0&&o.id!==8&&!o.in&&grp(o.id)===mine);
  if(g.bih){b[0].x=cue[0];b[0].y=cue[1]}
  b[0].in=false;P.hit(b,a,p);
  const ev={pocketed:[],first:null};let t=0;
  while(P.moving(b)&&t<40){P.step(b,DT,ev);t+=DT}
  b.forEach(o=>{o.vx=o.vy=0});
  const pk=ev.pocketed,real=pk.filter(i=>i>0);
  const target=mine?(cleared?'8':mine):null;
  let foul=pk.includes(0),msg='';
  if(ev.first==null){foul=true;msg='Faul: hiçbir topa değmedi. '}
  else if(target?grp(ev.first)!==target:ev.first===8){foul=true;msg='Faul: yanlış topa vurdun. '}
  else if(pk.includes(0))msg='Faul: beyaz top cebe girdi. ';
  if(real.includes(8)){
    g.winner=(foul||!cleared)?op:me;
    msg+=(foul||!cleared)?'8 numara erken ya da faulle girdi.':'8 numara cebe girdi.';
  }else{
    if(!mine&&!foul&&real.length){g.groups[me]=grp(real[0]);g.groups[op]=g.groups[me]==='s'?'t':'s'}
    const own=g.groups[me]&&real.some(i=>grp(i)===g.groups[me]);
    g.bih=false;
    if(foul){g.turn=op;g.bih=true;msg+='Rakip beyaz topu istediği yere koyabilir.'}
    else if(!own){g.turn=op}
    else msg='Devam et.';
  }
  if(pk.includes(0)){b[0].in=false;b[0].x=250;b[0].y=H/2}
  g.msg=msg;g.lock=Date.now()+t*1000+400;
}

wss.on('connection',(ws,req)=>{
  const id=(new URL(req.url,'http://x').searchParams.get('room')||'lobi').replace(/[^\w-]/g,'').slice(0,24)||'lobi';
  if(!rooms.has(id))rooms.set(id,{pl:[null,null],spec:new Set(),g:newGame()});
  const rm=rooms.get(id);
  const me=rm.pl[0]===null?0:rm.pl[1]===null?1:-1;
  if(me>=0)rm.pl[me]=ws;else rm.spec.add(ws);
  const all=()=>[...rm.pl,...rm.spec].filter(Boolean);
  const send=(c,o)=>c.readyState===1&&c.send(JSON.stringify(o));
  const cast=o=>all().forEach(c=>send(c,o));
  const status=()=>cast({t:'st',n:rm.pl.filter(Boolean).length});
  send(ws,{t:'init',you:me,s:snap(rm.g)});status();

  ws.on('message',raw=>{
    let m;try{m=JSON.parse(raw)}catch{return}
    const g=rm.g;
    if(m.t==='shot'){
      if(me!==g.turn||g.winner>=0||Date.now()<g.lock||!rm.pl[0]||!rm.pl[1])return;
      const a=+m.a,p=+m.p;
      if(!isFinite(a)||!isFinite(p)||p<=0)return;
      let cue=null;
      if(g.bih){
        cue=m.cue;
        if(!Array.isArray(cue)||cue.length!==2||!cue.every(Number.isFinite)||cue[0]<R||cue[0]>W-R||cue[1]<R||cue[1]>H-R)return;
        if(g.balls.some(o=>o.id&&!o.in&&Math.hypot(o.x-cue[0],o.y-cue[1])<2*R))return;
      }
      const pw=Math.min(1,p);
      play(g,a,pw,cue);
      cast({t:'shot',a,p:pw,cue,s:snap(g)});
    }else if(m.t==='rematch'&&g.winner>=0&&me>=0){
      rm.g=newGame();
      all().forEach(c=>send(c,{t:'init',you:c===rm.pl[0]?0:c===rm.pl[1]?1:-1,s:snap(rm.g)}));
    }
  });
  ws.on('close',()=>{
    if(me>=0)rm.pl[me]=null;else rm.spec.delete(ws);
    if(!all().length)rooms.delete(id);else status();
  });
});
srv.listen(process.env.PORT||3000,()=>console.log('Bilardo sunucusu hazır: http://localhost:'+(process.env.PORT||3000)));
