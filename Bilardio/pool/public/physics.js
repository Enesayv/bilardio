// Paylaşılan fizik: sunucu (Node) ve tarayıcı aynı kodu çalıştırır.
(function(){
const W=1000,H=500,R=12,DT=1/120,MAXV=1800;
const PK=[[0,0,30],[W/2,-10,28],[W,0,30],[0,H,30],[W/2,H+10,28],[W,H,30]]; // x,y,yakalama yarıçapı
function rack(){
  const b=[{id:0,x:250,y:H/2}],pos=[];
  const ids=[1,2,3,4,5,6,7,9,10,11,12,13,14,15].sort(()=>Math.random()-.5);
  for(let c=0;c<5;c++)for(let r=0;r<=c;r++)pos.push([700+c*R*1.74,H/2+(r-c/2)*(2*R+.2)]);
  ids.splice(4,0,8); // 8 numara üçgenin ortasında
  pos.forEach((p,i)=>b.push({id:ids[i],x:p[0],y:p[1]}));
  b.sort((x,y)=>x.id-y.id).forEach(o=>{o.vx=0;o.vy=0;o.in=false});
  return b;
}
function hit(b,a,p){b[0].vx=Math.cos(a)*p*MAXV;b[0].vy=Math.sin(a)*p*MAXV}
function moving(b){return b.some(o=>!o.in&&(o.vx||o.vy))}
function step(b,dt,ev){
  const snd=ev.on||(()=>{});
  for(const o of b){
    if(o.in)continue;
    o.x+=o.vx*dt;o.y+=o.vy*dt;
    const s=Math.hypot(o.vx,o.vy);
    if(s>0){
      if(s<6){o.vx=o.vy=0}
      else{const k=(s-Math.min(s,(70+.5*s)*dt))/s;o.vx*=k;o.vy*=k}
    }
    if(o.x<R){o.x=R;if(o.vx<0){snd(-o.vx*.6);o.vx=-o.vx*.75}}
    else if(o.x>W-R){o.x=W-R;if(o.vx>0){snd(o.vx*.6);o.vx=-o.vx*.75}}
    if(o.y<R){o.y=R;if(o.vy<0){snd(-o.vy*.6);o.vy=-o.vy*.75}}
    else if(o.y>H-R){o.y=H-R;if(o.vy>0){snd(o.vy*.6);o.vy=-o.vy*.75}}
    for(const p of PK)if(Math.hypot(o.x-p[0],o.y-p[1])<p[2]){o.in=true;o.vx=o.vy=0;ev.pocketed.push(o.id);snd(260);break}
  }
  for(let i=0;i<16;i++){
    const a=b[i];if(a.in)continue;
    for(let j=i+1;j<16;j++){
      const c=b[j];if(c.in)continue;
      const dx=c.x-a.x,dy=c.y-a.y,d2=dx*dx+dy*dy;
      if(d2>=4*R*R||d2===0)continue;
      const d=Math.sqrt(d2),nx=dx/d,ny=dy/d,ov=(2*R-d)/2;
      a.x-=nx*ov;a.y-=ny*ov;c.x+=nx*ov;c.y+=ny*ov;
      const vn=(c.vx-a.vx)*nx+(c.vy-a.vy)*ny;
      if(vn<0){
        const k=-(1+.95)*vn/2;
        a.vx-=k*nx;a.vy-=k*ny;c.vx+=k*nx;c.vy+=k*ny;
        if(i===0&&ev.first==null)ev.first=j;
        snd(-vn);
      }
    }
  }
}
const P={W,H,R,DT,MAXV,PK,rack,hit,moving,step};
if(typeof module!=='undefined')module.exports=P;else window.Phys=P;
})();
