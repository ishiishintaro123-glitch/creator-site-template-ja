// Show each single newline inside a paragraph as a line break, the way web novels are usually written.
// (Plain Markdown joins such lines into one; Astro's default Sätteri processor has no built-in option for this.)
import { defineMdastPlugin } from 'satteri';

export const lineBreaks = defineMdastPlugin({
	name: 'line-breaks',
	text(node, ctx) {
		if (!node.value.includes('\n')) return;
		const nodes = [];
		node.value.split(/\r?\n/).forEach((line, index) => {
			if (index > 0) nodes.push({ type: 'break' });
			if (line) nodes.push({ type: 'text', value: line });
		});
		ctx.replaceNode(node, nodes);
	},
});
