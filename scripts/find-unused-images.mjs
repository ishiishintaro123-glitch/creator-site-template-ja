// Lists images in src/content/media/ that no work or setting uses any more, for the deploy workflow to report
// in a GitHub issue. Pages CMS saves an image to the repository the moment it is uploaded, so replaced covers,
// deleted episodes and uploads that were never saved leave images behind, cluttering Pages CMS's image picker.
// (Deleting them doesn't shrink the repository: they stay in its history.)
//
// Prints JSON: { count, title, body, resolved }. Nothing is deleted: the creator decides.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { siteConfig } from '../src/site-config.mjs';

const MEDIA_DIR = 'src/content/media';
const CONTENT_DIR = 'src/content';
const IMAGE = /\.(png|jpe?g|webp)$/i;
// Right after an upload the image isn't used yet: Pages CMS commits the image first and the work only when saved.
// Images added less than a day ago are left out so every upload doesn't open an issue.
const GRACE_MS = 24 * 60 * 60 * 1000;
// Keeps the issue body well under GitHub's size limit.
const MAX_LISTED = 200;

function walk(dir) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

// Every text a content file or setting could name an image in. Plain text search, so it keeps working
// whatever field (cover, pages, images, shareImage...) the path is saved under.
const references = [
	...walk(CONTENT_DIR).filter((path) => !path.startsWith(`${MEDIA_DIR}/`) && /\.(ya?ml|md|txt|json)$/i.test(path)),
	'site.config.yaml',
]
	.map((path) => readFileSync(path, 'utf8'))
	.join('\n');

// When each image was added to the repository (first commit that added it). The workflow checks out full history.
const addedAt = new Map();
const log = execFileSync('git', ['log', '--diff-filter=A', '--format=%x00%ct', '--name-only', '--', MEDIA_DIR], {
	encoding: 'utf8',
	maxBuffer: 64 * 1024 * 1024,
});
for (const chunk of log.split('\0').filter(Boolean)) {
	const [time, ...paths] = chunk.trim().split('\n');
	// Newest first, so the last one seen for a path is when it was first added.
	for (const path of paths.filter(Boolean)) addedAt.set(path, Number(time) * 1000);
}

const now = Date.now();
const unused = walk(MEDIA_DIR)
	.filter((path) => IMAGE.test(path) && !references.includes(path))
	.filter((path) => addedAt.has(path) && now - addedAt.get(path) >= GRACE_MS)
	.sort((a, b) => addedAt.get(a) - addedAt.get(b));

const repo = process.env.GITHUB_REPOSITORY;
const ja = siteConfig.language === 'ja';
const formatDate = new Intl.DateTimeFormat(ja ? 'ja-JP' : 'en-US', {
	timeZone: ja ? 'Asia/Tokyo' : 'UTC',
	year: 'numeric',
	month: 'long',
	day: 'numeric',
}).format;

const rows = unused.slice(0, MAX_LISTED).map((path) => {
	const date = formatDate(new Date(addedAt.get(path)));
	const name = path.slice(MEDIA_DIR.length + 1);
	if (!repo) return `- ${name}（${date}）`;
	const url = `https://github.com/${repo}/blob/main/${path}`;
	return `- <a href="${url}"><img src="${url}?raw=true" height="80" alt=""></a> ${name}（${date}）`;
});
if (unused.length > MAX_LISTED) rows.push(ja ? `- ほか${unused.length - MAX_LISTED}枚` : `- and ${unused.length - MAX_LISTED} more`);

const body = ja
	? `どの作品・設定からも使われていない画像が${unused.length}枚あります（追加から1日以上たったもの）。サイトには表示されず、残っていても困ることはありません。

画像の差し替え、話や作品の削除、アップロードしたまま保存しなかった場合などに残ります。

消すと、Pages CMSで画像を選ぶ「Select」の一覧が見やすくなります。画像を押すとGitHubのページが開きます。右上の「…」→「Delete file」→「Commit changes」で削除できます。使う予定があれば、そのままで大丈夫です。
消しても履歴には残るので、リポジトリの容量は減りません。
このお知らせは、デプロイのたびに自動で更新され、すべて片付くと自動で閉じます。

${rows.join('\n')}`
	: `${unused.length} image(s) are not used by any work or setting (added more than a day ago). They don't appear on your site, and leaving them does no harm.

Images are left behind when you replace an image, delete an episode or work, or upload an image without saving.

Deleting them tidies the list you pick images from in Pages CMS ("Select"). Click an image to open its page on GitHub, then choose "…" (top right) → "Delete file" → "Commit changes". If you plan to use them, just leave them.
Deleted images stay in the repository's history, so deleting them doesn't reduce its size.
This issue is updated on every deploy and closes itself once they are all gone.

${rows.join('\n')}`;

console.log(
	JSON.stringify({
		count: unused.length,
		title: ja ? `使われていない画像（${unused.length}枚）` : `Unused images (${unused.length})`,
		body,
		resolved: ja ? '使われていない画像はなくなりました。' : 'No unused images are left.',
	}),
);
