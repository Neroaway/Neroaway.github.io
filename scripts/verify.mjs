import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { load } from 'cheerio';
import { deploymentBase } from '../site.config.mjs';
import assert from 'node:assert/strict';
const base=(process.env.SITE_BASE ?? deploymentBase()).replace(/\/$/,'');
const files=[];
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const file=join(dir,item.name);if(item.isDirectory())await walk(file);else if(file.endsWith('.html'))files.push(file);}}
await walk('dist');
const failures=[];let checked=0;
for(const file of files){
  const $=load(await readFile(file,'utf8'));
  assert.equal($('html').attr('lang'),'zh-CN');
  const route=file.replace(/^dist/,'').replace(/index.html$/,'');
  for(const element of $('a[href],img[src],link[href],script[src]').toArray()){
    const raw=$(element).attr('href') ?? $(element).attr('src');
    if(!raw || /^(https?:|mailto:|data:|tel:|\/\/)/.test(raw))continue;
    const target=new URL(raw,`https://test.invalid${base}${route}`);
    if(base && !target.pathname.startsWith(`${base}/`)){failures.push(`${file}: 缺少 base ${raw}`);continue;}
    const path=decodeURIComponent(target.pathname.slice(base.length));
    let local=join('dist',path);
    try {if((await stat(local)).isDirectory())local=join(local,'index.html');await stat(local);checked++;}
    catch {failures.push(`${file}: 链接不存在 ${raw}`);continue;}
    if(target.hash && local.endsWith('.html')){const targetPage=load(await readFile(local,'utf8'));const id=decodeURIComponent(target.hash.slice(1));if(!targetPage('[id]').toArray().some(e=>targetPage(e).attr('id')===id))failures.push(`${file}: 锚点不存在 ${raw}`);}
  }
  if(file.includes('/posts/')) assert($('h1').length===1,'文章必须有一个一级标题');
  if(file.includes('/posts/demo-')){
    assert($('h1').length===1,'文章必须有一个一级标题');
    assert($('.katex').length>0,'演示文章应包含已渲染的公式');
    assert($('.katex-error').length===0,'不应出现公式渲染错误');
    assert($('.demo-notice').text().includes('演示内容'));
  }
}
const index=JSON.parse(await readFile('dist/search-index.json','utf8'));
assert(Array.isArray(index));
if(index.some(p=>p.url.endsWith('/posts/demo-paper/'))){
const paper=load(await readFile('dist/posts/demo-paper/index.html','utf8'));
assert(paper('.astro-code span[style]').length>0,'代码应已高亮');
assert(paper('table').length>0);assert(paper('img').length>0);
}
assert.equal(deploymentBase('Neroaway.github.io','Neroaway'),'/');
assert.equal(deploymentBase('reading-blog','Neroaway'),'/reading-blog/');
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log(`通过：${files.length} 个页面、${checked} 个本地链接/资源及目录锚点；公式、代码、图片、表格、搜索索引；base=${base||'/'}`);
