// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { lineBreaks } from './src/markdown/line-breaks.mjs';
import { siteConfig } from './src/site-config.mjs';
import siteFiles from './src/integrations/site-files.mjs';

// https://astro.build/config
export default defineConfig({
  site: siteConfig.url,
  integrations: [sitemap(), siteFiles()],
  markdown: {
    // 小説は1行ずつ改行して書くことが多いので、改行1回をそのまま改行として表示する（通常のMarkdownでは前の行とつながる）
    processor: satteri({ mdastPlugins: [lineBreaks] }),
  },
  build: {
    // CSPが style-src 'self' のみ（'unsafe-inline'なし）のため、
    // <style>タグへのインライン化ではなく外部CSSファイルとして出力する
    inlineStylesheets: 'never',
  },
});
