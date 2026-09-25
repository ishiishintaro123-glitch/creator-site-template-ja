import type { APIRoute } from 'astro';
import { siteConfig } from '../site-config.mjs';

// Crawlers that collect pages for AI services (training, AI search and answers), from the major companies and
// Common Crawl, whose data many AI models are trained on. Search engines' own crawlers (Googlebot, Bingbot) are
// left alone so the site stays in search results. Google-Extended and Applebot-Extended aren't separate crawlers:
// they tell Google and Apple not to use the pages they already crawl for their AI.
const AI_CRAWLERS = [
	'GPTBot',
	'OAI-SearchBot',
	'ChatGPT-User',
	'ClaudeBot',
	'Claude-SearchBot',
	'Claude-User',
	'anthropic-ai',
	'Google-Extended',
	'Applebot-Extended',
	'PerplexityBot',
	'Perplexity-User',
	'Meta-ExternalAgent',
	'Meta-ExternalFetcher',
	'Amazonbot',
	'Bytespider',
	'CCBot',
	'cohere-ai',
	'MistralAI-User',
	'DuckAssistBot',
	'Diffbot',
];

export const GET: APIRoute = ({ site }) => {
	const sitemapUrl = new URL('/sitemap-index.xml', site).toString();
	const aiGroup = siteConfig.blockAi
		? `${AI_CRAWLERS.map((name) => `User-agent: ${name}`).join('\n')}\nDisallow: /\n\n`
		: '';
	return new Response(`${aiGroup}User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
