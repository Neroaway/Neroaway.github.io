import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const [type, slug] = process.argv.slice(2);
if (!['paper','thought'].includes(type) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug ?? '')) {
  console.error('用法：npm run new -- paper|thought 英文短横线文件名'); process.exit(1);
}
const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
const body=(await readFile(`templates/${type}.md`,'utf8')).replace(/2026-10-12/g,today);
await mkdir('src/content/posts',{recursive:true});
const path=join('src/content/posts',`${slug}.md`);
try { await writeFile(path,body,{flag:'wx'}); console.log(`已创建 ${path}，默认 draft: true，写好后改为 false 即可发布。`); }
catch(e) { if(e.code==='EEXIST') console.error('文件已存在，未覆盖。'); else throw e; process.exitCode=1; }
