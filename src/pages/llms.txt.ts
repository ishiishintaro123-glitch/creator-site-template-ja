import type { APIRoute } from 'astro';
import { siteConfig, t } from '../site-config.mjs';
import { getIllustrations } from '../lib/illustrations';
import { getManga } from '../lib/manga';
import { getWorks } from '../lib/novels';

// Keep each entry on one line so a title or synopsis can't break the Markdown structure.
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();
const entry = (title: string, href: string, summary: string) =>
	`- [${oneLine(title)}](${href})${summary ? `: ${oneLine(summary)}` : ''}`;

export const GET: APIRoute = async () => {
	const [novels, manga, illustrations] = await Promise.all([getWorks(), getManga(), getIllustrations()]);
	// Only genres that have works get a section.
	const sections = [
		[t.llmsNovelsHeading, novels.map((work) => entry(work.title, `/novels/${work.slug}/`, work.synopsis))],
		[t.llmsMangaHeading, manga.map((work) => entry(work.title, `/manga/${work.slug}/`, work.synopsis))],
		[
			t.llmsIllustrationsHeading,
			illustrations.map((item) => entry(item.label, `/illustrations/${item.slug}/`, item.description)),
		],
	]
		.filter(([, lines]) => lines.length > 0)
		.map(([heading, lines]) => `## ${heading}\n${(lines as string[]).join('\n')}\n`)
		.join('\n');

	const body = `# ${oneLine(siteConfig.siteName)}

> ${oneLine(siteConfig.description)}

${t.llmsAuthorLine(oneLine(siteConfig.author))}

${sections}
## ${t.llmsCopyrightHeading}
${t.llmsCopyrightBody}
`;
	return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
