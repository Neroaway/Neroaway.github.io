import { connections } from '../lib/posts';
export async function GET() {
  const {nodes,links}=await connections();
  return new Response(JSON.stringify({nodes,links}), {headers:{'Content-Type':'application/json; charset=utf-8'}});
}
