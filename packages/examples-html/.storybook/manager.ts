import {setupManagerTheme} from '@github-ui/storybook-config'
import {addons} from 'storybook/manager-api'

setupManagerTheme(addons, {
  sidebarLinks: [
    {
      label: '→ React Storybook',
      localHref: 'http://examples-react.localhost:1355',
      href: '/examples/react/',
    },
    {
      label: '→ Documentation',
      localHref: 'http://site.localhost:1355',
      href: '/',
    },
    {
      label: '→ GitHub',
      href: 'https://github.com/github/storybook-addon-performance-panel',
    },
  ],
})
