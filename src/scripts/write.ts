import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { readMarkdown, validateImport, serializeImport, asList, imageTargets, rewriteImages, importDate } from '../lib/import-markdown.mjs';
import { wikiParts, articleHref, proseLinks, resolveArticleLink } from '../lib/connections.mjs';

const root=document.querySelector<HTMLElement>('#writer')!;
const $=<T extends HTMLElement=HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
const value=(id:string)=>$<HTMLInputElement>(`#${id}`).value.trim();
const owner=root.dataset.owner!,repository=root.dataset.repository!,branch=root.dataset.branch!,base=root.dataset.base!;
const api=`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
const form=$<HTMLFormElement>('#article-form');
const tokenField=$<HTMLInputElement>('#github-token');
let metadata:Record<string,any>={},images:File[]=[],previewUrls:string[]=[],renderVersion=0,busy=false,submitted=false,previewError='';
const escapeHtml=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const markdown=new Marked({gfm:true,renderer:{
  html({text}){return DOMPurify.sanitize(text,{FORBID_TAGS:['style','form','input','button','textarea','iframe','img'],FORBID_ATTR:['style','id','name']});},
  image({href,text,title}){
    let name='';try{name=decodeURIComponent(href.split(/[?#]/)[0]).split('/').pop()??'';}catch{}
    const index=images.findIndex(file=>file.name===name);
    const src=index>=0?'':href.startsWith('/')&&!href.startsWith('//')?`${base.replace(/\/$/,'')}${href}`:/^(https?:)?\/\//i.test(href)?href:'';
    return `<img ${index>=0?`data-upload-index="${index}"`:src?`src="${escapeHtml(src)}"`:''} alt="${escapeHtml(index>=0||src?text:`待选择本地图片：${name}`)}"${title?` title="${escapeHtml(title)}"`:''}>`;
  }
}}).use({extensions:[{
  name:'wikiLink',level:'inline',start:src=>src.indexOf('[['),
  tokenizer(src){const match=/^\[\[([^\]\n]+)\]\]/.exec(src);if(match)return {type:'wikiLink',raw:match[0],value:match[1]};},
  renderer(token){const {id,hash,label}=wikiParts(String(token.value));return `<a href="${escapeHtml(`${base.replace(/\/$/,'')}${articleHref(id,hash)}`)}">${escapeHtml(label)}</a>`;}
}]});
let mathReady:Promise<void>|undefined;
function status(id:string,text:string,error=false){const element=$(id);element.textContent=text;element.classList.toggle('error',error);}
function fields(){
  const year=value('paper-year');
  return {title:value('post-title'),description:value('post-description'),type:value('post-type'),published:value('post-published'),updated:value('post-updated'),topics:asList(value('post-topics')),tags:asList(value('post-tags')),related:asList(value('post-related')),demo:$<HTMLInputElement>('#post-demo').checked,
    references:metadata.references??[],
    paper:{title:value('paper-title'),authors:asList(value('paper-authors')),...(year?{year:Number(year)}:{}),...(value('paper-venue')?{venue:value('paper-venue')}:{}),...(value('paper-url')?{url:value('paper-url')}:{}),...(value('paper-doi')?{doi:value('paper-doi')}:{}),...(value('paper-arxiv')?{arxiv:value('paper-arxiv')}:{})}};
}
function slugFromName(name:string){return name.replace(/\.(?:md|markdown)$/i,'').toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'')||`note-${importDate().replaceAll('-','')}-${crypto.randomUUID().slice(0,6)}`;}
function setInput(id:string,value:unknown){$<HTMLInputElement>(`#${id}`).value=String(value??'');}
function prepared(){
  const data=fields(),body=$<HTMLTextAreaElement>('#markdown-body').value,slug=value('post-slug');
  validateImport(data,body,slug);
  const mappings=new Map<string,string>();
  const attached=images.map((file,index)=>({file,path:`public/images/uploads/${slug}/image-${index+1}.${file.name.split('.').pop()!.toLowerCase()}`}));
  const unresolved:string[]=[];
  for(const node of imageTargets(body)){
    const src=String(node.url);if(/^(https?:)?\/\//i.test(src))continue;
    let name:string;try{name=decodeURIComponent(src.split(/[?#]/)[0]).split('/').pop()!;}catch{throw new Error(`图片路径无法识别：${src}`);}
    const image=attached.find(item=>item.file.name===name);
    if(image)mappings.set(src,`/${image.path.replace(/^public\//,'')}`);
    else if(!src.startsWith('/'))unresolved.push(src);
  }
  if(unresolved.length)throw new Error(`请一并选择文档中的本地图片：${[...new Set(unresolved)].join('、')}`);
  const normalized=rewriteImages(body,mappings);
  return {data,slug,body:normalized,content:serializeImport(data,normalized),images:attached.filter(item=>[...mappings.values()].includes(`/${item.path.replace(/^public\//,'')}`))};
}
async function preview(){
  const version=++renderVersion;
  const data=fields(),body=$<HTMLTextAreaElement>('#markdown-body').value;
  $('#preview-title').textContent=data.title||'未命名笔记';$('#preview-description').textContent=data.description;
  $('#preview-type').textContent=data.type==='paper'?'论文阅读':'独立思考';$('#preview-type').classList.toggle('thought',data.type==='thought');
  $('#word-count').textContent=`${body.replace(/\s/g,'').length.toLocaleString()} 字符`;
  $<HTMLDetailsElement>('#paper-fields').hidden=data.type!=='paper';
  try{
    if(body.includes('$')){mathReady??=import('marked-katex-extension').then(({default:extension})=>{markdown.use(extension({throwOnError:true,nonStandard:true}));});await mathReady;}
    const html=await markdown.parse(body);if(version!==renderVersion)return;
    const preview=$('#markdown-preview');preview.innerHTML=DOMPurify.sanitize(html,{FORBID_TAGS:['style','form','input','button','textarea','iframe']});
    preview.querySelectorAll<HTMLImageElement>('img[data-upload-index]').forEach(image=>{const index=Number(image.dataset.uploadIndex);if(Number.isInteger(index)&&previewUrls[index])image.src=previewUrls[index];image.removeAttribute('data-upload-index');});
    preview.querySelectorAll<HTMLAnchorElement>('a').forEach(link=>{const href=link.getAttribute('href')??'';if(href.startsWith('/')&&!href.startsWith('//')&&!href.startsWith(base))link.href=`${base.replace(/\/$/,'')}${href}`;link.target='_blank';link.rel='noopener noreferrer';});
    previewError=preview.querySelector('.katex-error')?'文档中有无法渲染的公式，请检查 LaTeX 语法后再发布。':'';
    if(previewError)status('#import-status',previewError,true);
  }catch(error){if(version!==renderVersion)return;previewError=error instanceof Error&&error.message.includes('KaTeX')?'文档中有无法渲染的公式，请检查 LaTeX 语法后再发布。':'预览失败，请检查 Markdown 或公式语法。';$('#markdown-preview').textContent=previewError;status('#import-status',previewError,true);}
}
async function loadDocument(file?:File){
  if(!file||busy)return;
  try{
    if(!/\.(md|markdown)$/i.test(file.name))throw new Error('请选择 .md 或 .markdown 文档。');
    if(file.size>1024*1024)throw new Error('文档超过 1 MB，请缩小后再上传。');
    const imported=readMarkdown(await file.text(),file.name);metadata=imported.metadata;
    for(const [key,id] of Object.entries({title:'post-title',description:'post-description',type:'post-type',published:'post-published',updated:'post-updated'}))setInput(id,metadata[key]);
    for(const key of ['topics','tags','related'])setInput(`post-${key}`,asList(metadata[key]).join('，'));
    const paper=metadata.paper??{};
    for(const key of ['title','year','venue','url','doi','arxiv'])setInput(`paper-${key}`,paper[key]);
    setInput('paper-authors',asList(paper.authors).join('，'));setInput('post-slug',slugFromName(file.name));
    $<HTMLInputElement>('#post-demo').checked=metadata.demo===true;
    $<HTMLTextAreaElement>('#markdown-body').value=imported.body;
    $<HTMLDetailsElement>('#paper-fields').open=metadata.type==='paper';
    previewUrls.forEach(URL.revokeObjectURL);previewUrls=[];images=[];$<HTMLInputElement>('#image-files').value='';$('#image-list').replaceChildren();
    submitted=false;$<HTMLFieldSetElement>('#article-fields').disabled=false;$<HTMLButtonElement>('#publish-post').disabled=false;tokenField.value='';$('#github-connect').hidden=true;$('#publish-links').replaceChildren();status('#publish-status','');
    $('#file-name').textContent=file.name;$('#editor-area').hidden=false;status('#import-status','文档已导入，请检查信息与预览。');await preview();
  }catch(error){status('#import-status',error instanceof Error?error.message:'导入失败，请重新选择文件。',true);}
}
$<HTMLInputElement>('#markdown-file').addEventListener('change',event=>void loadDocument((event.target as HTMLInputElement).files?.[0]));
const drop=$('#drop-zone');for(const type of ['dragenter','dragover'])drop.addEventListener(type,event=>{event.preventDefault();if(!busy)drop.classList.add('dragging');});
for(const type of ['dragleave','drop'])drop.addEventListener(type,()=>drop.classList.remove('dragging'));
drop.addEventListener('drop',event=>{event.preventDefault();void loadDocument(event.dataTransfer?.files[0]);});
let previewTimer:ReturnType<typeof setTimeout>;
form.addEventListener('input',()=>{clearTimeout(previewTimer);previewTimer=setTimeout(()=>void preview(),120);});form.addEventListener('submit',event=>event.preventDefault());
$<HTMLInputElement>('#image-files').addEventListener('change',async event=>{
  try{
    const selected=Array.from((event.target as HTMLInputElement).files??[]);
    if(selected.length>20||selected.reduce((total,file)=>total+file.size,0)>20*1024*1024)throw new Error('一次最多选择 20 张图片，总大小不超过 20 MB。');
    if(selected.some(file=>! /\.(png|jpe?g|gif|webp|avif)$/i.test(file.name)||file.size>8*1024*1024))throw new Error('请使用支持的图片格式，每张不超过 8 MB。');
    if(new Set(selected.map(file=>file.name)).size!==selected.length)throw new Error('附带图片的文件名不能重复。');
    previewUrls.forEach(URL.revokeObjectURL);images=selected;previewUrls=images.map(file=>URL.createObjectURL(file));$('#image-list').replaceChildren();
    for(const file of images){const li=document.createElement('li');li.textContent=`${file.name} · ${Math.ceil(file.size/1024)} KB`;$('#image-list').append(li);}
    status('#import-status',`已选择 ${images.length} 张图片，发布时会和文章一起提交。`);await preview();
  }catch(error){status('#import-status',(error as Error).message,true);}
});
for(const mode of ['preview','source'])$(`#tab-${mode}`).addEventListener('click',()=>{
  for(const name of ['preview','source']){$(`#tab-${name}`).setAttribute('aria-selected',String(mode===name));$(`#${name}-panel`).hidden=mode!==name;}
  if(mode==='preview')void preview();
});
$('#download-markdown').addEventListener('click',async()=>{
  try{await preview();if(previewError)throw new Error(previewError);const post=prepared();const href=URL.createObjectURL(new Blob([post.content],{type:'text/markdown;charset=utf-8'}));const link=document.createElement('a');link.href=href;link.download=`${post.slug}.md`;link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);status('#publish-status','Markdown 已下载。');}
  catch(error){status('#publish-status',(error as Error).message,true);}
});
$('#show-connect').addEventListener('click',async()=>{
  try{await preview();if(previewError)throw new Error(previewError);prepared();if(!form.reportValidity())return;$('#github-connect').hidden=false;tokenField.focus();status('#publish-status','');}
  catch(error){status('#publish-status',(error as Error).message,true);}
});
function base64(bytes:Uint8Array){let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);}
function filePath(path:string){return path.split('/').map(encodeURIComponent).join('/');}
async function request(url:string,token:string,method='GET',body?:unknown,allow404=false){
  if(!url.startsWith('https://api.github.com/'))throw new Error('无效的 GitHub 接口地址。');
  const response=await fetch(url,{method,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2026-03-10',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000),redirect:'error'});
  if(allow404&&response.status===404)return null;
  if(!response.ok){const messages:Record<number,string>={401:'令牌无效或已过期，请重新创建。',403:'GitHub 拒绝了请求，请检查此仓库的 Contents 写入权限与 API 配额。',404:'找不到仓库或分支，请检查令牌的仓库授权。',409:'仓库已发生更新，请刷新后重试。',422:'无法提交，仓库可能刚被更新，或分支规则要求通过 Pull Request。'};throw new Error(messages[response.status]??`GitHub 请求失败（${response.status}）。`);}
  return response.json();
}
function resultLink(label:string,url:string){const link=document.createElement('a');link.textContent=label;link.href=url;link.target='_blank';link.rel='noopener noreferrer';$('#publish-links').append(link);}
async function watchDeployment(sha:string){
  for(let attempt=0;attempt<24;attempt++){
    await new Promise(resolve=>setTimeout(resolve,10000));
    if(!submitted)return;
    try{const response=await fetch(`${api}/actions/runs?head_sha=${sha}&per_page=10`);if(!response.ok)return;const {workflow_runs:runs}=await response.json();const run=runs.find((r:{name:string;head_sha:string})=>r.name==='Build and deploy notebook'&&r.head_sha===sha);
      if(run?.status==='completed'){if(run.conclusion==='success')status('#publish-status','发布完成，文章已上线。');else status('#publish-status','文章已提交，但自动构建未通过。请打开发布进度查看错误并修正。',true);return;}
    }catch{return;}
  }
  if(submitted)status('#publish-status','文章已提交。部署仍在进行，请通过「查看发布进度」确认结果。');
}
$('#publish-post').addEventListener('click',async()=>{
  if(busy||submitted)return;
  let token=tokenField.value.trim();if(!token){status('#publish-status','请填写 GitHub 访问令牌。',true);return;}
  try{
    const post=prepared();if(!form.reportValidity())return;
    busy=true;$<HTMLFieldSetElement>('#article-fields').disabled=true;$<HTMLButtonElement>('#publish-post').disabled=true;$<HTMLInputElement>('#markdown-file').disabled=true;
    await preview();if(previewError)throw new Error(previewError);
    status('#publish-status','正在连接 GitHub 并检查文档…');
    const user=await request('https://api.github.com/user',token);
    if(String(user.login).toLowerCase()!==owner.toLowerCase())throw new Error(`请使用 ${owner} 的 GitHub 令牌发布。`);
    const refUrl=`${api}/git/refs/heads/${filePath(branch)}`;
    const head=await request(`${api}/git/ref/heads/${filePath(branch)}`,token);
    const path=`src/content/posts/${post.slug}.md`;
    const exists=await request(`${api}/contents/${filePath(path)}?ref=${encodeURIComponent(branch)}`,token,'GET',undefined,true);
    if(exists)throw new Error('这个文章地址已存在。请更换文章地址，避免覆盖已有笔记。');
    const linked=new Set<string>(post.data.related);
    for(const href of proseLinks(post.body)){const id=resolveArticleLink(href,post.slug,base,location.origin);if(id&&id!==post.slug)linked.add(id);}
    for(const id of linked){
      if(!/^[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*$/u.test(id))throw new Error(`关联笔记名称无效：${id}`);
      const target=await request(`${api}/contents/${filePath(`src/content/posts/${id}.md`)}?ref=${encodeURIComponent(branch)}`,token,'GET',undefined,true);
      if(!target?.content)throw new Error(`关联笔记不存在：${id}。请先发布它或移除链接。`);
      const source=new TextDecoder().decode(Uint8Array.from(atob(target.content.replace(/\s/g,'')),c=>c.charCodeAt(0)));
      if(readMarkdown(source).metadata.draft===true)throw new Error(`关联笔记 ${id} 还是草稿，请先发布它。`);
    }
    for(const image of imageTargets(post.body)){
      const imageUrl=String(image.url);if(!imageUrl.startsWith('/')||post.images.some(item=>`/${item.path.replace(/^public\//,'')}`===imageUrl))continue;
      const asset=await request(`${api}/contents/${filePath(`public${decodeURIComponent(imageUrl.split(/[?#]/)[0])}`)}?ref=${encodeURIComponent(branch)}`,token,'GET',undefined,true);
      if(!asset)throw new Error(`找不到图片：${imageUrl}，请一并选择图片文件。`);
    }
    for(const image of post.images){if(await request(`${api}/contents/${filePath(image.path)}?ref=${encodeURIComponent(branch)}`,token,'GET',undefined,true))throw new Error('该文章地址对应的图片目录已经存在，请更换文章地址后发布。');}
    const parent=await request(`${api}/git/commits/${head.object.sha}`,token);
    const treeEntries=[];
    const files=[{path,bytes:new TextEncoder().encode(post.content)},...await Promise.all(post.images.map(async item=>({path:item.path,bytes:new Uint8Array(await item.file.arrayBuffer())})))];
    for(let index=0;index<files.length;index++){
      status('#publish-status',`正在上传 ${index+1} / ${files.length} 个文件…`);
      const blob=await request(`${api}/git/blobs`,token,'POST',{content:base64(files[index].bytes),encoding:'base64'});
      treeEntries.push({path:files[index].path,mode:'100644',type:'blob',sha:blob.sha});
    }
    const tree=await request(`${api}/git/trees`,token,'POST',{base_tree:parent.tree.sha,tree:treeEntries});
    const commit=await request(`${api}/git/commits`,token,'POST',{message:`Publish note: ${post.data.title}`,tree:tree.sha,parents:[head.object.sha]});
    try{await request(refUrl,token,'PATCH',{sha:commit.sha,force:false});}
    catch(error){const current=await request(`${api}/git/ref/heads/${filePath(branch)}`,token);if(current.object.sha!==commit.sha)throw error;}
    submitted=true;status('#publish-status','文章与图片已提交，GitHub 正在自动构建与发布。通常需要一两分钟。');$('#publish-links').replaceChildren();
    resultLink('查看发布进度 ↗',`https://github.com/${owner}/${repository}/actions`);resultLink('文章地址 ↗',`${location.origin}${base}posts/${post.slug}/`);resultLink('查看仓库中的文档 ↗',`https://github.com/${owner}/${repository}/blob/${encodeURIComponent(branch)}/${filePath(path)}`);
    void watchDeployment(commit.sha);
  }catch(error){status('#publish-status',error instanceof Error?error.message:'发布失败，请检查网络后重试。',true);}
  finally{token='';tokenField.value='';busy=false;$<HTMLFieldSetElement>('#article-fields').disabled=submitted;$<HTMLButtonElement>('#publish-post').disabled=submitted;$<HTMLInputElement>('#markdown-file').disabled=false;}
});
window.addEventListener('pagehide',()=>{tokenField.value='';previewUrls.forEach(URL.revokeObjectURL);});
