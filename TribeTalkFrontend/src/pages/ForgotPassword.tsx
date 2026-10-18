import { useState } from "react"
import { Link } from "react-router-dom"
import { useRequestPasswordResetMutation } from "../features/auth/auth.api"

export default function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [requestReset, { isLoading }] = useRequestPasswordResetMutation()
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setMessage(""); try { await requestReset({ email }).unwrap(); setMessage("If the account exists, a reset code has been sent.") } catch { setMessage("We could not process that request.") } }
  return <main className="app-shell flex min-h-screen items-center justify-center p-5"><section className="surface w-full max-w-md rounded-2xl p-8 sm:p-10"><h1 className="text-2xl font-semibold">Reset your password</h1><p className="mt-2 text-sm text-[#aeb9b8]">Enter your email and we’ll send a six-digit reset code.</p><form onSubmit={submit} className="mt-7 space-y-4"><input className="field" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email"/><button className="primary-button w-full" disabled={isLoading}>{isLoading ? "Sending…" : "Send reset code"}</button></form>{message && <p role="status" className="mt-4 text-sm text-accent">{message}</p>}<p className="mt-7 text-center text-sm text-[#aeb9b8]"><Link className="text-accent" to="/reset-password">I already have a reset code</Link></p><p className="mt-3 text-center text-sm text-[#aeb9b8]"><Link className="text-accent" to="/login">Back to login</Link></p></section></main>
}
