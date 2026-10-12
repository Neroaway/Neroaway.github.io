// Keep arrowheads on the segment and outside node circles, even after dragging.
export function edgeEndpoints(source, target, sourceRadius, targetRadius) {
  const dx=target.x-source.x, dy=target.y-source.y;
  const length=Math.hypot(dx,dy);
  if(length<.001)return {x1:source.x,y1:source.y,x2:target.x,y2:target.y};
  const start=Math.min(sourceRadius+5,length*.45),end=Math.min(targetRadius+5,length*.45);
  return {x1:source.x+dx/length*start,y1:source.y+dy/length*start,x2:target.x-dx/length*end,y2:target.y-dy/length*end};
}
