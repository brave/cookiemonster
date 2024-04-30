# cookiemonster

[![License](https://img.shields.io/badge/License-MPL--2.0-blue)](LICENSE)

I eat cookie consent notices. **Nom nom**.

## Setup

For testing without EasyList Cookie enabled, you'll need to initialize a suitable browser profile for the automated browser to use.

This can be done by starting the browser from the command line as follows:

```
/path/to/brave --user-data-dir ./profiles/ELC_off
```

Then navigate to `brave://settings/shields/filters` and disable `EasyList Cookie`.
You can safely close the browser after this step.

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
  url: 'https://example.com',       // URL to visit
  seconds: 4,                       // delay before checking for a notice
  interactive: false,               // show the browser while running?
  executablePath: '/path/to/binary' // what browser to run
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
