import {setupManagerTheme} from '@github-ui/storybook-config'
import {addons} from 'storybook/manager-api'

setupManagerTheme(addons, {
  peerLabel: '→ React Docs',
  peerLocalHref: 'http://perf-react.localhost:1355',
  peerDeployedHref: '/storybooks/react/',
})
