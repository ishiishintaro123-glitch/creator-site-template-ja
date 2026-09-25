// Episode text is shown as written: HTML typed into it appears as plain text instead of becoming part of the page,
// and links or images may only point to web or mail addresses (or within the site), never "javascript:" and the like.
// The text comes only from the creator, but it is often pasted or imported from elsewhere, and once ad code relaxes
// the CSP (src/integrations/site-files.mjs), stray HTML in it could run scripts.
import { defineMdastPlugin } from 'satteri';

// A scheme-less URL (relative, #anchor) or one of these schemes. Browsers ignore control characters and spaces
// in a scheme ("java\tscript:"), so they are removed before checking.
function isSafeUrl(url) {
	const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(String(url).replace(/[\u0000- ]/g, ''));
	return !scheme || ['http', 'https', 'mailto'].includes(scheme[1].toLowerCase());
}

function checkUrl(node, ctx) {
	if (!isSafeUrl(node.url)) ctx.setProperty(node, 'url', '');
}

export const safeContent = defineMdastPlugin({
	name: 'safe-content',
	html(node, ctx) {
		const text = { type: 'text', value: node.value };
		// An HTML block (on lines of its own) becomes a paragraph like the rest of the text.
		ctx.replaceNode(node, ctx.parent(node)?.type === 'root' ? { type: 'paragraph', children: [text] } : text);
	},
	link: checkUrl,
	image: checkUrl,
	definition: checkUrl,
});
