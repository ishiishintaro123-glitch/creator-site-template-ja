import type { APIRoute } from 'astro';
import { getEntries } from '../lib/content';
import { isReleased } from '../lib/dates.mjs';

// When the next scheduled episode or illustration comes out, for the Worker's cron (worker/index.js), which rebuilds
// the site through a deploy hook once that time has passed. The Worker keeps this file from being served.
export const GET: APIRoute = async () => {
	const [novels, parts, manga, illustrations] = await Promise.all([
		getEntries('novels'),
		getEntries('novelParts'),
		getEntries('manga'),
		getEntries('illustrations'),
	]);
	const dates = [
		...[...novels, ...parts, ...manga].flatMap((entry) => entry.data.episodes.map((episode) => episode.publishedAt)),
		...illustrations.map((entry) => entry.data.publishedAt),
	];
	const upcoming = dates.filter((date) => !isReleased(date)).sort((a, b) => a.valueOf() - b.valueOf());
	return new Response(JSON.stringify({ next: upcoming[0]?.toISOString() ?? null }), {
		headers: { 'Content-Type': 'application/json' },
	});
};
