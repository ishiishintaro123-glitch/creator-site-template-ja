// A URL pasted into episode text becomes a link (GFM autolinks), but GFM only ends it at whitespace, so in Japanese
// text the characters right after it join the link: "（https://example.booth.pm/items/1）" or "https://….。" or
// "BOOTH：https://…。DLsite：https://…" on one line. Here such a link ends at the first non-ASCII character, and
// any further URLs in the rest become links of their own. Creators can then paste store links straight after a
// work without leaving a space. Browsers copy URLs percent-encoded, so pasted URLs are all ASCII.
import { defineMdastPlugin } from 'satteri';

// An http(s) or www. URL, its host all ASCII. "https://日本語.jp" (an internationalized domain) isn't matched,
// so such a link is left as GFM made it rather than cut down to "https://".
const URL_PATTERN = /(?:https?:\/\/|www\.)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?(?:[/?#][\x21-\x7e]*)?/g;

// The same trailing punctuation GFM leaves out of a link: "https://example.com." links to example.com.
function trimTrailing(url) {
	for (;;) {
		if (/[.,:;!?'"*_~]$/.test(url)) {
			url = url.slice(0, -1);
		} else if (url.endsWith(')') && url.split(')').length > url.split('(').length) {
			url = url.slice(0, -1);
		} else {
			return url;
		}
	}
}

function link(url) {
	const href = url.startsWith('www.') ? `http://${url}` : url;
	return { type: 'link', url: href, title: null, children: [{ type: 'text', value: url }] };
}

/** Text with each URL in it made a link. */
function linkify(text) {
	const nodes = [];
	let last = 0;
	for (const match of text.matchAll(URL_PATTERN)) {
		// Like GFM, not in the middle of a word ("abchttps://…").
		if (match.index > 0 && /[A-Za-z0-9]/.test(text[match.index - 1])) continue;
		const url = trimTrailing(match[0]);
		if (match.index > last) nodes.push({ type: 'text', value: text.slice(last, match.index) });
		nodes.push(link(url));
		last = match.index + url.length;
	}
	if (last < text.length) nodes.push({ type: 'text', value: text.slice(last) });
	return nodes;
}

export const urlLinks = defineMdastPlugin({
	name: 'url-links',
	link(node, ctx) {
		const [child] = node.children ?? [];
		if (node.children?.length !== 1 || child.type !== 'text') return;
		const shown = child.value;
		// Only links made from a bare URL (shown as written), not [text](url) links the creator wrote out.
		if (node.url !== shown && node.url !== `http://${shown}`) return;
		if (/^[\x21-\x7e]*$/.test(shown)) return;
		const nodes = linkify(shown);
		// Nothing recognised (an internationalized domain): leave the link as it was.
		if (nodes[0]?.type !== 'link') return;
		ctx.replaceNode(node, nodes);
	},
});
