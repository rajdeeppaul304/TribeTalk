import { Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "./features/auth/useAuth"
import { useEffect } from "react"
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

function App() {
  // const { isAuthenticated, token } = useAuth()
  // console.log("data",isAuthenticated, token)
  const dispatch = useDispatch<AppDispatch>()
  const { token, isAuthenticated } = useAuth()
  const isLoggedIn = Boolean(isAuthenticated && token)

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
