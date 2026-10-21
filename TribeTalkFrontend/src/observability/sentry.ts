import * as Sentry from "@sentry/react"

const dsn = import.meta.env.VITE_SENTRY_DSN

if (dsn) Sentry.init({
  dsn,
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
  profileSessionSampleRate: 0.1,
})

export { Sentry }
