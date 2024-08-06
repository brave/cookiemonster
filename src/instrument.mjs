import * as Sentry from '@sentry/node'

Sentry.init({
  tracesSampleRate: 1.0
})

// filter non-POST requests
Sentry.addEventProcessor(function (event, hint) {
  if (event?.request?.method === 'GET') {
    return null
  } else {
    return event
  }
})
