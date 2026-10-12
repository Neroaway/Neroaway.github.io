import { test, expect } from '@playwright/test';
test('首页筛选、主题切换与手机宽度',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');await expect(page.locator('h1')).toContainText('在阅读中理解');
  expect(await page.locator('.post-card:visible').count()).toBeGreaterThan(0);
  await page.getByRole('button',{name:'论文阅读',exact:true}).click();
  for(const type of await page.locator('.post-card:visible .type-label').allTextContents()) expect(type).toBe('论文阅读');
  await page.getByRole('button',{name:'独立思考',exact:true}).click();
  for(const type of await page.locator('.post-card:visible .type-label').allTextContents()) expect(type).toBe('独立思考');
  await page.locator('#theme-toggle').click();const theme=await page.locator('html').getAttribute('data-theme');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme',theme!);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();expect(errors).toEqual([]);
});
test('搜索标题、标签和独有正文，空状态与特殊字符',async({page})=>{
  const index = await (await page.request.get('search-index.json')).json();
  test.skip(!index.some((p:{url:string})=>p.url.endsWith('/posts/demo-paper/')), '演示文章已删除');
  await page.goto('search/');const input=page.getByRole('searchbox');
  for(const [query,title] of [['从问题到证据','从问题到证据'],['反例','把一个直觉'],['冲突证据','从问题到证据']]){
    await input.fill(query);await page.getByRole('button',{name:'搜索 →',exact:true}).click();await expect(page.locator('#search-results')).toContainText(title);
  }
  await input.fill('找不到的关键词xyz');await expect(page.locator('#search-status')).toContainText('没有找到');
  await input.fill('<img src=x onerror=alert(1)>');await expect(page.locator('#search-status')).toContainText('没有找到');await expect(page.locator('#search-results img')).toHaveCount(0);
  await input.fill('');await expect(page.locator('#search-status')).toContainText('输入关键词');
});
test('文章公式、图片、代码、目录、相关笔记与主题导航',async({page})=>{
  const index = await (await page.request.get('search-index.json')).json();
  test.skip(!index.some((p:{url:string})=>p.url.endsWith('/posts/demo-paper/')) || !index.some((p:{url:string})=>p.url.endsWith('/posts/demo-thought/')), '演示文章已删除');
  const failed:string[]=[];page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
  await page.goto('posts/demo-paper/');await expect(page.locator('.katex').first()).toBeVisible();await expect(page.locator('.katex-error')).toHaveCount(0);
  await expect(page.locator('.prose img')).toBeVisible();expect(await page.locator('.prose img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBeTruthy();
  await expect(page.locator('pre.astro-code')).toBeVisible();await expect(page.locator('table')).toBeVisible();
  await page.locator('.toc').getByRole('link',{name:'核心问题',exact:true}).click();await expect(page).toHaveURL(/#核心问题|#%/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.locator('.related h3 a').click();await expect(page.locator('h1')).toContainText('把一个直觉');
  await page.goto('topics/');await page.locator('.topic-card').first().click();expect(await page.locator('.post-card').count()).toBeGreaterThan(0);
  expect(failed).toEqual([]);
});
test('暗色系统默认与用户明色偏好',async({page})=>{
  await page.emulateMedia({colorScheme:'dark'});await page.goto('./');
  expect(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor)).toBe('rgb(23, 29, 26)');
  await page.locator('#theme-toggle').click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  expect(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor)).toBe('rgb(250, 249, 246)');
});
