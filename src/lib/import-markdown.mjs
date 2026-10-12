import { parseDocument, stringify } from 'yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
const parser=unified().use(remarkParse);
export const importDate=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
export function asList(value){return [...new Set((Array.isArray(value)?value:String(value??'').split(/[,，、\n]/)).map(v=>String(v).trim()).filter(Boolean))];}
export function readMarkdown(source,filename='note.md'){
  const text=source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  if(/[\u0000\uFFFD]/.test(text))throw new Error('无法正确读取文档，请将文件另存为 UTF-8 编码后上传。');
  let metadata={},body=text;
  if(text.startsWith('---\n')){
    const end=text.indexOf('\n---',4);
    if(end<0||!/^\n---(?:\n|$)/.test(text.slice(end)))throw new Error('文档开头的 YAML 信息未闭合，请用单独一行 --- 结束。');
    const document=parseDocument(text.slice(4,end));if(document.errors.length)throw new Error(`YAML 格式错误：${document.errors[0].message.split('\n')[0]}`);
    metadata=document.toJS({maxAliasCount:20})??{};
    if(typeof metadata!=='object'||Array.isArray(metadata))throw new Error('文档头部信息必须是键值格式。');
    body=text.slice(end+4).replace(/^\n/,'');
  }
  const heading=body.match(/^\s*#\s+(.+)\n?/);
  const title=String(metadata.title??heading?.[1]??filename.replace(/\.(md|markdown)$/i,'')).trim();
  if(heading)body=body.slice(heading[0].length).trimStart();
  const excerpt=body.split(/\n\s*\n/).find(p=>p.trim()&&!/^(#|```|~~~|<|!\[|\$\$)/.test(p.trim()))??'';
  const description=String(metadata.description??excerpt.replace(/[#*`>\[\]]/g,'').replace(/\n/g,' ').slice(0,130)).trim();
  return {metadata:{...metadata,title,description,draft:metadata.draft===true,type:metadata.type??(metadata.paper?'paper':'thought'),published:metadata.published??metadata.date??importDate(),updated:metadata.updated??metadata.published??metadata.date??importDate(),topics:asList(metadata.topics??metadata.categories??'未分类'),tags:asList(metadata.tags),related:asList(metadata.related)},body};
}
export function validateImport(data,body,slug){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new Error('文章地址请使用小写英文、数字和短横线，例如 my-paper-note。');
  if(!String(data.title??'').trim())throw new Error('请填写文章标题。');
  if(!String(data.description??'').trim())throw new Error('请填写一句话摘要。');
  if(!['paper','thought'].includes(data.type))throw new Error('请选择文章类型。');
  if(!asList(data.topics).length)throw new Error('请至少填写一个研究主题。');
  for(const key of ['published','updated']){
    const value=String(data[key]??'');const date=new Date(value);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(date.valueOf())||date.toISOString().slice(0,10)!==value)throw new Error('发布日期和更新日期请使用有效的 YYYY-MM-DD 格式。');
  }
  if(data.updated<data.published)throw new Error('更新日期不能早于发布日期。');
  if(data.type==='paper'){
    if(!data.paper?.title?.trim()||!asList(data.paper?.authors).length)throw new Error('论文笔记请补充原始论文标题和作者。');
    if(data.paper.year!==undefined&&(!Number.isInteger(data.paper.year)||data.paper.year<1000||data.paper.year>9999))throw new Error('论文年份必须是四位数字。');
    if(data.paper.url&&!/^https?:\/\//i.test(data.paper.url))throw new Error('论文原文链接请使用 http 或 https 地址。');
  }
  if(data.references!==undefined&&(!Array.isArray(data.references)||data.references.some(r=>!r?.title||!/^https?:\/\//i.test(r.url??''))))throw new Error('references 中的每一项都需要 title 和 http/https 链接。');
  if(!body.trim())throw new Error('文档正文不能为空。');
  const tree=parser.parse(body);
  function walk(node){
    if(node.type==='heading'&&node.depth===1)throw new Error('正文中请使用 ## 或 ### 标题；文章一级标题会由页面自动生成。');
    if(node.type==='html'&&/(<\s*\/?\s*(script|iframe|object|embed|style|link|base|meta|form|input|button|textarea|svg|math|img)\b|\b(?:on[a-z]+|href|src|style)\s*=|(?:javascript|vbscript)\s*:)/i.test(node.value))throw new Error('文档包含可执行 HTML。请移除脚本、事件属性或嵌入页面后再上传；代码示例可放进代码围栏。');
    if(node.url&&/^(?:javascript|vbscript|data):/i.test(node.url.replace(/\s/g,'')))throw new Error('文档中有不支持的链接协议，请使用普通网页链接或本地图片。');
    node.children?.forEach(walk);
  }
  walk(tree);
}
export function serializeImport(data,body){
  const metadata={title:String(data.title).trim(),description:String(data.description).trim(),type:data.type,published:data.published,updated:data.updated,topics:asList(data.topics),tags:asList(data.tags),demo:!!data.demo,draft:false,related:asList(data.related)};
  if(data.type==='paper')metadata.paper={...data.paper,authors:asList(data.paper.authors)};
  if(data.references?.length)metadata.references=data.references.map(r=>({title:String(r.title),url:String(r.url)}));
  return `---\n${stringify(metadata,{lineWidth:0})}---\n\n${body.trim()}\n`;
}
export function imageTargets(body){
  const targets=[];const definitions=new Map();const tree=parser.parse(body);
  function definitionsWalk(node){if(node.type==='definition')definitions.set(node.identifier,node);node.children?.forEach(definitionsWalk);}
  definitionsWalk(tree);
  function walk(node){if(node.type==='image')targets.push(node);if(node.type==='imageReference'&&definitions.has(node.identifier))targets.push(definitions.get(node.identifier));node.children?.forEach(walk);}
  walk(tree);return [...new Map(targets.map(node=>[node.position.start.offset,node])).values()];
}
export function rewriteImages(body,mappings){
  let output=body;
  for(const node of imageTargets(body).sort((a,b)=>b.position.start.offset-a.position.start.offset)){
    const replacement=mappings.get(node.url);if(!replacement)continue;
    const start=node.position.start.offset,end=node.position.end.offset;
    const original=body.slice(start,end);if(!original.includes(node.url))throw new Error('图片路径格式较复杂，请改用标准 Markdown 图片语法。');
    output=output.slice(0,start)+original.replace(node.url,replacement)+output.slice(end);
  }
  return output;
}
