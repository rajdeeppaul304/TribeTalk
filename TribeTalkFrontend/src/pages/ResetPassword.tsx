import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useResetPasswordMutation } from "../features/auth/auth.api"

export default function ResetPassword() {
  const [params] = useSearchParams(); const navigate = useNavigate()
  const [email, setEmail] = useState(params.get("email") || ""); const [otp, setOtp] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState("")
  const [resetPassword, { isLoading }] = useResetPasswordMutation()
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setMessage(""); try { await resetPassword({ email, otp, password }).unwrap(); navigate("/login", { replace: true }) } catch { setMessage("That code is invalid or expired.") } }
  return <main className="app-shell flex min-h-screen items-center justify-center p-5"><section className="surface w-full max-w-md rounded-2xl p-8 sm:p-10"><h1 className="text-2xl font-semibold">Choose a new password</h1><p className="mt-2 text-sm text-[#aeb9b8]">Use the six-digit code from your email.</p><form onSubmit={submit} className="mt-7 space-y-4"><input className="field" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email"/><input className="field" inputMode="numeric" pattern="[0-9]{6}" required value={otp} onChange={e => setOtp(e.target.value)} placeholder="Six-digit reset code"/><input className="field" type="password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="New password"/><button className="primary-button w-full" disabled={isLoading}>{isLoading ? "Updating…" : "Reset password"}</button></form>{message && <p role="alert" className="mt-4 text-sm text-red-300">{message}</p>}<p className="mt-7 text-center text-sm text-[#aeb9b8]"><Link className="text-accent" to="/login">Back to login</Link></p></section></main>
}
