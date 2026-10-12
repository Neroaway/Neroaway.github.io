import test from 'node:test';
import assert from 'node:assert/strict';
import {readMarkdown,validateImport,serializeImport,rewriteImages} from '../src/lib/import-markdown.mjs';
import {edgeEndpoints} from '../src/lib/graph-geometry.mjs';
const base={title:'中文笔记',description:'一份真实的阅读记录',type:'thought',published:'2026-10-12',updated:'2026-10-12',topics:['研究方法'],tags:[],related:[]};
test('普通 Markdown 识别中文标题、BOM，移除重复一级标题并可往返序列化',()=>{
  const post=readMarkdown('\uFEFF# 我的中文标题\r\n\r\n这是一段思考。\r\n\r\n## 问题\r\n正文','example.md');
  assert.equal(post.metadata.title,'我的中文标题');assert.equal(post.metadata.description,'这是一段思考。');assert(!post.body.startsWith('# '));
  validateImport({...base,...post.metadata},post.body,'my-note');const result=readMarkdown(serializeImport({...base,...post.metadata},post.body));assert.equal(result.metadata.title,post.metadata.title);assert.equal(result.metadata.draft,false);
});
test('保留论文元信息、参考资料与关联，拒绝无效日期和不完整论文',()=>{
  const source='---\ntitle: 测试\ndescription: 摘要\ntype: paper\npublished: 2026-10-12\nupdated: 2026-10-12\ntopics: [测试]\npaper:\n  title: Original title\n  authors: [作者]\n  year: 2026\nrelated: [another-note]\nreferences:\n  - title: 来源\n    url: https://example.org/\n---\n\n## 问题\n正文';
  const post=readMarkdown(source);validateImport(post.metadata,post.body,'test-note');const result=readMarkdown(serializeImport(post.metadata,post.body));assert.equal(result.metadata.paper.title,'Original title');assert.deepEqual(result.metadata.related,['another-note']);assert.equal(result.metadata.references[0].url,'https://example.org/');
  assert.throws(()=>validateImport({...base,published:'2026-02-30'},'正文','note'),/日期/);assert.throws(()=>validateImport({...base,type:'paper'},'正文','note'),/原始论文标题/);
});
test('活动 HTML 和危险协议被拦截，代码示例与提示框保持可用',()=>{
  assert.throws(()=>validateImport(base,'<script>alert(1)</script>','note'),/HTML/);
  assert.throws(()=>validateImport(base,'[点我](javascript:alert%281%29)','note'),/协议/);
  assert.throws(()=>validateImport(base,'# 重复一级标题','note'),/二级|##/);
  assert.doesNotThrow(()=>validateImport(base,'```html\n<script>alert(1)</script>\n```\n\n<div class="callout interpretation">\n<p>我的理解</p>\n</div>','note'));
  assert.throws(()=>readMarkdown('---\ntitle: [bad\n---\n正文'),/YAML/);
});
test('图片路径重写支持普通与引用式图片，不改代码围栏中的示例',()=>{
  const body='![图](fig.png)\n\n![另一个][image]\n\n[image]: fig.png\n\n```md\n![例子](fig.png)\n```';
  const result=rewriteImages(body,new Map([['fig.png','/images/uploads/note/image-1.png']]));
  assert.equal(result.split('/images/uploads/note/image-1.png').length-1,2);assert(result.includes('```md\n![例子](fig.png)'));
});
test('箭头端点与斜线共线，保留正确方向并避开节点半径',()=>{
  const a={x:10,y:20},b={x:190,y:260},points=edgeEndpoints(a,b,12,15);const dx=b.x-a.x,dy=b.y-a.y;
  assert(Math.abs((points.x1-a.x)*dy-(points.y1-a.y)*dx)<1e-8);
  assert(Math.abs((points.x2-a.x)*dy-(points.y2-a.y)*dx)<1e-8);
  assert(Math.hypot(points.x1-a.x,points.y1-a.y)>=12);assert(Math.hypot(points.x2-b.x,points.y2-b.y)>=15);
  assert((points.x2-points.x1)*dx+(points.y2-points.y1)*dy>0);
});
