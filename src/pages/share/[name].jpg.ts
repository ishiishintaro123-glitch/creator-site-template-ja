import type { APIRoute, GetStaticPaths } from 'astro';
import { getCardSources, renderCard } from '../../lib/share-card';

// Share card images for pages whose image isn't landscape (see src/lib/share-card.ts).
export const getStaticPaths = (async () => {
	const sources = await getCardSources();
	return [...sources].map(([name, path]) => ({ params: { name }, props: { path } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) =>
	new Response(new Uint8Array(await renderCard(props.path as string)), { headers: { 'Content-Type': 'image/jpeg' } });
