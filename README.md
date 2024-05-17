# cookiemonster

[![License](https://img.shields.io/badge/License-MPL--2.0-blue)](LICENSE)

I eat cookie consent notices. **Nom nom**.

## Setup

Install [Brave Browser](https://brave.com/linux/), and [xvfb](https://www.x.org/releases/X11R7.6/doc/man/man1/Xvfb.1.xhtml), which is required for optimal headless operation.

Install dependencies and then setup browser profiles for future use:
```
npm install
npm run setup -- /path/to/brave
```

If the browser profiles need to be updated, remove the `profiles` directory and run the `setup` script again.

## Running

Run the following:

```
npm run serve
```

...then visit `localhost:3000` in your browser.

If needed, you can pass a path to a different browser binary, and a different port to run on, e.g.:

```
npm run serve -- /usr/bin/brave-nightly 8000
```

## Using as a library

```js
import { checkPage } from 'cookiemonster';

const result = await checkPage({
  url: 'https://example.com',        // URL to visit
  seconds: 4,                        // delay before checking for a notice
  interactive: false,                // show the browser while running?
  executablePath: '/path/to/binary', // what browser to run
  disableCookieList: true,           // ignore rules from EasyList Cookie?
});
```

## Testing

```
npm run test
```

You can also pass a path to a different browser binary if necessary:

```
npm run test -- /usr/bin/brave-nightly
```

### Generating test cases

There is a set of regression test cases in the `testcases` directory.

Each test case is a single self-contained HTML file.
These files can be generated using a tool like [nodeSavePageWE](https://github.com/markusmobius/nodeSavePageWE).
