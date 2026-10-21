import { Component, type ErrorInfo, type ReactNode } from "react"
import { Sentry } from "../observability/sentry"

type Props = { children: ReactNode }
type State = { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Frontend render error", error, info)
    Sentry.withScope((scope) => { scope.setExtras({ componentStack: info.componentStack }); Sentry.captureException(error) })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return <main className="app-shell flex min-h-screen items-center justify-center p-6"><section className="surface max-w-md rounded-2xl p-8 text-center"><h1 className="text-xl font-semibold">Something went wrong</h1><p className="mt-2 text-sm text-[#aeb9b8]">The chat view encountered an error. Reload to try again.</p><button className="primary-button mt-6" onClick={() => window.location.reload()}>Reload TribeTalk</button></section></main>
  }
}
