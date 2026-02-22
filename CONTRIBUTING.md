## Contributing

[fork]: https://github.com/github/storybook-addon-performance-panel/fork
[pr]: https://github.com/github/storybook-addon-performance-panel/compare

Hi there! We're thrilled that you'd like to contribute to this project. Your help is essential for keeping it great.

Contributions to this project are [released](https://help.github.com/articles/github-terms-of-service/#6-contributions-under-repository-license) to the public under the [project's open source license](LICENSE).

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## Project structure

This is an npm workspaces monorepo with multiple packages:

| Directory | Package | Description |
|-----------|---------|-------------|
| `packages/storybook-addon-performance-panel` | `@github-ui/storybook-addon-performance-panel` | The addon — collectors, panel UI, and types |
| `packages/examples-react` | `@github-ui/examples-react` | React docs storybook (`@storybook/react-vite`) |
| `packages/examples-html` | `@github-ui/examples-html` | HTML docs storybook (`@storybook/html-vite`) |
| `packages/storybook-config` | `@github-ui/storybook-config` | Shared storybook config (theming, features, Vite helpers) |

### Useful commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build the addon |
| `npm run build:watch` | Build the addon in watch mode |
| `npm test` | Run tests |
| `npm run lint` | Lint with ESLint + Prettier |
| `npm run tsc` | Type-check the addon |
| `npm run dev` | Build + start both storybooks with [portless](https://github.com/nicolo-ribaudo/portless) |
| `npm run docs` | Build the addon and start the React docs storybook |
| `npm run docs:build` | Build the addon and the React docs for production |
| `npm run docs:html` | Build the addon and start the HTML docs storybook |
| `npm run docs:html:build` | Build the HTML docs for production |

#### Portless dev URLs

When using `npm run dev`, each storybook is served at a stable `.localhost` URL via [portless](https://github.com/nicolo-ribaudo/portless):

- **React docs:** `http://perf-react.localhost:1355`
- **HTML docs:** `http://perf-html.localhost:1355`

## Prerequisites for running and testing code

These are one time installations required to be able to test your changes locally as part of the pull request (PR) submission process.

1. Install [Node.js](https://nodejs.org/) (v22 or later)
1. Install dependencies: `npm install`

## Submitting a pull request

1. [Fork][fork] and clone the repository
1. Install the dependencies: `npm install`
1. Build the addon: `npm run build`
1. Make sure the tests pass on your machine: `npm test`
1. Make sure the linter passes: `npm run lint`
1. Create a new branch: `git checkout -b my-branch-name`
1. Make your change, add tests, and make sure the tests and linter still pass
1. Push to your fork and [submit a pull request][pr]
1. Pat yourself on the back and wait for your pull request to be reviewed and merged.

Here are a few things you can do that will increase the likelihood of your pull request being accepted:

- Write tests.
- Keep your change as focused as possible. If there are multiple changes you would like to make that are not dependent upon each other, consider submitting them as separate pull requests.
- Write a [good commit message](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html).

## Resources

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
- [GitHub Help](https://help.github.com)