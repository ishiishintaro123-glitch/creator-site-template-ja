import type { APIRoute } from 'astro';
import { siteConfig, t } from '../site-config.mjs';
import { getIllustrations } from '../lib/illustrations';
import { getManga } from '../lib/manga';
import { getWorks } from '../lib/novels';

// Update feed for RSS readers: every new episode and illustration, newest first. Scheduled posts join it when
// they are published, since the loaders leave them out until then. Readers find it from the <link> in each page.
const MAX_ITEMS = 50;

const escape = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const absolute = (path: string) => new URL(path, `${siteConfig.url}/`).toString();

interface Item {
	title: string;
	path: string;
	description: string;
	date: Date;
}

export const GET: APIRoute = async () => {
	const [novels, manga, illustrations] = await Promise.all([getWorks(), getManga(), getIllustrations()]);
	const items: Item[] = [
		...novels.flatMap((work) =>
			work.episodes.map((episode) => ({
				title: `${work.title} ${t.episodeLabel(episode.number, episode.title)}`,
				path: `/novels/${episode.id}/`,
				description: work.synopsis,
				date: episode.publishedAt,
			})),
		),
		...manga.flatMap((work) =>
			work.episodes.map((episode) => ({
				title: `${work.title} ${t.episodeLabel(episode.number, episode.title)}`,
				path: `/manga/${episode.id}/`,
				description: work.synopsis,
				date: episode.publishedAt,
			})),
		),
		...illustrations.map((illustration) => ({
			title: illustration.label,
			path: `/illustrations/${illustration.slug}/`,
			description: illustration.description,
			date: illustration.publishedAt,
		})),
	]
		.sort((a, b) => b.date.valueOf() - a.date.valueOf())
		.slice(0, MAX_ITEMS);

	const entries = items
		.map(
			(item) => `    <item>
      <title>${escape(item.title)}</title>
      <link>${escape(absolute(item.path))}</link>
      <guid isPermaLink="true">${escape(absolute(item.path))}</guid>
      <pubDate>${item.date.toUTCString()}</pubDate>${item.description ? `\n      <description>${escape(item.description)}</description>` : ''}
    </item>`,
		)
		.join('\n');

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(siteConfig.siteName)}</title>
    <link>${escape(absolute('/'))}</link>
    <atom:link href="${escape(absolute('/rss.xml'))}" rel="self" type="application/rss+xml" />
    <description>${escape(siteConfig.description)}</description>
    <language>${t.htmlLang}</language>
${entries}
  </channel>
</rss>
`;
	return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
