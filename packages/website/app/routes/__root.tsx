import '../global.css'

import monaSansLatinUrl from '@fontsource-variable/mona-sans/files/mona-sans-latin-wght-normal.woff2?url'
import {MarkGithubIcon, PackageIcon, ThreeBarsIcon, XIcon} from '@primer/octicons-react'
import {IconButton, NavList, PageLayout} from '@primer/react'
import {createRootRoute, HeadContent, Link, Outlet, Scripts, useRouterState} from '@tanstack/react-router'
import {useCallback, useEffect, useRef, useSyncExternalStore} from 'react'

import styles from './layout.module.css'

const emptySubscribe = () => () => {
  /* empty */
}
const returnTrue = () => true
const returnFalse = () => false

/** Blocking script — sets color mode attributes before first paint. */
const COLOR_MODE_SCRIPT = `(function(){var d=document.documentElement,m=window.matchMedia('(prefers-color-scheme:dark)').matches;d.setAttribute('data-color-mode',m?'dark':'light');d.setAttribute(m?'data-dark-theme':'data-light-theme',m?'dark':'light')})()`

interface NavSubLink {
  label: string
  hash: string
}
interface NavLink {
  label: string
  to: string
  children?: NavSubLink[]
}
interface NavExternal {
  label: string
  href: string
}
interface NavSection {
  section: string
  items: (NavLink | NavExternal)[]
}

const NAV: NavSection[] = [
  {
    section: 'Overview',
    items: [
      {label: 'Introduction', to: '/'},
      {
        label: 'Getting started',
        to: '/docs/setup',
        children: [
          {label: 'Installation', hash: '#installation'},
          {label: 'React projects', hash: '#react-projects'},
          {label: 'Other frameworks', hash: '#other-frameworks'},
          {label: 'Writing stories', hash: '#writing-stories'},
          {label: 'React profiling in production', hash: '#react-profiling-in-production'},
          {label: 'Element timing', hash: '#element-timing'},
        ],
      },
    ],
  },
  {
    section: 'Reference',
    items: [
      {
        label: 'Metrics',
        to: '/docs/metrics',
        children: [
          {label: 'Overview', hash: '#metrics-reference'},
          {label: 'Key thresholds', hash: '#key-thresholds'},
          {label: 'Frame timing', hash: '#frame-timing'},
          {label: 'Input responsiveness', hash: '#input-responsiveness'},
          {label: 'Main thread health', hash: '#main-thread-health'},
          {label: 'Long animation frames', hash: '#long-animation-frames'},
          {label: 'React performance', hash: '#react-performance'},
          {label: 'Layout stability', hash: '#layout-stability'},
          {label: 'Memory and resources', hash: '#memory-and-resources'},
          {label: 'Element timing', hash: '#element-timing'},
        ],
      },
      {
        label: 'Collectors',
        to: '/docs/collectors',
        children: [
          {label: 'Overview', hash: '#collectors-reference'},
          {label: 'Collection methods', hash: '#collection-methods'},
          {label: 'ElementTimingCollector', hash: '#elementtimingcollector'},
          {label: 'ForcedReflowCollector', hash: '#forcedreflowcollector'},
          {label: 'FrameTimingCollector', hash: '#frametimingcollector'},
          {label: 'InputCollector', hash: '#inputcollector'},
          {label: 'LayoutShiftCollector', hash: '#layoutshiftcollector'},
          {label: 'LongAnimationFrameCollector', hash: '#longanimationframecollector'},
          {label: 'MainThreadCollector', hash: '#mainthreadcollector'},
          {label: 'MemoryCollector', hash: '#memorycollector'},
          {label: 'PaintCollector', hash: '#paintcollector'},
          {label: 'ReactProfilerCollector', hash: '#reactprofilercollector'},
          {label: 'StyleMutationCollector', hash: '#stylemutationcollector'},
          {label: 'Adding a collector', hash: '#adding-a-collector'},
        ],
      },
    ],
  },
  {
    section: 'Guides',
    items: [
      {
        label: 'Troubleshooting',
        to: '/docs/troubleshooting',
        children: [
          {label: 'Quick health check', hash: '#quick-health-check'},
          {label: 'Debugging workflow', hash: '#debugging-workflow'},
          {label: 'Slow initial load', hash: '#slow-initial-load'},
          {label: 'Janky scrolling', hash: '#janky-scrolling-or-animations'},
          {label: 'Slow interactions', hash: '#slow-click-or-keyboard-response'},
          {label: 'Layout shifts', hash: '#layout-shifts'},
          {label: 'React re-renders', hash: '#react-re-render-issues'},
          {label: 'Forced reflows', hash: '#forced-reflows'},
          {label: 'Memory issues', hash: '#memory-issues'},
          {label: 'Metric correlations', hash: '#metric-correlations'},
        ],
      },
    ],
  },
  {
    section: 'Demos',
    items: [
      {label: 'React Storybook', href: '/examples/react/'},
      {label: 'Universal Storybook', href: '/examples/universal/'},
    ],
  },
]

const GITHUB_MARK =
  'M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0112.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z'

/**
 * Official Storybook icon from https://github.com/storybookjs/brand.
 * Combined background + S letter using fill-rule evenodd for a single-color cutout.
 */
function StorybookIcon({size, ...props}: {size?: number | string} & Omit<React.SVGProps<SVGSVGElement>, 'size'>) {
  const s = typeof size === 'number' ? size : 16
  return (
    <svg viewBox="0 0 52 64" width={s} height={s} fill="currentColor" aria-hidden="true" {...props}>
      <g transform="translate(1,1)">
        <path
          fillRule="evenodd"
          d="M50.273 2.923a3 3 0 0 1 .006.194v55.766a3.15 3.15 0 0 1-3.15 3.117c-.047 0-.094-.001-.141-.003L4.949 60.128a3.15 3.15 0 0 1-3.006-2.997L.002 5.955A3.15 3.15 0 0 1 2.953 2.727L37.427.594l-.3 7.027a.55.55 0 0 0 .753.487l2.758-2.07 2.33 1.815a.55.55 0 0 0 .506.044.55.55 0 0 0 .254-.425l-.26-7.155 3.465-.215A3.15 3.15 0 0 1 50.273 2.923ZM29.403 23.369c0 1.212 8.254.631 9.362-.22 0-8.259-4.477-12.599-12.676-12.599-8.199 0-12.793 4.407-12.793 11.018 0 11.514 15.7 11.735 15.7 18.015 0 1.763-.872 2.81-2.791 2.81-2.5 0-3.489-1.264-3.373-5.561 0-.932-9.536-1.223-9.827 0-.74 10.413 5.815 13.417 13.316 13.417 7.269 0 12.967-3.835 12.967-10.776 0-12.341-15.932-12.01-15.932-18.126 0-2.479 1.86-2.81 2.966-2.81 1.163 0 3.256.203 3.081 4.831Z"
        />
      </g>
    </svg>
  )
}

/** Resolve portless URLs for demo links on .localhost dev hostnames. */
const PORTLESS_HREFS: Record<string, string> = {
  '/examples/react/': 'http://examples-react.localhost:1355',
  '/examples/universal/': 'http://examples-html.localhost:1355',
}

function resolveHref(href: string, isLocal: boolean): string {
  return isLocal ? (PORTLESS_HREFS[href] ?? href) : href
}

function RootLayout() {
  const pathname = useRouterState({select: s => s.location.pathname})
  const hash = useRouterState({select: s => s.location.hash})
  const isClient = useSyncExternalStore(emptySubscribe, returnTrue, returnFalse)
  const isPortless = isClient && window.location.hostname.endsWith('.localhost')
  const dialogRef = useRef<HTMLDialogElement>(null)

  const closeMobileNav = useCallback(() => {
    dialogRef.current?.close()
  }, [])

  // Close mobile nav when clicking the backdrop
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    function onClickBackdrop(e: MouseEvent) {
      if (e.target === dialog) dialogRef.current?.close()
    }
    dialog.addEventListener('click', onClickBackdrop)
    return () => {
      dialog.removeEventListener('click', onClickBackdrop)
    }
  }, [])

  // Close mobile nav on route change
  useEffect(() => {
    dialogRef.current?.close()
  }, [pathname, hash])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    function onChange(e: Pick<MediaQueryListEvent, 'matches'>) {
      const d = document.documentElement
      d.setAttribute('data-color-mode', e.matches ? 'dark' : 'light')
      d.setAttribute(e.matches ? 'data-dark-theme' : 'data-light-theme', e.matches ? 'dark' : 'light')
    }
    onChange(mq)
    mq.addEventListener('change', onChange)
    return () => {
      mq.removeEventListener('change', onChange)
    }
  }, [])

  const navContent = (
    <NavList aria-label="Documentation" key={pathname}>
      {NAV.map(group => (
        <NavList.Group key={group.section}>
          <NavList.GroupHeading>{group.section}</NavList.GroupHeading>
          {group.items.map(item => {
            if ('href' in item) {
              return (
                <NavList.Item key={item.href} href={resolveHref(item.href, isPortless)}>
                  {item.label} ↗
                </NavList.Item>
              )
            }
            const isActive = pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to))
            if (!item.children?.length) {
              return (
                <NavList.Item key={item.to} as={Link} to={item.to} aria-current={isActive ? 'page' : undefined}>
                  {item.label}
                </NavList.Item>
              )
            }
            return (
              <NavList.Item key={item.to} defaultOpen={isActive}>
                {item.label}
                <NavList.SubNav>
                  {item.children.map(child => {
                    const childHash = child.hash.slice(1)
                    const isHashActive = isClient && isActive && hash.replace(/^#/, '') === childHash
                    return (
                      <NavList.Item
                        key={child.hash}
                        as={Link}
                        to={item.to}
                        hash={childHash}
                        aria-current={isHashActive ? 'page' : undefined}
                      >
                        {child.label}
                      </NavList.Item>
                    )
                  })}
                </NavList.SubNav>
              </NavList.Item>
            )
          })}
        </NavList.Group>
      ))}
    </NavList>
  )

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: COLOR_MODE_SCRIPT}} />
        <HeadContent />
      </head>
      <body>
        <a href="#main-content" className={styles.skipLink}>
          Skip to content
        </a>
        <PageLayout containerWidth="xlarge" padding="none">
          <PageLayout.Header divider="line" className={styles.header}>
            <div className={styles.headerBar}>
              <IconButton
                className={styles.menuButton}
                icon={ThreeBarsIcon}
                aria-label="Open navigation"
                variant="invisible"
                size="medium"
                onClick={() => {
                  dialogRef.current?.showModal()
                }}
              />
              <Link to="/" className={styles.headerHome}>
                <svg width="20" height="20" viewBox="0 0 98 96" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" clipRule="evenodd" d={GITHUB_MARK} />
                </svg>
                storybook-addon-performance-panel
              </Link>
              <nav className={styles.headerNav} aria-label="External links">
                <IconButton
                  as="a"
                  href="https://github.com/github/storybook-addon-performance-panel"
                  target="_blank"
                  rel="noopener noreferrer"
                  icon={MarkGithubIcon}
                  aria-label="GitHub repository"
                  variant="invisible"
                  size="medium"
                />
                <IconButton
                  as="a"
                  href="https://www.npmjs.com/package/@github-ui/storybook-addon-performance-panel"
                  target="_blank"
                  rel="noopener noreferrer"
                  icon={PackageIcon}
                  aria-label="npm package"
                  variant="invisible"
                  size="medium"
                />
                <IconButton
                  as="a"
                  href="https://storybook.js.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  icon={StorybookIcon}
                  aria-label="Storybook"
                  variant="invisible"
                  size="medium"
                />
              </nav>
            </div>
          </PageLayout.Header>

          <PageLayout.Pane
            position="start"
            sticky
            divider="line"
            padding="normal"
            hidden={{narrow: true}}
            className={styles.pane}
          >
            {navContent}
          </PageLayout.Pane>

          <PageLayout.Content padding="normal">
            <div id="main-content">
              <Outlet />
            </div>
          </PageLayout.Content>
        </PageLayout>
        {/* Mobile navigation drawer */}
        <dialog ref={dialogRef} className={styles.mobileNav}>
          <div className={styles.mobileNavHeader}>
            <span className={styles.mobileNavTitle}>Navigation</span>
            <IconButton
              icon={XIcon}
              aria-label="Close navigation"
              variant="invisible"
              size="medium"
              onClick={closeMobileNav}
            />
          </div>
          <div className={styles.mobileNavBody}>{navContent}</div>
        </dialog>
        <Scripts />
      </body>
    </html>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => (
    <div className={styles.notFound}>
      <h1>404 — Page not found</h1>
      <p>
        {"The page you're looking for doesn't exist."} <Link to="/">Go home</Link>.
      </p>
    </div>
  ),
  head: () => ({
    meta: [
      {charSet: 'utf-8'},
      {name: 'viewport', content: 'width=device-width, initial-scale=1'},
      {title: 'Performance Panel – Storybook Addon'},
      {
        name: 'description',
        content:
          'Real-time performance monitoring for Storybook stories. Frame timing, input latency, layout shifts, React profiling, and more.',
      },
      {name: 'theme-color', content: '#ffffff', media: '(prefers-color-scheme: light)'},
      {name: 'theme-color', content: '#0d1117', media: '(prefers-color-scheme: dark)'},
      {property: 'og:type', content: 'website'},
      {property: 'og:site_name', content: 'storybook-addon-performance-panel'},
      {property: 'og:title', content: 'Performance Panel – Storybook Addon'},
      {
        property: 'og:description',
        content:
          'Real-time performance monitoring for Storybook stories. Frame timing, input latency, layout shifts, React profiling, and more.',
      },
      {name: 'twitter:card', content: 'summary'},
    ],
    links: [
      {
        rel: 'preload',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
        href: monaSansLatinUrl,
      },
      {
        rel: 'icon',
        href: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⚡</text></svg>',
      },
    ],
  }),
})
