import * as Sentry from '@sentry/node'

Sentry.init({
  tracesSampleRate: 1.0,
  tracePropagationTargets: [],
  registerEsmLoaderHooks: { exclude: [/openai/] },
  integrations: function (integrations) {
    // Remove HTTP Integration, it breaks proxy requests
    return integrations.filter(function (integration) {
      return !['Http'].includes(integration.name)
    })
  }
})

// filter non-POST requests
Sentry.addEventProcessor(function (event, hint) {
  if (event?.request?.method === 'GET') {
    return null
  } else {
    return event
  }
})
