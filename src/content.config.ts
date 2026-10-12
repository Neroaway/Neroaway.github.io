import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(), description: z.string(),
    type: z.enum(['paper', 'thought']),
    published: z.coerce.date(), updated: z.coerce.date().optional(),
    topics: z.array(z.string()).min(1), tags: z.array(z.string()).default([]),
    demo: z.boolean().default(false), draft: z.boolean().default(false),
    related: z.array(z.string()).default([]),
    references: z.array(z.object({ title: z.string(), url: z.url() })).default([]),
    paper: z.object({ title: z.string(), authors: z.array(z.string()), year: z.number().int().optional(), venue: z.string().optional(), doi: z.string().optional(), arxiv: z.string().optional(), url: z.url().optional() }).optional(),
  }).refine(p => p.type !== 'paper' || !!p.paper, { message: '论文笔记必须包含 paper 元信息' })
    .refine(p => !p.updated || p.updated >= p.published, { message: '更新日期不得早于发布日期' }),
});
export const collections = { posts };
