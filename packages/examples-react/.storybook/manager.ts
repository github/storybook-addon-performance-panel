import {setupManagerTheme} from '@github-ui/storybook-config'
import {addons} from 'storybook/manager-api'

setupManagerTheme(addons, {
  peerLabel: '→ Universal Docs',
  peerLocalHref: 'http://examples-html.localhost:1355',
  peerDeployedHref: '/examples/universal/',
})
