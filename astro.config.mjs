import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { siteConfig, deploymentBase } from './site.config.mjs';
// Markdown 的 /images/ 与 /posts/ 链接也统一添加部署前缀。
function remarkBase() {
  const base = process.env.SITE_BASE ?? deploymentBase();
  return tree => {
    function visit(node) {
      if ((node.type === 'link' || node.type === 'image') && node.url?.startsWith('/') && !node.url.startsWith('//')) {
        node.url = `${base.replace(/\/$/, '')}${node.url}`;
      }
      node.children?.forEach(visit);
    }
    visit(tree);
  };
}
export default defineConfig({
  site: process.env.SITE_URL || siteConfig.origin,
  base: process.env.SITE_BASE ?? deploymentBase(),
  trailingSlash: 'always',
  output: 'static',
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath, remarkBase],
      rehypePlugins: [[rehypeKatex, { strict: 'warn', throwOnError: true }]],
    }),
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
});
