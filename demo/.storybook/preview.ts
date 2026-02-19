import {definePreview} from '@storybook/react-vite'
import addonPerformancePanel from '@github-ui/storybook-addon-performance-panel'

const preview = definePreview({
  addons: [addonPerformancePanel()],
  parameters: {
    controls: {expanded: true},
  },
})

export default preview
