// An instant client-side redirect for static pages. Astro.redirect() in a static build waits two seconds before moving on.
export function redirectTo(path: string): Response {
	const html = `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${path}"><meta name="robots" content="noindex"><link rel="canonical" href="${path}"><a href="${path}">${path}</a>`;
	return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
