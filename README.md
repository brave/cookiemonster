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

## Using as a library

Import the `checkPage` function from `lib.mjs`.
