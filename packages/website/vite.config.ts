import mdx from '@mdx-js/rollup'
import rehypeShiki from '@shikijs/rehype'
import {tanstackStart} from '@tanstack/react-start/plugin/vite'
import rehypeAutolink from 'rehype-autolink-headings'
import rehypeMermaid from 'rehype-mermaid'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import {defineConfig} from 'vite'

export default defineConfig({
  plugins: [
    mdx({
      remarkPlugins: [remarkGfm],
      rehypePlugins: [
        rehypeSlug,
        [rehypeAutolink, {behavior: 'wrap'}],
        [
          rehypeMermaid,
          {
            strategy: 'img-svg',
            dark: true,
            mermaidConfig: {fontFamily: "'Mona Sans', sans-serif"},
          },
        ],
        [
          rehypeShiki,
          {
            themes: {
              light: 'github-light',
              dark: 'github-dark',
            },
          },
        ],
      ],
    }),
    tanstackStart({
      srcDirectory: 'app',
      router: {
        routesDirectory: 'routes',
        generatedRouteTree: 'routeTree.gen.ts',
        quoteStyle: 'single',
        semicolons: false,
      },
      prerender: {
        enabled: true,
        crawlLinks: true,
        filter: (page: {path: string}) => !page.path.startsWith('/examples/') && !page.path.includes('#'),
      },
    }),
  ],
  server: {
    // Listen on all interfaces so portless can proxy to the Vite dev server
    host: true,
  },
  css: {
    transformer: 'lightningcss',
  },
  ssr: {
    noExternal: ['@primer/react'],
  },
  build: {
    cssMinify: 'lightningcss',
  },
})
