import mdx from '@mdx-js/rollup'
import rehypeShiki from '@shikijs/rehype'
import {tanstackStart} from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import rehypeAutolink from 'rehype-autolink-headings'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import {defineConfig} from 'vite'
import typedCssModules from 'vite-plugin-typed-css-modules'

export default defineConfig({
  plugins: [
    typedCssModules(),
    mdx({
      remarkPlugins: [remarkGfm],
      rehypePlugins: [
        rehypeSlug,
        [rehypeAutolink, {behavior: 'wrap'}],
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
        routeFileIgnorePattern: '\\.d\\.ts$',
      },
      prerender: {
        enabled: true,
        crawlLinks: true,
        filter: (page: {path: string}) => !page.path.startsWith('/examples/') && !page.path.includes('#'),
      },
    }),
    react({babel: {plugins: [['babel-plugin-react-compiler']]}}),
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
