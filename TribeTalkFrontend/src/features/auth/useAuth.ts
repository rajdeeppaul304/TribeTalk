// features/auth/useAuth.js
import { useDispatch, useSelector } from "react-redux"
import { setAuth, clearAuth } from "../../features/auth/authStore/auth.slice"
import type { RootState, AppDispatch } from "../../app/store"
import type { User } from "../../features/auth/auth.types"

export const useAuth = () => {
    const dispatch = useDispatch<AppDispatch>()


    const { user, token, isAuthenticated } = useSelector(
        (state: RootState) => state.auth
    )

    return {
        user,
        token,
        isAuthenticated,
        setAuth: (user: User, token: string) =>
            dispatch(setAuth({ user, token })),
        clearAuth: () =>
            dispatch(clearAuth()),
    }
}
