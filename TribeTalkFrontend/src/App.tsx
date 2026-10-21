import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "./features/auth/useAuth"
import { useEffect } from "react"
import { Sentry } from "./observability/sentry"
import { useDispatch } from "react-redux"
import type { AppDispatch } from "./app/store"
import { initializeMessageSync, cleanupMessageSync } from "./features/messages/socketMessageSync"
import { socketGateway } from "./gateway/socket"
import JoinServerRedirect from "./components/JoinServerRedirect"


// pages
import Login from "./pages/Login"
import Register from "./pages/Register"
import Home from "./pages/Home"
import Profile from "./pages/Profile"
import Search from "./pages/Search"
import Settings from "./pages/Settings"
import Admin from "./pages/Admin"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import VerifyEmail from "./pages/VerifyEmail"

function App() {
  // const { isAuthenticated, token } = useAuth()
  // console.log("data",isAuthenticated, token)
  const dispatch = useDispatch<AppDispatch>()
  const { token, isAuthenticated } = useAuth()
  const isLoggedIn = Boolean(isAuthenticated && token)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const span = Sentry.startInactiveSpan({ name: `Route ${location.pathname}`, op: "navigation" })
    return () => span?.end()
  }, [location.pathname])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault(); navigate("/search")
      }
      if (event.key === "Escape" && document.activeElement instanceof HTMLElement) document.activeElement.blur()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [navigate])

  useEffect(() => {
    if (isAuthenticated && token) {
      // Connect socket
      console.log("Connecting socket with token:", token)
      socketGateway.connect(token)



      // Initialize message sync (socket listeners)
      initializeMessageSync(dispatch)

      // Cleanup on unmount
      return () => {
        cleanupMessageSync()
        socketGateway.disconnect()
      }
    }
  }, [isAuthenticated, token, dispatch])

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          isLoggedIn ? <Navigate to="/home" replace /> : <Login />
        }
      />

      <Route
        path="/server/join-server/:id"
        element={<JoinServerRedirect />}
      />


      <Route
        path="/register"
        element={
          isLoggedIn ? <Navigate to="/home" replace /> : <Register />
        }
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* Protected route */}
      <Route
        path="/home"
        element={
          isLoggedIn ? <Home /> : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/profile/:userId"
        element={isLoggedIn ? <Profile /> : <Navigate to="/login" replace />}
      />
      <Route path="/search" element={isLoggedIn ? <Search /> : <Navigate to="/login" replace />} />
      <Route path="/settings" element={isLoggedIn ? <Settings /> : <Navigate to="/login" replace />} />
      <Route path="/admin" element={isLoggedIn ? <Admin /> : <Navigate to="/login" replace />} />

      {/* Fallback */}
      <Route
        path="*"
        element={
          <Navigate to={isLoggedIn ? "/home" : "/login"} replace />
        }
      />
    </Routes>
  )
}

export default App
