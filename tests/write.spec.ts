import {test,expect} from '@playwright/test';
const sampleDocument=`# 一份中文上传笔记\n\n记录阅读后的理解与疑问。\n\n## 核心问题\n\n这是正文，行内公式 $x^2 + y^2$。\n\n$$\nL=\\sum_i x_i\n$$\n\n| 条目 | 说明 |\n| --- | --- |\n| 问题 | 尚待验证 |\n`;
const upload=async(page:import('@playwright/test').Page,content=sampleDocument,name='uploaded-note.md')=>page.locator('#markdown-file').setInputFiles({name,mimeType:'text/markdown',buffer:Buffer.from(content)});

test('上传中文 Markdown、公式预览、编辑与导出',async({page})=>{
  await page.goto('write/');await upload(page);
  await expect(page.locator('#editor-area')).toBeVisible();await expect(page.locator('#post-title')).toHaveValue('一份中文上传笔记');await expect(page.locator('#post-slug')).toHaveValue('uploaded-note');
  await expect(page.locator('#markdown-preview .katex').first()).toBeVisible();await expect(page.locator('#markdown-preview table')).toBeVisible();
  await page.locator('#post-title').fill('修改后的中文标题');await expect(page.locator('#preview-title')).toHaveText('修改后的中文标题');
  await page.getByRole('tab',{name:'Markdown 正文'}).click();await expect(page.locator('#markdown-body')).toBeVisible();await page.locator('#markdown-body').fill('## 新的问题\n\n更新后的正文。');
  await page.getByRole('tab',{name:'阅读预览'}).click();await expect(page.locator('#markdown-preview')).toContainText('更新后的正文');
  const downloadPromise=page.waitForEvent('download');await page.locator('#download-markdown').click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('uploaded-note.md');
  const stream=await download.createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));const exported=Buffer.concat(chunks).toString('utf8');expect(exported).toContain('修改后的中文标题');expect(exported).toContain('draft: false');expect(exported).toContain('更新后的正文');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('文档错误与恶意 HTML 不执行，不完整论文不能发布',async({page})=>{
  await page.goto('write/');await upload(page,'---\ntitle: [broken\n---\n内容');await expect(page.locator('#import-status')).toContainText('YAML 格式错误');
  await upload(page,'# 标题\n\n摘要\n\n<script>window.uploadUnsafe=true</script>\n\n<img src=x onerror="window.uploadUnsafe=true">');
  await expect(page.locator('#preview-title')).toHaveText('标题');expect(await page.evaluate(()=>Object.prototype.hasOwnProperty.call(window,'uploadUnsafe'))).toBeFalsy();
  await page.locator('#show-connect').click();await expect(page.locator('#publish-status')).toContainText('可执行 HTML');await expect(page.locator('#github-connect')).toBeHidden();
  await upload(page);await page.locator('#post-type').selectOption('paper');await page.locator('#show-connect').click();await expect(page.locator('#publish-status')).toContainText('论文标题和作者');
  await page.locator('#post-type').selectOption('thought');await page.getByRole('tab',{name:'Markdown 正文'}).click();await page.locator('#markdown-body').fill('## 公式\n\n$$\n\\notARealMathCommand{x}\n$$');await page.locator('#show-connect').click();await expect(page.locator('#publish-status')).toContainText('无法渲染的公式');
});

test('GitHub 发布将文章与图片原子提交，令牌不保存且不覆盖已有文件',async({page})=>{
  const calls:{method:string;path:string;body:any}[]=[];let head='base-commit';let savedTree:any;let blobCount=0;let existing=false;
  await page.route('https://api.github.com/**',async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method(),body=request.postDataJSON();calls.push({method,path:url.pathname,body});
    expect(request.headers().authorization).toBe('Bearer fake-test-token');expect(url.search).not.toContain('fake-test-token');
    let result:any;let status=200;
    if(url.pathname==='/user')result={login:'Neroaway'};
    else if(url.pathname.endsWith('/git/ref/heads/master'))result={object:{sha:head}};
    else if(url.pathname.includes('/contents/')){status=existing?200:404;result=existing?{type:'file',sha:'existing-note'}:{message:'not found'};}
    else if(url.pathname.endsWith('/git/commits/base-commit'))result={tree:{sha:'base-tree'}};
    else if(url.pathname.endsWith('/git/blobs'))result={sha:`blob-${++blobCount}`};
    else if(url.pathname.endsWith('/git/trees')){savedTree=body;result={sha:'new-tree'};}
    else if(url.pathname.endsWith('/git/commits')){expect(body.parents).toEqual(['base-commit']);result={sha:'new-commit'};}
    else if(url.pathname.endsWith('/git/refs/heads/master')){expect(body).toEqual({sha:'new-commit',force:false});head=body.sha;result={object:{sha:head}};}
    else throw new Error(`未预期的 GitHub 请求：${method} ${url.pathname}`);
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.goto('write/');await upload(page,sampleDocument+'\n![测试图片](figure.png)');
  await page.locator('#show-connect').click();await expect(page.locator('#publish-status')).toContainText('一并选择');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  await page.locator('#image-files').setInputFiles({name:'figure.png',mimeType:'image/png',buffer:png});
  await expect(page.locator('#markdown-preview img')).toHaveAttribute('src',/^blob:/);
  await page.locator('#show-connect').click();await page.locator('#github-token').fill('fake-test-token');await page.locator('#publish-post').click();
  await expect(page.locator('#publish-status')).toContainText('文章与图片已提交');
  expect(savedTree.base_tree).toBe('base-tree');expect(savedTree.tree.map((entry:any)=>entry.path)).toEqual(['src/content/posts/uploaded-note.md','public/images/uploads/uploaded-note/image-1.png']);
  const postBlob=calls.find(c=>c.path.endsWith('/git/blobs'));const content=Buffer.from(postBlob!.body.content,'base64').toString('utf8');expect(content).toContain('一份中文上传笔记');expect(content).toContain('/images/uploads/uploaded-note/image-1.png');
  await expect(page.locator('#github-token')).toHaveValue('');expect(await page.evaluate(()=>JSON.stringify({...localStorage})+JSON.stringify({...sessionStorage}))).not.toContain('fake-test-token');
  expect(calls.filter(c=>c.method==='PATCH')).toHaveLength(1);
  existing=true;await upload(page);await page.locator('#show-connect').click();await page.locator('#github-token').fill('fake-test-token');await page.locator('#publish-post').click();await expect(page.locator('#publish-status')).toContainText('已存在');
  expect(calls.filter(c=>c.method==='PATCH')).toHaveLength(1);
});

test('拒绝 GitHub 权限错误，保留文档以便重试',async({page})=>{
  await page.route('https://api.github.com/**',route=>route.fulfill({status:403,contentType:'application/json',body:'{"message":"forbidden"}'}));
  await page.goto('write/');await upload(page);await page.locator('#show-connect').click();await page.locator('#github-token').fill('fake-test-token');await page.locator('#publish-post').click();
  await expect(page.locator('#publish-status')).toContainText('Contents 写入权限');await expect(page.locator('#post-title')).toBeEnabled();await expect(page.locator('#post-title')).toHaveValue('一份中文上传笔记');await expect(page.locator('#github-token')).toHaveValue('');
});
