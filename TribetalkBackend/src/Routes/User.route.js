import { Router } from "express";
import { 
    loginUser, 
    logoutUser, 
    registerUser, 
    refreshAccessToken, 
    getCurrentUser 
} from "../Controllers/User.controller.js";
import { verifyJWT } from "../Middlewares/Auth.middleware.js";
import { validate } from "../Middlewares/Validate.middleware.js";
import { authLimiter } from "../Middlewares/RateLimit.middleware.js";
import { loginSchema, refreshTokenSchema, registerSchema } from "../Validation/schemas.js";

const router = Router();

// Public routes
router.route("/register").post(authLimiter, validate(registerSchema), registerUser);
router.route("/login").post(authLimiter, validate(loginSchema), loginUser);
router.route("/refresh-token").post(authLimiter, validate(refreshTokenSchema), refreshAccessToken);

// Protected routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/current-user").get(verifyJWT, getCurrentUser);

export default router;
