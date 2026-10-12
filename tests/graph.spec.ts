import { test,expect } from '@playwright/test';

test('关系图加载、真实连线、节点选择、缩放、主题与筛选',async({page,isMobile})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const index=await (await page.request.get('graph-index.json')).json();
  await page.goto('graph/');const graph=page.locator('[data-note-graph]');await expect(graph).toHaveAttribute('data-ready','true');
  await expect(graph.locator('.graph-node:not(.node-topic)')).toHaveCount(index.nodes.length);
  const pairs=new Set(index.links.map((link:{source:string;target:string})=>[link.source,link.target].sort().join('|')));
  await expect(graph.locator('.graph-edge:not(.topic-edge)')).toHaveCount(pairs.size);
  const node=graph.locator('.graph-node:not(.node-topic) [role=button]').first();
  if(index.nodes.length){
    if(isMobile)await node.tap();else await node.click();await expect(graph.locator('.graph-node.is-selected')).toHaveCount(1);await expect(graph.locator('[data-graph-open]')).toBeVisible();
    await expect(graph.locator('[data-graph-title]')).toHaveText(index.nodes[0].title);
    const layer=graph.locator('.graph-canvas>g');const before=await layer.getAttribute('transform');await graph.getByRole('button',{name:'放大关系图'}).click();expect(await layer.getAttribute('transform')).not.toEqual(before);
    await graph.getByRole('button',{name:'适应视图'}).click();await expect(graph.locator('.graph-node.is-selected')).toHaveCount(0);
    await graph.locator('[data-graph-topics]').check();expect(await graph.locator('.node-topic').count()).toBeGreaterThan(0);expect(await graph.locator('.topic-edge').count()).toBeGreaterThan(0);
    await graph.locator('[data-graph-topics]').uncheck();await expect(graph.locator('.node-topic')).toHaveCount(0);
    await graph.locator('[data-graph-search]').fill('肯定不存在的关键词xyz');await expect(graph.locator('.graph-node')).toHaveCount(0);await expect(graph.locator('[data-graph-message]')).toContainText('没有匹配');
    await graph.getByRole('button',{name:'适应视图'}).click();await expect(graph.locator('.graph-node')).toHaveCount(index.nodes.length);
    await graph.locator('[data-graph-type]').selectOption('paper');await expect(graph.locator('.node-thought')).toHaveCount(0);
    await graph.getByRole('button',{name:'适应视图'}).click();
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.locator('#theme-toggle').click();await expect(graph).toBeVisible();expect(errors).toEqual([]);
});

test('正文双括号链接、局部图与反向链接，进入中心视图并阅读',async({page})=>{
  const index=await (await page.request.get('graph-index.json')).json();
  test.skip(!index.nodes.some((node:{id:string})=>node.id==='demo-paper')||!index.nodes.some((node:{id:string})=>node.id==='demo-thought'),'演示文章已删除');
  await page.goto('posts/demo-thought/');const link=page.locator('.prose').getByRole('link',{name:'论文阅读示例',exact:true});await expect(link).toHaveAttribute('href',/\/posts\/demo-paper\//);await link.click();
  const local=page.locator('.graph-compact');await expect(local).toHaveAttribute('data-ready','true');const neighbors=new Set(['demo-paper']);for(const link of index.links){if(link.source==='demo-paper')neighbors.add(link.target);if(link.target==='demo-paper')neighbors.add(link.source);}
  await expect(local.locator('.graph-node')).toHaveCount(neighbors.size);
  await expect(page.locator('.connection-lists')).toContainText(`反向链接 · ${new Set(index.links.filter((link:{target:string})=>link.target==='demo-paper').map((link:{source:string})=>link.source)).size}`);
  await page.getByRole('link',{name:'在全站关系图中查看 ↗'}).click();await expect(page).toHaveURL(/focus=demo-paper/);
  await expect(page.locator('[data-graph-neighbors]')).toBeChecked();await expect(page.locator('[data-graph-title]')).toContainText('从问题到证据');
  await page.locator('[data-graph-open]').click();await expect(page.locator('h1')).toContainText('从问题到证据');
});

test('节点键盘操作和拖动不误打开文章',async({page,isMobile})=>{
  test.skip(isMobile,'桌面验证鼠标拖动和键盘，手机交互在其他检查中验证');
  await page.goto('graph/');const graph=page.locator('[data-note-graph]');await expect(graph).toHaveAttribute('data-ready','true');
  const node=graph.locator('.graph-node:not(.node-topic) [role=button]').first();test.skip(await node.count()===0,'暂无文章');
  await node.focus();await page.keyboard.press('Enter');await expect(graph.locator('.is-selected')).toHaveCount(1);
  const circle=node.locator('.graph-dot');const box=await circle.boundingBox();expect(box).not.toBeNull();
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down();await page.mouse.move(box!.x+65,box!.y+30,{steps:8});await page.mouse.up();
  await expect(page).toHaveURL(/\/graph\//);await expect(circle).toBeVisible();
});

test('手机双指缩放与触控平移',async({page,isMobile})=>{
  test.skip(!isMobile,'仅在触控设备上运行');
  await page.goto('graph/');const graph=page.locator('[data-note-graph]');await expect(graph).toHaveAttribute('data-ready','true');
  await graph.locator('.graph-canvas').scrollIntoViewIfNeeded();
  const box=await graph.locator('.graph-canvas').boundingBox();expect(box).not.toBeNull();
  const layer=graph.locator('.graph-canvas>g');const before=await layer.getAttribute('transform');
  const client=await page.context().newCDPSession(page);
  const x=box!.x+box!.width/2,y=box!.y+100;
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-25,y,id:0},{x:x+25,y,id:1}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-70,y,id:0},{x:x+70,y,id:1}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(await layer.getAttribute('transform')).not.toEqual(before);
  const afterZoom=await layer.getAttribute('transform');
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box!.x+30,y:box!.y+75,id:0}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box!.x+70,y:box!.y+90,id:0}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(await layer.getAttribute('transform')).not.toEqual(afterZoom);await client.detach();
});
