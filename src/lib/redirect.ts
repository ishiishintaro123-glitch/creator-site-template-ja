// An instant client-side redirect for static pages. Astro.redirect() in a static build waits two seconds before moving on.
// head: extra tags for the page's <head>, already escaped (the share card of the top page, which X and others read here
// because they don't follow the redirect).
export function redirectTo(path: string, head = ''): Response {
	const html = `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${path}"><meta name="robots" content="noindex"><link rel="canonical" href="${path}">${head}<a href="${path}">${path}</a>`;
	return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
