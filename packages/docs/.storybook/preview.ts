import addonPerformancePanel from '@github-ui/storybook-addon-performance-panel'
import addonDocs from '@storybook/addon-docs'
import {definePreview} from '@storybook/react-vite'

const preview = definePreview({
  addons: [addonDocs(), addonPerformancePanel()],
  parameters: {
    controls: {expanded: true},
  },
})

export default preview
