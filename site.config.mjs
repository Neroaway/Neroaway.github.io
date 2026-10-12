export const siteConfig = {
  title: 'ThinkingByThinking',
  author: 'Neroaway',
  description: '在阅读中理解，在思考中提问。',
  bio: '我是 Neroaway。这里记录我的论文阅读、尚未解开的疑问，以及从阅读中生长的研究想法。慢一点，想清楚，再往前走。',
  github: 'https://github.com/Neroaway',
  repository: 'Neroaway.github.io',
  origin: 'https://neroaway.github.io',
  language: 'zh-CN',
};
export function deploymentBase(repository = siteConfig.repository, owner = siteConfig.author) {
  return repository.toLowerCase() === `${owner}.github.io`.toLowerCase() ? '/' : `/${repository}/`;
}
