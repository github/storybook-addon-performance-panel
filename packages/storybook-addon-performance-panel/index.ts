import {definePreviewAddon} from 'storybook/internal/csf'

import addonAnnotations from './preview'

const start = () => definePreviewAddon(addonAnnotations)
export default start
