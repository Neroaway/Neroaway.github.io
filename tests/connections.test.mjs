import test from 'node:test';
import assert from 'node:assert/strict';
import {buildConnections,proseLinks,resolveArticleLink} from '../src/lib/connections.mjs';
const post=(id,body='',extra={})=>({id,body,data:{title:id,description:'测试数据',type:'thought',topics:['topic'],tags:[],related:[],draft:false,...extra}});
test('识别正文、别名、引用式链接，排除代码、外链与图片',()=>{
  const body='[[b|笔记 B]]\n[标准链接](/posts/c/)\n[参考][ref]\n\n[ref]: /posts/d/\n\n`[[ignored]]`\n\n```md\n[示例](/posts/ignored/)\n```\n\n![图片](/posts/ignored/)';
  assert.deepEqual(proseLinks(body),['/posts/b/','/posts/c/','/posts/d/']);
  const graph=buildConnections([post('a',body+'\n[外部](https://example.org/posts/c/)'),post('b'),post('c'),post('d')],'/');
  assert.equal(graph.links.length,3);assert.equal(graph.missing.length,0);
});
test('根路径、项目路径、相对链接和中文锚点解析一致',()=>{
  for(const base of ['/','/reading-blog/']){
    assert.equal(resolveArticleLink('/posts/b/#核心问题','a',base),'b');
    assert.equal(resolveArticleLink(`${base}posts/b/`,'a',base),'b');
    assert.equal(resolveArticleLink('../b/','a',base),'b');
    assert.equal(resolveArticleLink('#核心问题','a',base),'a');
    assert.equal(resolveArticleLink('https://example.org/posts/b/','a',base),null);
  }
});
test('过滤草稿与自引用，重复去重并保留有向关系与孤立笔记',()=>{
  const graph=buildConnections([post('a','[[b]]\n[[b]]\n[[a]]\n[[draft]]',{related:['b','b']}),post('b','[[a]]'),post('draft','',{draft:true}),post('lonely')],'/reading-blog/');
  assert.deepEqual(graph.nodes.map(n=>n.id),['a','b','lonely']);
  assert.deepEqual(graph.links,[{source:'a',target:'b',kind:'link'},{source:'a',target:'b',kind:'related'},{source:'b',target:'a',kind:'link'}]);
  assert(graph.nodes.every(n=>n.url.startsWith('/reading-blog/posts/')));
  assert.equal(graph.missing.length,1);assert.equal(graph.missing[0].target,'draft');
});
test('共同主题和标签不会被误当成笔记引用',()=>{
  const graph=buildConnections([post('a'),post('b')]);assert.equal(graph.nodes.length,2);assert.equal(graph.links.length,0);
});
