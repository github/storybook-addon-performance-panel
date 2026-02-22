import {setupManagerTheme} from '@github-ui/storybook-config'
import {addons} from 'storybook/manager-api'

setupManagerTheme(addons, {
  sidebarLinks: [
    {
      label: '→ Universal Storybook',
      localHref: 'http://examples-html.localhost:1355',
      href: '/examples/universal/',
    },
    {
      label: '→ Documentation',
      localHref: 'http://site.localhost:1355',
      href: '../../',
    },
    {
      label: '→ GitHub',
      href: 'https://github.com/github/storybook-addon-performance-panel',
    },
  ],
})
