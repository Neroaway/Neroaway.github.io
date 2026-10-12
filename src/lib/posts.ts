import { getCollection, type CollectionEntry } from 'astro:content';
export type Post = CollectionEntry<'posts'>;
export const url = (path = '') => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
export const date = (value: Date) => value.toISOString().slice(0, 10);
export const typeName = (type: string) => type === 'paper' ? '论文阅读' : '独立思考';
export async function allPosts() {
  return (await getCollection('posts', p => !p.data.draft)).sort((a, b) => b.data.published.valueOf() - a.data.published.valueOf());
}
export const postUrl = (post: Post) => url(`posts/${post.id}/`);
export const topicUrl = (topic: string) => url(`topics/${encodeURIComponent(topic)}/`);
export const tagUrl = (tag: string) => url(`tags/${encodeURIComponent(tag)}/`);
