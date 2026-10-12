import {test,expect} from '@playwright/test';
test('320–1440px 页面与长中文标题没有页面级横向溢出',async({page,isMobile})=>{
  test.skip(isMobile,'使用桌面项目逐个切换视口，手机触控由其他测试覆盖');
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:1000});
    for(const route of ['./','posts/demo-paper/','graph/','write/','archive/','topics/','search/']){
      await page.goto(route);
      if(route==='graph/')await expect(page.locator('[data-note-graph]')).toHaveAttribute('data-ready','true');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route} at ${width}px`).toBeTruthy();
      await page.locator('.post-card h3 a,.paper-info h2,.paper-info dd,.graph-detail h2').evaluateAll(elements=>elements.forEach(element=>element.textContent='一个关于多模态推理与证据一致性的很长中文标题'.repeat(4)+'VeryLongEnglishPaperTitleWithoutAnySpaces'.repeat(4)));
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`long text: ${route} at ${width}px`).toBeTruthy();
    }
  }
});

test('引用箭头位于连线端点，拖动后仍共线，双向引用两端有箭头',async({page})=>{
  await page.goto('graph/');await expect(page.locator('[data-note-graph]')).toHaveAttribute('data-ready','true');
  await expect(page.locator('.graph-node a')).toHaveCount(0);
  const line=page.locator('.graph-edge:not(.topic-edge)').first();test.skip(!await line.count(),'暂无关联笔记');
  const index=await (await page.request.get('graph-index.json')).json();
  const from=await line.getAttribute('data-source'),to=await line.getAttribute('data-target');
  const forward=index.links.some((l:any)=>l.source===from&&l.target===to&&l.kind==='link');const reverse=index.links.some((l:any)=>l.source===to&&l.target===from&&l.kind==='link');
  if(forward)await expect(line).toHaveAttribute('marker-end',/^url\(#arrow-/);else expect(await line.getAttribute('marker-end')).toBeNull();
  if(reverse)await expect(line).toHaveAttribute('marker-start',/^url\(#arrow-/);else expect(await line.getAttribute('marker-start')).toBeNull();
  await expect(page.locator('marker')).toHaveAttribute('orient','auto-start-reverse');
  const aligned=await line.evaluate(element=>{
    const line=element as SVGLineElement;const nodes=[...document.querySelectorAll<SVGGElement>('.graph-node')];
    const from=nodes.find(n=>n.dataset.id===line.dataset.source)!.transform.baseVal.consolidate()!.matrix;
    const to=nodes.find(n=>n.dataset.id===line.dataset.target)!.transform.baseVal.consolidate()!.matrix;
    const dx=to.e-from.e,dy=to.f-from.f;
    const cross=(x:number,y:number)=>Math.abs((x-from.e)*dy-(y-from.f)*dx);
    return cross(line.x1.baseVal.value,line.y1.baseVal.value)<.1&&cross(line.x2.baseVal.value,line.y2.baseVal.value)<.1;
  });expect(aligned).toBeTruthy();
});
