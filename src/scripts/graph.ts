import { select } from 'd3-selection';
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY, type SimulationNodeDatum, type SimulationLinkDatum } from 'd3-force';
import { zoom, zoomIdentity } from 'd3-zoom';
import { drag } from 'd3-drag';
import { edgeEndpoints } from '../lib/graph-geometry.mjs';

import type { GraphNote as Note, GraphLink as Connection } from '../lib/graph-types';
interface GraphData {nodes:Note[];links:Connection[];}
interface Node extends SimulationNodeDatum {id:string;title:string;type:'paper'|'thought'|'topic';note?:Note;degree:number;}
interface Edge extends SimulationLinkDatum<Node> {source:Node;target:Node;topic:boolean;forward:boolean;reverse:boolean;}
const SVG_NS='http://www.w3.org/2000/svg';
function svgElement<K extends keyof SVGElementTagNameMap>(tag:K){return document.createElementNS(SVG_NS,tag);}
function shortTitle(title:string,length=19){return title.length>length?`${title.slice(0,length)}…`:title;}
const noteType=(note:Note)=>note.type==='paper'?'论文阅读':'独立思考';

export async function mountGraph(root:HTMLElement) {
  const canvas=root.querySelector<SVGSVGElement>('.graph-canvas')!;
  const stage=root.querySelector<HTMLElement>('.graph-stage')!;
  const message=root.querySelector<HTMLElement>('[data-graph-message]')!;
  const status=root.querySelector<HTMLElement>('[data-graph-status]')!;
  const compact=root.dataset.compact==='true';
  const search=root.querySelector<HTMLInputElement>('[data-graph-search]');
  const topicFilter=root.querySelector<HTMLSelectElement>('[data-graph-topic]');
  const typeFilter=root.querySelector<HTMLSelectElement>('[data-graph-type]');
  const topicToggle=root.querySelector<HTMLInputElement>('[data-graph-topics]');
  const neighborToggle=root.querySelector<HTMLInputElement>('[data-graph-neighbors]');
  let data:GraphData;
  try {const response=await fetch(root.dataset.index!);if(!response.ok)throw new Error('index');data=await response.json();}
  catch {message.textContent='关系图暂时加载失败，请刷新重试。';status.textContent='你仍可以通过文章列表浏览笔记。';return;}
  const notes=new Map(data.nodes.map(n=>[n.id,n]));
  let selected=compact ? root.dataset.focus ?? '' : new URL(location.href).searchParams.get('focus') ?? '';
  if(!notes.has(selected))selected='';
  if(selected&&neighborToggle)neighborToggle.checked=true;
  const positions=new Map<string,Node>();
  let nodes:Node[]=[],edges:Edge[]=[],width=800,height=500;
  const layer=svgElement('g'),edgeLayer=svgElement('g'),nodeLayer=svgElement('g');layer.append(edgeLayer,nodeLayer);canvas.append(layer);
  const markerId=`arrow-${crypto.randomUUID()}`;
  const defs=svgElement('defs'),marker=svgElement('marker'),arrow=svgElement('path');
  marker.id=markerId;marker.setAttribute('viewBox','0 0 8 8');marker.setAttribute('refX','8');marker.setAttribute('refY','4');marker.setAttribute('markerWidth','8');marker.setAttribute('markerHeight','8');marker.setAttribute('markerUnits','userSpaceOnUse');marker.setAttribute('orient','auto-start-reverse');
  arrow.setAttribute('d','M0,0 L8,4 L0,8 L2,4 Z');arrow.setAttribute('fill','var(--accent)');marker.append(arrow);defs.append(marker);canvas.prepend(defs);
  const radius=(node:Node)=>node.type==='topic'?6:9+Math.min(5,node.degree);
  const svg=select(canvas);
  const zoomBehavior=zoom<SVGSVGElement,unknown>().scaleExtent([.2,4]).extent(()=>[[0,0],[width,height]])
    .on('zoom',event=>layer.setAttribute('transform',event.transform.toString()));
  svg.call(zoomBehavior).on('dblclick.zoom',null);
  const simulation=forceSimulation<Node>().force('charge',forceManyBody().strength(-380))
    .force('collision',forceCollide<Node>(n=>n.type==='topic'?52:88))
    .force('x',forceX<Node>(0).strength(.06)).force('y',forceY<Node>(0).strength(.08))
    .alphaDecay(.06).on('tick',paint);
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

  function neighbors(id:string){const result=new Set([id]);for(const link of data.links){if(link.source===id)result.add(link.target);if(link.target===id)result.add(link.source);}return result;}
  function paint(){
    const lines=edgeLayer.querySelectorAll<SVGLineElement>('line');
    edges.forEach((edge,i)=>{const line=lines[i];if(!line)return;const points=edgeEndpoints({x:edge.source.x??0,y:edge.source.y??0},{x:edge.target.x??0,y:edge.target.y??0},radius(edge.source),radius(edge.target));for(const [key,value] of Object.entries(points))line.setAttribute(key,String(value));});
    const groups=nodeLayer.querySelectorAll<SVGGElement>('.graph-node');
    nodes.forEach((node,i)=>groups[i]?.setAttribute('transform',`translate(${node.x??0},${node.y??0})`));
  }
  function highlight(){
    const nearby=selected?neighbors(selected):new Set<string>();
    nodeLayer.querySelectorAll<SVGGElement>('.graph-node').forEach(element=>{
      const id=element.dataset.id!;element.classList.toggle('is-selected',id===selected);
      element.classList.toggle('is-dimmed',!!selected&&!nearby.has(id)&&!id.startsWith('theme:'));
      const selector=element.querySelector('[role="button"]');selector?.setAttribute('aria-pressed',String(id===selected));
    });
    edges.forEach((edge,i)=>{const line=edgeLayer.children[i];line?.classList.toggle('is-highlighted',edge.source.id===selected||edge.target.id===selected);});
  }
  function details(){
    if(compact)return;
    const title=root.querySelector<HTMLElement>('[data-graph-title]')!;
    const description=root.querySelector<HTMLElement>('[data-graph-description]')!;
    const tags=root.querySelector<HTMLElement>('[data-graph-tags]')!;
    const open=root.querySelector<HTMLAnchorElement>('[data-graph-open]')!;
    const list=root.querySelector<HTMLElement>('[data-graph-links]')!;
    tags.replaceChildren();list.replaceChildren();
    const note=notes.get(selected);open.hidden=!note;
    if(!note){title.textContent='从一篇笔记出发';description.textContent='点击节点查看引用方向与相关笔记，在这里打开文章。';return;}
    title.textContent=note.title;description.textContent=note.description;
    tags.textContent=[noteType(note),...(note.demo?['演示内容']:[]),...note.tags.map(t=>`#${t}`)].join(' · ');open.href=note.url;
    const linked=new Map<string,Set<string>>();
    for(const link of data.links){if(link.source!==selected&&link.target!==selected)continue;const other=link.source===selected?link.target:link.source;
      if(!linked.has(other))linked.set(other,new Set());
      linked.get(other)!.add(link.kind==='related'?'显式关联':link.source===selected?'本文引用':'反向链接');
    }
    const heading=document.createElement('h3');heading.textContent=`相连笔记 · ${linked.size}`;list.append(heading);
    if(!linked.size){const empty=document.createElement('p');empty.textContent='暂时没有笔记连接。正文引用其他笔记后，这里会自动更新。';list.append(empty);}
    for(const [id,reasons] of linked){const target=notes.get(id);if(!target)continue;const link=document.createElement('a');link.href=target.url;link.textContent=target.title;
      const reason=document.createElement('small');reason.textContent=[...reasons].join(' · ');link.append(reason);list.append(link);
    }
  }
  function choose(id:string){
    const node=nodes.find(n=>n.id===id);if(node?.type==='topic'){
      if(topicFilter)topicFilter.value=node.title;
      draw();return;
    }
    if(compact&&notes.has(id)){location.assign(notes.get(id)!.url);return;}
    selected=id;details();
    if(neighborToggle?.checked)draw();else highlight();
    if(!compact){const state=new URL(location.href);state.searchParams.set('focus',id);history.replaceState(null,'',state);}
  }
  function fit(){
    if(!nodes.length)return;
    const xs=nodes.map(n=>n.x??0),ys=nodes.map(n=>n.y??0);
    const xmin=Math.min(...xs)-100,xmax=Math.max(...xs)+100,ymin=Math.min(...ys)-55,ymax=Math.max(...ys)+65;
    const scale=Math.max(.2,Math.min(1.35,(width-48)/(xmax-xmin),(height-68)/(ymax-ymin)));
    svg.call(zoomBehavior.transform,zoomIdentity.translate(width/2,height/2-15).scale(scale).translate(-(xmin+xmax)/2,-(ymin+ymax)/2));
  }
  function draw(){
    const query=search?.value.trim().toLocaleLowerCase() ?? '';
    const center=compact ? root.dataset.focus ?? '' : selected;
    const close=center&&(compact||neighborToggle?.checked)?neighbors(center):null;
    const visible=data.nodes.filter(note=>(!close||close.has(note.id))&&(!typeFilter?.value||note.type===typeFilter.value)&&(!topicFilter?.value||note.topics.includes(topicFilter.value))&&(!query||[note.title,...note.tags,...note.topics].join(' ').toLocaleLowerCase().includes(query)));
    nodes=visible.map(note=>{
      const node=positions.get(note.id)??{id:note.id,title:note.title,type:note.type,note,degree:0};node.degree=0;positions.set(note.id,node);return node;
    });
    const byId=new Map(nodes.map(n=>[n.id,n]));const pairs=new Map<string,Edge>();edges=[];
    for(const link of data.links){
      const source=byId.get(link.source),target=byId.get(link.target);if(!source||!target)continue;
      const key=[source.id,target.id].sort().join('\0');
      let edge=pairs.get(key);
      if(!edge){edge={source,target,topic:false,forward:false,reverse:false};pairs.set(key,edge);source.degree++;target.degree++;edges.push(edge);}
      if(link.kind==='link'){if(edge.source.id===source.id)edge.forward=true;else edge.reverse=true;}
    }
    const noteEdges=edges.length;
    if(topicToggle?.checked){
      for(const title of [...new Set(visible.flatMap(n=>n.topics))]){
        const id=`theme:${title}`;const node=positions.get(id)??{id,title,type:'topic' as const,degree:0};positions.set(id,node);nodes.push(node);
        for(const note of visible.filter(n=>n.topics.includes(title)))edges.push({source:byId.get(note.id)!,target:node,topic:true,forward:false,reverse:false});
      }
    }
    edgeLayer.replaceChildren();nodeLayer.replaceChildren();
    edges.forEach(edge=>{
      const line=svgElement('line');line.classList.add('graph-edge');line.dataset.source=edge.source.id;line.dataset.target=edge.target.id;
      if(edge.topic)line.classList.add('topic-edge');
      if(edge.forward)line.setAttribute('marker-end',`url(#${markerId})`);
      if(edge.reverse)line.setAttribute('marker-start',`url(#${markerId})`);
      const title=svgElement('title');title.textContent=edge.topic?'所属主题':edge.forward&&edge.reverse?'互相引用':edge.forward?`${edge.source.title} 引用 ${edge.target.title}`:edge.reverse?`${edge.target.title} 引用 ${edge.source.title}`:'显式关联';line.append(title);edgeLayer.append(line);
    });
    nodes.forEach(node=>{
      const group=svgElement('g');group.classList.add('graph-node',`node-${node.type}`);group.dataset.id=node.id;
      const selector=svgElement('g');selector.setAttribute('role','button');selector.setAttribute('tabindex','0');selector.setAttribute('aria-label',node.type==='topic'?`筛选主题：${node.title}`:`查看连接：${node.title}`);
      const target=svgElement('circle');target.classList.add('graph-hit');target.setAttribute('r','24');
      const ring=svgElement('circle');ring.classList.add('graph-ring');ring.setAttribute('r',String(15+Math.min(6,node.degree)));
      const dot=svgElement('circle');dot.classList.add('graph-dot');dot.setAttribute('r',String(radius(node)));
      const label=svgElement('text');label.setAttribute('text-anchor','middle');label.setAttribute('y','34');
      const chunks=node.type==='topic'?[shortTitle(node.title,12)]:([...node.title].length>24?[...node.title].slice(0,23).join('')+'…':node.title).match(/.{1,12}/gu)??[node.title];
      chunks.forEach((text,i)=>{const span=svgElement('tspan');span.setAttribute('x','0');span.setAttribute('dy',i?'17':'0');span.textContent=text;label.append(span);});
      const tooltip=svgElement('title');tooltip.textContent=node.title+(node.note?.demo?' · 演示内容':'');selector.append(tooltip,target,ring,dot,label);group.append(selector);
      selector.addEventListener('click',()=>choose(node.id));selector.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(node.id);}});
      nodeLayer.append(group);
      select(selector).datum(node).call(drag<SVGGElement,Node>().container(layer).clickDistance(6)
        .on('start',event=>{if(!event.active)simulation.alphaTarget(.15).restart();node.fx=node.x;node.fy=node.y;})
        .on('drag',event=>{node.fx=event.x;node.fy=event.y;})
        .on('end',event=>{if(!event.active)simulation.alphaTarget(0);node.fx=null;node.fy=null;if(reduceMotion){simulation.stop().tick(80);paint();}}));
    });
    simulation.nodes(nodes).force('link',forceLink<Node,Edge>(edges).distance(edge=>edge.topic?125:185).strength(edge=>edge.topic ? .25 : .5));
    simulation.alpha(1).stop().tick(100);paint();fit();highlight();
    if(!reduceMotion)simulation.restart();
    message.hidden=nodes.length>0;message.textContent=data.nodes.length?'没有匹配的笔记。试试其他筛选条件。':'还没有公开笔记。写下第一篇笔记后，这里会自动出现节点。';
    status.textContent=`${visible.length} 篇笔记 · ${noteEdges} 条连接${topicToggle?.checked?` · ${nodes.length-visible.length} 个主题`:''}`;
    root.dataset.ready='true';
  }
  function resize(){width=Math.max(stage.clientWidth,240);height=stage.clientHeight;canvas.setAttribute('viewBox',`0 0 ${width} ${height}`);fit();}
  const observer=new ResizeObserver(resize);observer.observe(stage);resize();draw();details();
  for(const control of [search,topicFilter,typeFilter,topicToggle,neighborToggle])control?.addEventListener(control===search?'input':'change',()=>{
    if(neighborToggle?.checked&&!selected){neighborToggle.checked=false;status.textContent='请先点击一篇笔记，再查看它的一跳邻居。';return;}
    draw();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-graph-zoom]').forEach(button=>button.addEventListener('click',()=>svg.call(zoomBehavior.scaleBy,button.dataset.graphZoom==='in'?1.3:1/1.3)));
  root.querySelector('[data-graph-fit]')?.addEventListener('click',fit);
  root.querySelector('[data-graph-reset]')?.addEventListener('click',()=>{
    if(search)search.value='';if(topicFilter)topicFilter.value='';if(typeFilter)typeFilter.value='';if(neighborToggle)neighborToggle.checked=false;
    if(!compact){selected='';const state=new URL(location.href);state.searchParams.delete('focus');history.replaceState(null,'',state);details();}draw();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)simulation.stop();else if(!reduceMotion&&simulation.alpha()>.01)simulation.restart();});
  window.addEventListener('pagehide',()=>{simulation.stop();observer.disconnect();},{once:true});
}
