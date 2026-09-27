// Writes files whose contents depend on site.config.yaml into the build output:
// Cloudflare's _headers (used by Workers static assets and Pages alike) (the CSP is relaxed only when ad code is set) and ads.txt.
// Sites that turn away AI services also drop llms.txt, which only exists to introduce the works to them.
import { rmSync, writeFileSync } from 'node:fs';
import { siteConfig } from '../site-config.mjs';

const strictCsp = [
	"default-src 'self'",
	"img-src 'self'",
	"style-src 'self'",
	"font-src 'self'",
	"script-src 'self'",
	"object-src 'none'",
	"base-uri 'none'",
	"frame-ancestors 'none'",
	"form-action 'self'",
];

// Ad networks' copy-paste snippets almost always contain inline scripts, load scripts, frames and images from
// hosts that change without notice, and some use eval. So when a creator pastes ad code, the CSP is relaxed to
// allow those. The site has no user input (only the creator's own works and config), so the loss is acceptable,
// and sites without ads keep the strict policy above.
const adsCsp = [
	"default-src 'self'",
	"img-src 'self' https: data:",
	"style-src 'self' 'unsafe-inline' https:",
	"font-src 'self' https: data:",
	'media-src https: data: blob:',
	// blob: too: some ad and ad-measurement scripts load code they've built in the page this way (tested 2026-09-27:
	// without it, blob: scripts and workers were blocked).
	"script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:",
	"worker-src 'self' blob:",
	"connect-src 'self' https:",
	'frame-src https: data: blob:',
	"object-src 'none'",
	"base-uri 'none'",
	"frame-ancestors 'none'",
	"form-action 'self'",
];

export default function siteFiles() {
	return {
		name: 'site-files',
		hooks: {
			'astro:build:done': ({ dir }) => {
				const csp = (siteConfig.ads ? adsCsp : strictCsp).join('; ');
				// HSTS without includeSubDomains or preload: a creator's other subdomains may not serve HTTPS.
				const headers = `/*
  Strict-Transport-Security: max-age=31536000
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Content-Security-Policy: ${csp}
`;
				writeFileSync(new URL('_headers', dir), headers);

				if (siteConfig.blockAi) {
					rmSync(new URL('llms.txt', dir), { force: true });
				}

				if (siteConfig.ads?.adsTxt) {
					writeFileSync(new URL('ads.txt', dir), `${siteConfig.ads.adsTxt}\n`);
				}
			},
		},
	};
}
