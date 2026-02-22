import {setupManagerTheme} from '@github-ui/docs-shared'
import {addons} from 'storybook/manager-api'

setupManagerTheme(addons, {
  peerLabel: '→ Universal Docs',
  peerLocalHref: 'http://perf-html.localhost:1355',
  peerDeployedHref: '/storybooks/universal/',
})
