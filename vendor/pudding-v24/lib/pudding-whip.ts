// Whooshes follow hand movement, not residual rope motion.
export class WhipSwingGate {
  private lastSound=-Infinity;
  private lastUpdate:number|null=null;
  private distance=0;
  reset(){this.lastUpdate=null;this.distance=0;}
  update(now:number,vx:number,vy:number){
    const speed=Math.hypot(vx,vy),dt=this.lastUpdate===null?0:Math.min(50,Math.max(0,now-this.lastUpdate))/1000;
    this.lastUpdate=now;
    if(speed<300)this.distance=0;
    else this.distance+=speed*dt;
    if(speed<1100||this.distance<90||now-this.lastSound<400)return false;
    this.lastSound=now;this.distance=0;return true;
  }
}
