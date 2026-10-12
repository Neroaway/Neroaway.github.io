# ThinkingByThinking

Neroaway 的中文论文阅读与研究思考博客。采用 **Astro 7 + Markdown + KaTeX + Shiki**，纯静态输出，托管于 GitHub Pages；没有数据库、服务器或付费搜索服务。选择 Astro 是因为它能直接管理仓库中的 Markdown、校验文章元数据，并在构建时完成公式与代码渲染；读者只需下载少量用于搜索和主题切换的 JavaScript。

- 网站：https://neroaway.github.io/
- 仓库：https://github.com/Neroaway/Neroaway.github.io
- 两篇示例均标有「演示内容」，不报告真实论文结论。
- 旧博客内容按作者要求移除，历史 Git 提交仍可追溯。

## 本地预览

需要 Node.js **24 LTS** 与 npm。依赖版本由 `package-lock.json` 锁定。

```bash
npm ci
npm run dev
```

打开终端输出的本地地址，默认 http://localhost:4321/。编辑 Markdown 后开发服务器会自动刷新。

```bash
npm run check
npm run build
npm run verify
npm run preview
```

`dist/` 是构建产物，不提交。若受限环境禁止 Astro 写入用户配置目录，运行命令前添加 `ASTRO_TELEMETRY_DISABLED=1`，例如 `ASTRO_TELEMETRY_DISABLED=1 npm run build`。Actions 中已设置此变量。

## 发布第一篇真实笔记

```bash
npm run new -- paper my-first-paper
# 独立思考使用：npm run new -- thought my-first-idea
```

脚本复制 `templates/paper.md` 或 `templates/thought.md` 到 `src/content/posts/`，填写上海时区当天的日期，不覆盖已有文件。

1. 编辑新文件，填写标题、摘要、主题、标签、论文信息和正文。论文类型 `paper` 必须包含 `paper` 信息；独立思考用 `thought`。
2. 模板默认 `draft: true`，不会出现在站点、搜索和归档中。完成后改成 `draft: false`。真实文章保持 `demo: false`。
3. `published` 是发布日期；修改后更新 `updated`，不得早于发布日期。使用 `YYYY-MM-DD`。`topics` 至少填写一个，主题与标签页面自动生成。
4. `related` 填其他文章的文件名（不含 `.md`），例如 `[demo-thought]`。相关文章同时根据共同主题自动补充。
5. `references` 按 `{ title, url }` 填写链接，页面末尾自动显示。
6. 本地检查、构建后，提交并推送：

```bash
npm run check
npm run build
npm run verify
git add src/content/posts public/images
git commit -m "Add first paper reading note"
git push origin master
```

此仓库默认分支是 `master`。若使用新仓库的 `main` 分支，推送至 `main` 即可；工作流同时支持二者。建议在 GitHub 保护默认分支，避免两个分支同时作为发布来源。

也可以直接在 GitHub 网站上传或编辑 Markdown 并提交，Actions 会自动构建并部署。删除两个 `demo-*.md` 文件即可移除演示；同时移除真实文章里指向它们的链接。

## 论文元信息

```yaml
paper:
  title: "原始论文标题"
  authors: [作者一, 作者二]
  year: 2026
  venue: "会议、期刊或预印本"
  doi: "10.xxxx/xxxx"
  arxiv: "2601.00000"
  url: "https://原文地址"
```

`year`、`venue`、`doi`、`arxiv`、`url` 可省略。DOI 填编号；arXiv 填编号（可含版本号），站点会生成对应链接。不要把示例编号保留在真实笔记里。

## 区分论文证据、个人理解与猜想

普通 Markdown 引用块也可以直接写明「论文中的结论」「我的理解」「待验证猜想」。若需要彩色提示框，使用以下 HTML（标签内部用 HTML 段落，不嵌套 Markdown）：

```html
<div class="callout evidence">
<strong>论文中的结论</strong>
<p>写原文报告的结论，并注明章节、图表与适用条件。</p>
</div>

<div class="callout interpretation">
<strong>我的理解</strong>
<p>写自己的解释及不确定之处。</p>
</div>

<div class="callout hypothesis">
<strong>待验证猜想</strong>
<p>写可被反驳的假设、反例和验证方式。</p>
</div>
```

## 图片、公式、代码与链接

将图片放入 `public/images/`，使用有意义的替代文本：

```markdown
![图示说明](/images/your-figure.png)

行内公式：$L = \sum_i w_i e_i$。

$$
P(E\mid Q)>P(E\mid \neg Q)
$$

[另一篇笔记](/posts/my-first-paper/)
```

Markdown 的 `/images/` 与 `/posts/` 等站内根路径会在构建时自动添加项目仓库前缀。不要手工写仓库前缀，否则换仓库会失效。公式和 KaTeX 字体均打包到本站，不使用 CDN。代码围栏添加语言名，如 `python`、`typescript`，即可高亮。标准 Markdown 表格自动渲染；文章的二、三级标题自动进入目录。

Markdown 中建议使用标准图片与链接语法；原始 HTML 的 `src`、`href` 不经自动路径处理。普通 Markdown 不支持 `import`，组件代码需放在 `.astro` 中。

## 修改站点信息

集中修改 `site.config.mjs` 中的 `title`、`author`、`description`、`bio`、`github`、`repository`、`origin` 和 `language`。当前页面结构和界面文本为中文；若改成其他语言，还需要翻译 `.astro` 中的界面文本。颜色、正文宽度、字号和行距在 `src/styles/global.css` 中。支持跟随系统明暗主题，也可手动切换并保存浏览器偏好。

## GitHub Pages 部署

此配置已核对当前 [Astro Pages 指南](https://docs.astro.build/en/guides/deploy/github/)、[Astro 7 Markdown 迁移说明](https://docs.astro.build/en/guides/upgrade-to/v7/)、[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) 与 [GitHub 官方 Astro 工作流](https://github.com/actions/starter-workflows/blob/main/pages/astro.yml)（2026-10-12）。使用 `configure-pages@v5`、`upload-pages-artifact@v3`、`deploy-pages@v5`。Astro 7 使用显式 `unified()` 处理器运行 remark/rehype 插件。

### 已有仓库

1. 把项目代码推送到仓库默认分支。当前仓库为 `Neroaway/Neroaway.github.io`，默认分支 `master`。
2. 打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
3. 打开 **Actions → Build and deploy notebook**，首次可选择 **Run workflow**。之后推送自动发布。
4. 在工作流的 `deploy` 作业中查看最终 URL。构建、类型、链接或浏览器检查失败会阻止部署。

GitHub App 代码写入权限与 Pages 管理权限不同；若连接不能修改 Pages 设置，需要仓库管理员手动完成第 2 步。启用 Pages 无需把个人令牌存进仓库。

### 新仓库

推荐公开仓库。若已有 `gh` 并登录，可使用：

```bash
gh repo create Neroaway/reading-blog --public --source=. --remote=origin --push
# 已有 origin 时，先检查并使用 git remote set-url，而不是重复添加。
gh api --method POST repos/Neroaway/reading-blog/pages -f build_type=workflow
```

已启用 Pages 的仓库可以用以下命令切换发布来源：

```bash
gh api --method PUT repos/Neroaway/Neroaway.github.io/pages -f build_type=workflow
```

这需要拥有 Pages 管理权限的 GitHub 登录。命令可能触发组织审批；也可直接在 Settings 中设置。

### 主页与项目路径

| 仓库 | 默认网址 | 本地 `repository` |
| --- | --- | --- |
| `Neroaway.github.io` | `https://neroaway.github.io/` | `Neroaway.github.io` |
| `reading-blog` | `https://neroaway.github.io/reading-blog/` | `reading-blog` |

Actions 用 Pages 返回的 `origin` 和 `base_path` 设置 `SITE_URL`、`SITE_BASE`，导航、文章、搜索索引、Markdown 图片和文章链接共享这个前缀。自定义域名也以 Pages 配置为准。本地默认为配置中的仓库路径；可用环境变量模拟项目部署：

```bash
SITE_BASE=/reading-blog/ npm run build
SITE_BASE=/reading-blog/ npm run verify
SITE_BASE=/reading-blog/ npm run preview
```

空 `SITE_BASE` 表示网站根路径。更换仓库后同步修改 `site.config.mjs`，让本地预览与线上设置一致。

## 浏览器验证

```bash
npx playwright install --with-deps chromium
npm run build
npm test
```

包含桌面与 iPhone 13 尺寸下的首页筛选、搜索标题/标签/正文、空结果、特殊字符、主题保存、系统暗色、公式、图片、代码、目录、相关文章、分类与页面宽度检查。`npm run verify` 检查静态页面的本地链接、资源与锚点。

搜索是浏览器内的简单全文子串匹配，支持中文；用空格分隔多个关键词时要求全部匹配。首次搜索下载静态 JSON 索引，不发送关键词给外部服务。数百篇笔记通常足够；文章数量特别大时可换成分片索引。任何 `draft: true` 内容仍会保存在仓库中，因此不要把未公开研究秘密推送到公开仓库。

## 文件结构

```text
site.config.mjs          # 站点信息与默认部署路径
astro.config.mjs         # Markdown、公式、高亮及路径处理
src/content/posts/      # 新增 Markdown 文章
src/content.config.ts   # frontmatter 校验
src/pages/              # 首页、文章、归档、主题、标签、搜索
src/layouts/            # 页面框架
src/styles/global.css   # 响应式排版与明暗主题
public/images/          # 图片
templates/             # 两类文章模板（复制后再编辑）
scripts/                # 新文章与静态链接检查工具
tests/                  # 桌面、移动浏览器检查
.github/workflows/      # 自动验证、构建与 Pages 部署
```

## 笔记关系图（类似 Obsidian）

打开导航中的 **关系图**，或访问 https://neroaway.github.io/graph/。采用 D3 力导向布局，数据在构建时生成，交互完全在浏览器中完成。支持拖动节点、移动画布、滚轮/双指缩放、搜索、主题/类型筛选和一跳邻居视图；选中节点后，右侧「阅读这篇笔记」可以进入文章；文章中的局部图可直接点击节点阅读。

### 建立联系

正文中使用标准 Markdown 站内链接，或 Obsidian 风格的双括号链接：

```markdown
这个想法延伸自 [[my-first-paper|我的第一篇论文笔记]]。

也可以用标准链接：[我的第一篇论文笔记](/posts/my-first-paper/)。

跳到具体章节：[[my-first-paper#核心问题|核心问题]]。
```

目标是 `src/content/posts/` 下的**文件名，不含 `.md`**，不是文章标题；嵌套文件填写 `folder/note`。章节名必须与实际标题生成的锚点一致。请勿在尚未写好的公开文章中指向未发布的草稿或不存在的文件，链接检查会提醒修正。代码块中的链接示例不会生成关系图连线。

如果只是想明确关联两篇文章，但不在正文引用，也可填写 frontmatter：

```yaml
related: [my-first-paper, another-note]
```

图中实线表示「正文引用 / 显式关联」，引用箭头与线段方向一致，指向被引用笔记；双向引用在线段两端显示箭头，单纯的 related 关联不画方向箭头。右侧详情区区分「本文引用」「反向链接」「显式关联」。文章末尾自动展示局部关系图和反向链接，不用在被引用文章中手工维护列表。

默认不把共同标签或主题当作文章引用。勾选「显示主题节点」后，灰色主题节点用虚线连接所属笔记，方便跨文章探索；主题联系并不代表论文结论有证据上的支持关系。演示文章仍清楚标记为演示。

新增或修改 Markdown 后，推送即可自动更新图谱、反向链接和搜索索引。草稿不显示，孤立笔记也会显示。可通过文章末尾的「在全站关系图中查看」进入以该笔记为中心的视图，例如 `/graph/?focus=my-first-paper`。图谱也提供普通文章列表和键盘操作：Tab 聚焦节点，Enter/空格选择，再 Tab 到详情区的文章链接后 Enter 阅读。

## 在网页中上传 Markdown

进入导航中的「写作」，或打开 https://neroaway.github.io/write/。

1. 拖入或选择 UTF-8 编码的 `.md` / `.markdown` 文档（最大 1 MB）。普通 Markdown 不必预先写 YAML；页面会从第一个一级标题和正文推断标题与摘要。
2. 核对标题、摘要、研究主题和日期。文章地址使用小写英文、数字及短横线。论文阅读类型还需要原始论文标题和作者。
3. 如文档引用本地图片，选择对应的图片文件。支持 PNG、JPEG、GIF、WebP 和 AVIF，每张最大 8 MB，总计最大 20 MB；同名图片不能重复。标准 Markdown 图片和引用式图片都会转换成站点中的图片路径。
4. 在「阅读预览」中查看文字、表格和数学公式；可以切换到「Markdown 正文」编辑。页面不会执行导入文档中的脚本。正文一级标题由站点自动生成，正文内部请用二级及以下标题。
5. 点击「连接 GitHub 并发布」，填入仅授权本仓库的精细访问令牌，Contents 权限选 Read and write。点击「发布到博客」后，文章和图片会在一次 Git 提交中写入 `master`，随后由 Actions 自动发布。页面会显示提交结果与发布进度。

访问令牌直接发送给 `api.github.com`，不会写入代码、仓库、localStorage 或 sessionStorage；提交结束或页面离开时会清空输入框。令牌仅需在你自己的浏览器中输入，不要放入 Markdown 或发送给别人。设置有效期及指定仓库即可限制授权范围。也可以先使用「下载 Markdown」保存规范化文档，稍后通过 GitHub 或 Git 发布；附带图片需同时放入导出文档指向的 `public/images/uploads/` 目录。

上传页只新建笔记，遇到重名文件会停止；已有文章仍通过 GitHub 编辑或本地 Markdown 修改。`related` 和正文笔记链接指向的文章需要已存在并公开。若分支保护要求 Pull Request，直接发布可能被拒绝，可以下载文档后按仓库的 PR 流程提交。

发布权限与仓库配置集中在 `site.config.mjs` 的 `githubOwner`、`repository`、`branch`。实现使用 GitHub 官方的 [Git 数据 API](https://docs.github.com/en/rest/git) 将图片与 Markdown 原子提交，分支更新设置 `force: false`，出现并发更新时停止，不覆盖其他提交。认证方式参考 [GitHub 精细访问令牌说明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)。

## 界面与中文排版

这次界面调整参考了 [AstroPaper](https://astro-paper.pages.dev/) 的简洁文章列表和 [reuixiy](https://io-oi.me/tech/redesign-this-blog-under-minimalism/) 对中文混排的设计思路，保留了本站的纸色与绿色强调。中文使用系统无衬线字体，正文约 16–17px，避免衬线回退和过密的中文字距；长标题、英文单词和元信息可自动换行，代码、宽表格与长公式在自身容器中滚动。图谱标签分行显示，引用箭头绑定在线段端点并沿线旋转；无方向的显式关联不显示箭头。

新增测试覆盖 UTF-8/YAML 导入、预览净化、图片重写、模拟 GitHub 发布（不向真实仓库发布测试文章）、重名/权限错误、箭头几何，以及 320、390、768、1024、1440px 下的长文本与页面溢出。
