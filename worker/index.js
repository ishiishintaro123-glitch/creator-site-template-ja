// The site is static files (dist/). This script adds only scheduled publishing: an episode or illustration with a
// future publish time is left out of the build (src/lib/dates.mjs), so the site has to be built again when that
// time comes. Every few minutes (triggers in wrangler.jsonc) it reads when the next one is due from the built
// site's schedule.json and, once that time has passed, starts a build through a Cloudflare deploy hook whose
// address is saved as the secret DEPLOY_HOOK_URL (see 手順書/0_サイトの立ち上げ.md). Saving anything in Pages CMS
// also rebuilds the site, so without the secret a scheduled post comes out with the next save.

// Stop retrying after this long, so a build that keeps failing isn't started again every few minutes for good
// (a failed build is reported in a GitHub issue; the next save tries again).
const RETRY_FOR_MS = 30 * 60 * 1000;

export default {
	// Every request reaches here only for schedule.json (run_worker_first in wrangler.jsonc); pages and files are
	// served straight from dist/.
	async fetch(request, env) {
		if (new URL(request.url).pathname === '/schedule.json') return new Response('Not found', { status: 404 });
		return env.ASSETS.fetch(request);
	},

	async scheduled(event, env) {
		if (!env.DEPLOY_HOOK_URL) return;
		const response = await env.ASSETS.fetch('https://assets.invalid/schedule.json');
		if (!response.ok) return;
		const { next } = await response.json();
		if (!next) return;
		const late = Date.now() - Date.parse(next);
		if (late < 0 || late > RETRY_FOR_MS) return;
		const hook = await fetch(env.DEPLOY_HOOK_URL, { method: 'POST' });
		console.log(`scheduled post due ${next}: deploy hook answered ${hook.status}`);
	},
};
