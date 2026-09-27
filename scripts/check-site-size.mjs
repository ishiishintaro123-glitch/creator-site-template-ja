// Warns before the site outgrows the free plans, for the content workflow to report in a GitHub issue:
// - Cloudflare Workers (Free) serves at most 20,000 files per site. Each manga page and illustration is written in
//   several sizes for different screens (the widths in src/pages and src/components), so images add up fast.
// - GitHub recommends keeping a repository under 1 GB. Every uploaded image stays in its history.
// The file count is an estimate from the content (building the site here would use up Actions minutes); it errs on
// the high side. Prints JSON: { over, title, body, resolved }.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { siteConfig } from '../src/site-config.mjs';

const MAX_FILES = 20_000; // Workers Free; Workers Paid allows 100,000
const MAX_REPO_BYTES = 1024 ** 3;
const WARN_AT = 0.8;

// Files built per image, from the widths each is shown at (plus a share card image for covers and illustrations).
const FILES_PER_MANGA_PAGE = 4; // Three widths and the original
const FILES_PER_COVER = 5;
const FILES_PER_ILLUSTRATION = 10; // First image of a post: also its tile and card
const FILES_PER_EXTRA_ILLUSTRATION = 4;
const FIXED_FILES = 50; // Fonts, scripts, styles, lists, tag pages and the like

function entries(dir) {
	const path = join('src/content', dir);
	if (!existsSync(path)) return [];
	return readdirSync(path)
		.filter((name) => name.endsWith('.yaml'))
		.map((name) => yaml.load(readFileSync(join(path, name), 'utf8'), { schema: yaml.CORE_SCHEMA }) ?? {});
}
const list = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);

let files = FIXED_FILES;
for (const work of entries('novels')) files += 1 + list(work.episodes).length + (work.cover ? FILES_PER_COVER : 0);
for (const part of entries('novel-parts')) files += list(part.episodes).length;
for (const work of entries('manga')) {
	const episodes = list(work.episodes);
	files += 1 + FILES_PER_COVER + episodes.length;
	for (const episode of episodes) files += list(episode.pages).length * FILES_PER_MANGA_PAGE;
}
for (const post of entries('illustrations')) {
	const images = list(post.images);
	files += 1 + (images.length > 0 ? FILES_PER_ILLUSTRATION + (images.length - 1) * FILES_PER_EXTRA_ILLUSTRATION : 0);
}

// What GitHub counts: the whole history, packed. The workflow checks out full history.
const counts = Object.fromEntries(
	execFileSync('git', ['count-objects', '-v'], { encoding: 'utf8' })
		.trim()
		.split('\n')
		.map((line) => line.split(': ')),
);
const repoBytes = (Number(counts.size) + Number(counts['size-pack'])) * 1024;

const fileShare = files / MAX_FILES;
const repoShare = repoBytes / MAX_REPO_BYTES;
const over = fileShare >= WARN_AT || repoShare >= WARN_AT;
const percent = (share) => `${Math.round(share * 100)}%`;
const megabytes = (bytes) => `${Math.round(bytes / 1024 ** 2)}MB`;
const ja = siteConfig.language === 'ja';

const body = ja
	? `サイトの大きさが、無料で使える上限の${percent(WARN_AT)}を超えました。

| | 今 | 上限 | |
|---|---|---|---|
| サイトのファイル数（目安） | 約${files.toLocaleString()}個 | ${MAX_FILES.toLocaleString()}個（Cloudflareの無料プラン） | ${percent(fileShare)} |
| リポジトリの容量 | ${megabytes(repoBytes)} | 1GB（GitHubの推奨） | ${percent(repoShare)} |

ファイル数の上限を超えると、サイトの更新が止まります（それまでのサイトは表示されたままです）。漫画の1ページやイラストの1枚は、読者の画面に合わせて何通りかの大きさで書き出すため、画像が多いとファイル数が増えます。

**できること**
- これからアップロードする画像を小さくする（漫画のページは横幅1200ピクセルあれば十分です）。アップロード済みの画像は、削除しても履歴に残るため容量は減りません
- リポジトリの容量の1GBはGitHubの推奨で、超えてもすぐに使えなくなるわけではありません。5GBを超えないようにしてください
- ファイル数が上限に近いときは、Cloudflareの有料プラン（Workers Paid、月5ドル〜）にすると上限が10万個になります
- 作品が増え続ける場合は、漫画・イラスト用に2つ目のサイトを作って分ける方法もあります

このお知らせは、保存のたびに自動で更新され、上限の${percent(WARN_AT)}を下回ると自動で閉じます。詳しくは手順書「4_画像.md」の「画像の量の上限」を見てください。`
	: `Your site has passed ${percent(WARN_AT)} of what the free plans allow.

| | Now | Limit | |
|---|---|---|---|
| Files on the site (estimate) | about ${files.toLocaleString()} | ${MAX_FILES.toLocaleString()} (Cloudflare Free plan) | ${percent(fileShare)} |
| Repository size | ${megabytes(repoBytes)} | 1 GB (GitHub's recommendation) | ${percent(repoShare)} |

Past the file limit, your site stops updating (the current site stays up). Each manga page and illustration is written in several sizes to suit readers' screens, so many images mean many files.

**What you can do**
- Upload smaller images from now on (1,200 pixels wide is plenty for a manga page). Images already uploaded stay in the history even if deleted, so deleting them doesn't reduce the size
- The 1 GB repository size is GitHub's recommendation; going over doesn't stop anything right away. Keep it under 5 GB
- If the file count is near the limit, Cloudflare's paid plan (Workers Paid, from $5 a month) raises it to 100,000
- If your works keep growing, you can also split manga and illustrations into a second site

This issue is updated on every save and closes itself once both are back under ${percent(WARN_AT)}. See "Limits on the number of images" in the image guide for details.`;

console.log(
	JSON.stringify({
		over,
		title: ja ? 'サイトの大きさが無料の上限に近づいています' : 'Your site is nearing the free plan limits',
		body,
		resolved: ja
			? `サイトの大きさが上限の${percent(WARN_AT)}を下回りました（ファイル数 約${files.toLocaleString()}個・リポジトリ ${megabytes(repoBytes)}）。`
			: `Your site is back under ${percent(WARN_AT)} of the limits (about ${files.toLocaleString()} files, repository ${megabytes(repoBytes)}).`,
	}),
);
