import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { deploymentBase, siteConfig } from '../../site.config.mjs';

// Parse only prose links: fenced/inline code and image destinations never become edges.
const parser = unified().use(remarkParse).use(remarkGfm);
export function wikiParts(value) {
  const [target, ...alias] = value.split('|');
  const clean = target.trim().replace(/\.md(?=#|$)/, '');
  const [id, ...hash] = clean.split('#');
  return { id: id.trim(), hash: hash.join('#'), label: alias.join('|').trim() || id.trim() };
}
export function articleHref(id, hash = '') {
  return `/posts/${id.split('/').map(encodeURIComponent).join('/')}/${hash ? `#${encodeURIComponent(hash)}` : ''}`;
}
export function proseLinks(body) {
  const tree = parser.parse(body);
  const definitions = new Map();
  function definitionsWalk(node) {
    if (node.type === 'definition') definitions.set(node.identifier, node.url);
    node.children?.forEach(definitionsWalk);
  }
  definitionsWalk(tree);
  const links = [];
  function walk(node) {
    if (node.type === 'link') links.push(node.url);
    if (node.type === 'linkReference' && definitions.has(node.identifier)) links.push(definitions.get(node.identifier));
    if (node.type === 'text') for (const match of node.value.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
      const {id, hash} = wikiParts(match[1]);
      links.push(articleHref(id, hash));
    }
    // Do not infer links from unparsed HTML, code samples or image alt text.
    if (!['code', 'inlineCode', 'image', 'imageReference', 'link', 'linkReference'].includes(node.type)) node.children?.forEach(walk);
  }
  walk(tree);
  return links;
}
export function resolveArticleLink(href, sourceId, base = '/', origin = siteConfig.origin) {
  const prefix = base.replace(/\/$/, '');
  try {
    const current = new URL(`${prefix}${articleHref(sourceId)}`, origin);
    const target = new URL(href, current);
    if (target.origin !== current.origin) return null;
    let path = decodeURIComponent(target.pathname);
    if (prefix && path.startsWith(`${prefix}/`)) path = path.slice(prefix.length);
    const match = path.match(/^\/posts\/(.+?)(?:\/|\.md)?$/);
    return match ? match[1] : null;
  } catch { return null; }
}
export function buildConnections(posts, base = deploymentBase(), origin = siteConfig.origin) {
  const published = posts.filter(p => !p.data.draft);
  const ids = new Set(published.map(p => p.id));
  const links = new Map();
  const missing = [];
  for (const post of published) {
    function add(target, kind) {
      if (!target || target === post.id) return;
      if (!ids.has(target)) { missing.push({source:post.id,target,kind});return; }
      const key = `${post.id}\0${target}\0${kind}`;
      links.set(key, {source:post.id,target,kind});
    }
    for (const href of proseLinks(post.body ?? '')) add(resolveArticleLink(href,post.id,base,origin),'link');
    for (const target of post.data.related ?? []) add(target,'related');
  }
  const nodes = published.map(post => ({
    id:post.id, title:post.data.title, type:post.data.type,
    description:post.data.description, topics:post.data.topics, tags:post.data.tags,
    demo:post.data.demo ?? false,
    url:`${base.replace(/\/$/,'')}${articleHref(post.id)}`,
  }));
  return {nodes,links:[...links.values()],missing};
}
