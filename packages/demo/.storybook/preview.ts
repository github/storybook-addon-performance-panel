import addonPerformancePanel from '@github-ui/storybook-addon-performance-panel'
import {definePreview} from '@storybook/react-vite'

const preview = definePreview({
  addons: [addonPerformancePanel()],
  parameters: {
    controls: {expanded: true},
  },
})

export default preview
