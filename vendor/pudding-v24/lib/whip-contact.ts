import type {XY} from './whip-rope';
export function convexHull(input:XY[]):XY[]{
 const p=[...input].sort((a,b)=>a.x-b.x||a.y-b.y);
 if(p.length<3)return p;
 const cross=(a:XY,b:XY,c:XY)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 const lower:XY[]=[],upper:XY[]=[];
 for(const q of p){while(lower.length>1&&cross(lower[lower.length-2],lower[lower.length-1],q)<=0)lower.pop();lower.push(q);}
 for(let i=p.length-1;i>=0;i--){const q=p[i];while(upper.length>1&&cross(upper[upper.length-2],upper[upper.length-1],q)<=0)upper.pop();upper.push(q);}
 lower.pop();upper.pop();return lower.concat(upper);
}
export function insideHull(p:XY,hull:XY[]){
 if(hull.length<3)return false;
 for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length];if((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)<0)return false;}
 return true;
}
export function ropeContacts(points:XY[],previous:XY[],dt:number,hull:XY[]){
 const candidates:{x:number;y:number;vx:number;vy:number;speed:number}[]=[];
 let touching=false;
 const test=(x:number,y:number,vx:number,vy:number,current:boolean)=>{
 if(!insideHull({x,y},hull))return;
 if(current)touching=true;
 const speed=Math.hypot(vx,vy);if(speed>=160)candidates.push({x,y,vx,vy,speed});
 };
 // Test the entire line, excluding the handle anchor itself.
 for(let i=1;i<points.length;i++){
 const a=points[i-1],b=points[i],pa=previous[i-1],pb=previous[i];
 const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/5));
 for(let j=1;j<=count;j++){const t=j/count,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;test(x,y,(x-pa.x-(pb.x-pa.x)*t)/dt,(y-pa.y-(pb.y-pa.y)*t)/dt,true);}
 // Sweep moving nodes between frames so fast tip movement cannot tunnel through.
 const steps=Math.min(200,Math.max(1,Math.ceil(Math.hypot(b.x-pb.x,b.y-pb.y)/4)));
 for(let j=1;j<=steps;j++){const t=j/steps;test(pb.x+(b.x-pb.x)*t,pb.y+(b.y-pb.y)*t,(b.x-pb.x)/dt,(b.y-pb.y)/dt,false);}
 }
 candidates.sort((a,b)=>b.speed-a.speed);return {touching,candidates};
}
