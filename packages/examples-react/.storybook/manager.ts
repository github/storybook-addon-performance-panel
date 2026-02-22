import {setupManagerTheme} from '@github-ui/storybook-config'
import {addons} from 'storybook/manager-api'

setupManagerTheme(addons, {
  peerLabel: '→ Universal Docs',
  peerLocalHref: 'http://perf-html.localhost:1355',
  peerDeployedHref: '/storybooks/universal/',
})
