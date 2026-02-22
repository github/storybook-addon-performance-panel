import {setupManagerTheme} from '@github-ui/storybook-config'
import {addons} from 'storybook/manager-api'

setupManagerTheme(addons, {
  peerLabel: '→ React Docs',
  peerLocalHref: 'http://examples-react.localhost:1355',
  peerDeployedHref: '/examples/react/',
})
