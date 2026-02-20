import {defineConfig, type UserConfig} from 'tsdown'

const NODE_TARGET = 'node20.19' // Minimum Node version supported by Storybook 10
const isWatch = process.argv.includes('--watch')

export default defineConfig(async () => {
  // reading the three types of entries from package.json, which has the following structure:
  // {
  //  ...
  //   "bundler": {
  //     "managerEntries": ["./src/manager.ts"],
  //     "previewEntries": ["./src/preview.ts", "./src/index.ts"]
  //     "nodeEntries": ["./src/preset.ts"]
  //   }
  // }
  const packageJson = (await import('./package.json', {with: {type: 'json'}})).default

  const {
    bundler: {managerEntries, previewEntries, nodeEntries},
  } = packageJson

  const commonConfig: UserConfig = {
    clean: false,
    format: ['esm'],
    treeshake: true,
    tsconfig: 'tsconfig.build.json',
    /*
     The following packages are provided by Storybook and should always be externalized
     Meaning they shouldn't be bundled with the addon, and they shouldn't be regular dependencies either
    */
    external: ['react', 'react-dom', '@storybook/icons', /^@storybook\//, /^storybook\//],
    // Disable dts in watch mode to prevent infinite rebuild loops
    dts: !isWatch,
    // Validate package.json exports and type resolution at build time
    publint: !isWatch,
    attw: !isWatch && {profile: 'esm-only'},
  }

  const configs: UserConfig[] = []

  /*
   manager entries are entries meant to be loaded into the manager UI
   they'll have manager-specific packages externalized and they won't be usable in node
   they won't have types generated for them as they're usually loaded automatically by Storybook
  */
  if (managerEntries.length) {
    configs.push({
      ...commonConfig,
      entry: managerEntries,
      platform: 'browser',
      target: 'esnext', // we can use esnext for manager entries since Storybook will bundle the addon's manager entries again anyway
      // Use separate tsconfig with classic JSX transform for manager entries
      // to avoid React 19 runtime issues with Storybook's manager builder
      // (see storybookjs/storybook#32095)
      tsconfig: 'tsconfig.manager.json',
    })
  }

  /*
   preview entries are entries meant to be loaded into the preview iframe
   they'll have preview-specific packages externalized and they won't be usable in node
   they'll have types generated for them so they can be imported by users when setting up Portable Stories or using CSF factories
  */
  if (previewEntries.length) {
    configs.push({
      ...commonConfig,
      entry: previewEntries,
      platform: 'browser',
      target: 'esnext', // we can use esnext for preview entries since the builders will bundle the addon's preview entries again anyway
    })
  }

  /*
   node entries are entries meant to be used in node-only
   this is useful for presets, which are loaded by Storybook when setting up configurations
   they won't have types generated for them as they're usually loaded automatically by Storybook
  */
  if (nodeEntries.length) {
    configs.push({
      ...commonConfig,
      entry: nodeEntries,
      platform: 'node',
      target: NODE_TARGET,
      // With "type": "module", .js is already ESM — no need for .mjs
      fixedExtension: false,
    })
  }

  return configs
})
