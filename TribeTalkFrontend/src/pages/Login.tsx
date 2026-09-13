import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useLoginMutation } from "../features/auth/auth.api"
import { useAuth } from "../features/auth/useAuth"
import { useDispatch } from "react-redux"
import { authApi } from "../features/auth/auth.api"
import type { AppDispatch } from "../app/store"
const Login = () => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const navigate = useNavigate()
  const { setAuth } = useAuth()

  // RTK Query hooks for login mutation and getCurrentUser query
  const [login, { isLoading }] = useLoginMutation()
  // const { refetch: refetchCurrentUser } = useGetCurrentUserQuery(undefined, {
  //   skip: true, // we want to manually trigger refetch after login
  // })
  const dispatch = useDispatch<AppDispatch>()

const submitHandler = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  try {
    const loginRes = await login({ email, password }).unwrap()

    // Manually fetch current user
    const user = await dispatch(authApi.endpoints.getCurrentUser.initiate()).unwrap()

    // Set auth state
    setAuth(user, loginRes.data.accessToken)

    navigate("/home", { replace: true })
  } catch (err) {
    console.error("Login failed", err)
    alert("Invalid credentials")
  }
}


  return (
    <div className="flex justify-center items-center h-screen">
      <div className="flex flex-col justify-center items-center gap-6 h-[600px] w-[600px] border-4 rounded-xl bg-blue-300">
        <h1 className="text-4xl font-serif">Login</h1>

        <form
          onSubmit={submitHandler}
          className="flex flex-col gap-4 items-center"
        >
          <input
            type="email"
            value={email}
            placeholder="Enter your email"
            onChange={(e) => setEmail(e.target.value)}
            required
            className="outline-none bg-transparent border-2 border-emerald-600 font-medium text-lg py-2 px-6 rounded-full"
          />

          <input
            type="password"
            value={password}
            placeholder="Enter password"
            onChange={(e) => setPassword(e.target.value)}
            required
            className="outline-none bg-transparent border-2 border-emerald-600 font-medium text-lg py-2 px-6 rounded-full"
          />

          <button
            type="submit"
            disabled={isLoading}
            className="mt-7 text-white hover:bg-emerald-700 bg-emerald-600 text-lg py-2 px-8 w-full rounded-full"
          >
            {isLoading ? "Logging in..." : "Log in"}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
