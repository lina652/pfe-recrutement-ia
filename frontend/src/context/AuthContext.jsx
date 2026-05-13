import { createContext, useState, useEffect, useContext } from "react"
import { getMe, logout as logoutApi } from "../api/authApi"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (token) {
      getMe()
        .then((res) => setUser(res.data))
        .catch(() => localStorage.clear())
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = (tokens, userData) => {
    localStorage.setItem("access_token", tokens.access_token)
    localStorage.setItem("refresh_token", tokens.refresh_token)
    setUser(userData)
  }

  const logout = async () => {
    await logoutApi()
    localStorage.clear()
    sessionStorage.removeItem("talentos_ranked_jobs")
    sessionStorage.removeItem("talentos_cv_name")
    sessionStorage.removeItem("talentos_applied_jobs")
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)