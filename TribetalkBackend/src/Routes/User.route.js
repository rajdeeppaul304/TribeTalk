import { Router } from "express";
import { 
    loginUser, 
    logoutUser, 
    registerUser, 
    refreshAccessToken, 
    getCurrentUser,
    updateCurrentUserProfile,
    getPublicUserProfile, getNotifications, markNotificationsRead
    , requestEmailVerification, verifyEmail, requestPasswordReset, resetPassword, logoutAllSessions
} from "../Controllers/User.controller.js";
import { verifyJWT } from "../Middlewares/Auth.middleware.js";
import { validate } from "../Middlewares/Validate.middleware.js";
import { authLimiter } from "../Middlewares/RateLimit.middleware.js";
import { loginSchema, publicProfileParamsSchema, refreshTokenSchema, registerSchema, updateProfileSchema, requestEmailVerificationSchema, verifyEmailSchema, requestPasswordResetSchema, resetPasswordSchema } from "../Validation/schemas.js";

const router = Router();

// Public routes
router.route("/register").post(authLimiter, validate(registerSchema), registerUser);
router.route("/login").post(authLimiter, validate(loginSchema), loginUser);
router.route("/refresh-token").post(authLimiter, validate(refreshTokenSchema), refreshAccessToken);
router.route("/email-verification/request").post(authLimiter, validate(requestEmailVerificationSchema), requestEmailVerification);
router.route("/email-verification/verify").post(authLimiter, validate(verifyEmailSchema), verifyEmail);
router.route("/password-reset/request").post(authLimiter, validate(requestPasswordResetSchema), requestPasswordReset);
router.route("/password-reset/confirm").post(authLimiter, validate(resetPasswordSchema), resetPassword);

// Protected routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/logout-all").post(verifyJWT, logoutAllSessions);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router.route("/profile").patch(verifyJWT, validate(updateProfileSchema), updateCurrentUserProfile);
router.route("/notifications").get(verifyJWT, getNotifications).patch(verifyJWT, markNotificationsRead);
router.route("/:userId/profile").get(verifyJWT, validate(publicProfileParamsSchema), getPublicUserProfile);

export default router;
