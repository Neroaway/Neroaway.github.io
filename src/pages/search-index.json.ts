import { allPosts, postUrl } from '../lib/posts';
export async function GET() {
  const posts = await allPosts();
  return new Response(JSON.stringify(posts.map(p=>({title:p.data.title, description:p.data.description, tags:p.data.tags, topics:p.data.topics, type:p.data.type, demo:p.data.demo, url:postUrl(p), body:(p.body ?? '').replace(/<[^>]*>/g,' ').replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/[#*`>]/g,'')}))), {headers:{'Content-Type':'application/json; charset=utf-8'}});
}
