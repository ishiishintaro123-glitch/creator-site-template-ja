// Is anything scheduled due since the site was last built? Prints "yes" or "no" for
// .github/workflows/scheduled-publish.yml, which pushes a commit (making Cloudflare rebuild the site) on "yes".
// Usage: node scripts/scheduled-due.mjs <time of the latest commit, which the live site was built from>
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { siteConfig } from '../src/site-config.mjs';
import { parseSiteDate } from '../src/lib/dates.mjs';

const since = new Date(process.argv[2]);
if (Number.isNaN(since.valueOf())) throw new Error(`not a date: ${process.argv[2]}`);
const now = new Date();

// Every publishedAt in novels (and their later parts), manga and illustrations, however deep.
function publishDates(value, found = []) {
	if (Array.isArray(value)) value.forEach((item) => publishDates(item, found));
	else if (value && typeof value === 'object') {
		for (const [key, child] of Object.entries(value)) {
			if (key === 'publishedAt') found.push(child);
			else publishDates(child, found);
		}
	}
	return found;
}

let due = false;
for (const dir of ['novels', 'novel-parts', 'manga', 'illustrations']) {
	const path = join('src/content', dir);
	if (!existsSync(path)) continue;
	for (const file of readdirSync(path).filter((name) => name.endsWith('.yaml'))) {
		const data = yaml.load(readFileSync(join(path, file), 'utf8'));
		for (const value of publishDates(data)) {
			const date = parseSiteDate(value, siteConfig.timeZone);
			if (date && date > since && date <= now) due = true;
		}
	}
}
console.log(due ? 'yes' : 'no');
