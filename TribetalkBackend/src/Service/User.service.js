import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import * as userRepo from "../Repository/User.repository.js";
import * as authRepo from "../Repository/Auth.repository.js";
import { ApiError } from "../Utils/ApiError.js";
import { getUsersPresence } from "../config/redis.js";
import { env } from "../config/env.js";
import { sendAuthOtp, sendSecurityAlert } from "./Email.service.js";
import { cacheKeys, deleteCached, getCached, setCached } from "./Cache.service.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

const parseDurationMs = (value = "7d") => {
    const match = String(value).match(/^(\d+)\s*(s|m|h|d)$/i);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const units = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
    return Number(match[1]) * units[match[2].toLowerCase()];
};

const auditAuth = async (event) => {
    try { await authRepo.recordAuthEvent(event); } catch { /* auth must remain available if auditing is temporarily unavailable */ }
};

const issueOtp = async (user, purpose, context = {}) => {
    await authRepo.invalidateAuthCodes(user._id, purpose);
    const otp = crypto.randomInt(100000, 1000000).toString();
    await authRepo.createAuthCode({ user: user._id, email: user.email, purpose, codeHash: authRepo.hashSecret(otp), expiresAt: new Date(Date.now() + OTP_TTL_MS) });
    await sendAuthOtp({ email: user.email, otp, purpose });
    await auditAuth({ user: user._id, email: user.email, event: `${purpose}_requested`, status: "success", ...context });
};

export const generateAccessAndRefreshTokens = async (userId, context = {}) => {
    const user = await userRepo.findUserById(userId);
    if (!user) throw new ApiError(404, "User not found");
    const sessionId = crypto.randomUUID();
    const refreshToken = user.generateRefreshToken(sessionId);
    const accessToken = user.generateAccessToken(sessionId);
    await authRepo.createSession({ user: user._id, sessionId, refreshTokenHash: authRepo.hashSecret(refreshToken), ip: context.ip || null, userAgent: context.userAgent || null, expiresAt: new Date(Date.now() + parseDurationMs(process.env.REFRESH_TOKEN_EXPIRY)) });
    return { accessToken, refreshToken, sessionId };
};

export const registerUser = async ({ email, username, password }, context = {}) => {
    const existedUser = await userRepo.findUserByEmailOrUsername(email, username);
    if (existedUser) throw new ApiError(409, "User with email or username already exists");
    const createdUser = await userRepo.createUserDoc({ email: email.toLowerCase().trim(), password, username: username.toLowerCase(), displayName: username.trim() });
    await issueOtp(createdUser, "email_verification", context);
    const safeUser = await userRepo.findUserByIdWithoutSensitiveData(createdUser._id);
    if (!safeUser) throw new ApiError(500, "Something went wrong while registering the user");
    return safeUser;
};

export const loginUser = async ({ email, password }, context = {}) => {
    const user = await userRepo.findUserByEmail(email.toLowerCase().trim());
    if (!user) {
        await auditAuth({ email, event: "login", status: "failure", ip: context.ip, userAgent: context.userAgent, requestId: context.requestId, metadata: { reason: "unknown_email" } });
        throw new ApiError(401, "Invalid email or password");
    }
    if (user.loginLockedUntil && user.loginLockedUntil > new Date()) {
        await auditAuth({ user: user._id, email: user.email, event: "login", status: "suspicious", ...context, metadata: { reason: "account_temporarily_locked" } });
        throw new ApiError(423, "Account temporarily locked. Try again later.");
    }
    const valid = await user.isPasswordCorrect(password);
    if (!valid) {
        const attempts = (user.failedLoginAttempts || 0) + 1;
        const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOGIN_LOCK_MS) : null;
        await userRepo.updateLoginFailure(user._id, attempts, lockedUntil);
        await auditAuth({ user: user._id, email: user.email, event: "login", status: attempts >= MAX_LOGIN_ATTEMPTS ? "suspicious" : "failure", ...context, metadata: { reason: "invalid_password", attempts } });
        throw new ApiError(401, "Invalid email or password");
    }
    if (env.EMAIL_VERIFICATION_REQUIRED && !user.emailVerifiedAt) throw new ApiError(403, "Please verify your email before signing in");
    const suspicious = Boolean(
        (user.lastLoginIp && context.ip && user.lastLoginIp !== context.ip) ||
        (user.lastLoginUserAgent && context.userAgent && user.lastLoginUserAgent !== context.userAgent)
    );
    await userRepo.updateLoginSecurity(user._id, { failedLoginAttempts: 0, loginLockedUntil: null, lastLoginAt: new Date(), lastLoginIp: context.ip || null, lastLoginUserAgent: context.userAgent || null });
    await auditAuth({ user: user._id, email: user.email, event: "login", status: suspicious ? "suspicious" : "success", ...context, metadata: suspicious ? { reason: user.lastLoginIp !== context.ip ? "new_ip" : "new_user_agent" } : {} });
    if (suspicious) void sendSecurityAlert({ email: user.email, ip: context.ip, userAgent: context.userAgent }).catch(() => undefined);
    const { accessToken, refreshToken, sessionId } = await generateAccessAndRefreshTokens(user._id, context);
    const safeUser = await userRepo.findUserByIdWithoutSensitiveData(user._id);
    return { user: safeUser, accessToken, refreshToken, sessionId, suspicious };
};

export const logoutUser = async (userId, sessionId) => {
    if (sessionId) await authRepo.revokeSession(userId, sessionId); else await authRepo.revokeAllSessions(userId);
    await userRepo.unsetUserRefreshToken(userId);
    await auditAuth({ user: userId, event: "logout", status: "success" });
    return true;
};

export const logoutAllSessions = async (userId) => {
    await authRepo.revokeAllSessions(userId);
    await auditAuth({ user: userId, event: "logout_all_sessions", status: "success" });
};

export const updateProfile = async (userId, profile) => {
    const updatedUser = await userRepo.updateUserProfile(userId, profile);
    if (!updatedUser) throw new ApiError(404, "User not found");
    await deleteCached(cacheKeys.profile(userId));
    return updatedUser;
};

export const getPublicProfile = async (userId) => {
    const cached = await getCached(cacheKeys.profile(userId));
    if (cached) return cached;
    const user = await userRepo.findPublicUserProfileById(userId);
    if (!user) throw new ApiError(404, "User not found");
    const presence = await getUsersPresence([user._id]);
    const profile = { ...user, displayName: user.displayName || user.username, online: presence[user._id.toString()] || false };
    await setCached(cacheKeys.profile(userId), profile, 20);
    return profile;
};

export const searchUsers = async (query, limit) => {
    const users = await userRepo.searchPublicUsers(query.trim(), limit);
    const presence = await getUsersPresence(users.map((user) => user._id));
    return users.map((user) => ({ ...user, displayName: user.displayName || user.username, online: Boolean(presence[user._id.toString()]) }));
};

export const refreshAccessToken = async (incomingRefreshToken, context = {}) => {
    if (!incomingRefreshToken) throw new ApiError(401, "Unauthorized request: Token missing");
    let decodedToken;
    try { decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET); } catch { throw new ApiError(401, "Invalid refresh token"); }
    if (!decodedToken.sid) throw new ApiError(401, "Refresh token requires re-authentication");
    const session = await authRepo.findSession(decodedToken.sid);
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new ApiError(401, "Refresh token expired or revoked");
    if (session.refreshTokenHash !== authRepo.hashSecret(incomingRefreshToken)) {
        await authRepo.revokeAllSessions(decodedToken._id);
        await auditAuth({ user: decodedToken._id, event: "refresh_token_reuse", status: "suspicious", ...context });
        throw new ApiError(401, "Refresh token reuse detected; sign in again");
    }
    const nextSessionId = crypto.randomUUID();
    const rotated = await authRepo.rotateSession(session.sessionId, nextSessionId);
    if (!rotated) {
        await authRepo.revokeAllSessions(decodedToken._id);
        await auditAuth({ user: decodedToken._id, event: "refresh_token_reuse", status: "suspicious", ...context, metadata: { reason: "rotation_race" } });
        throw new ApiError(401, "Refresh token reuse detected; sign in again");
    }
    const user = await userRepo.findUserById(decodedToken._id);
    if (!user) throw new ApiError(401, "User no longer exists");
    const refreshToken = user.generateRefreshToken(nextSessionId);
    const accessToken = user.generateAccessToken(nextSessionId);
    await authRepo.createSession({ user: user._id, sessionId: nextSessionId, refreshTokenHash: authRepo.hashSecret(refreshToken), ip: context.ip || session.ip, userAgent: context.userAgent || session.userAgent, expiresAt: new Date(Date.now() + parseDurationMs(process.env.REFRESH_TOKEN_EXPIRY)) });
    await auditAuth({ user: user._id, event: "token_refresh", status: "success", ...context });
    return { accessToken, refreshToken };
};

export const requestEmailVerification = async (email, context = {}) => {
    const user = await userRepo.findUserByEmail(email.toLowerCase().trim());
    if (user && !user.emailVerifiedAt) await issueOtp(user, "email_verification", context);
};

export const verifyEmail = async (email, otp, context = {}) => {
    const user = await userRepo.findUserByEmail(email.toLowerCase().trim());
    const code = user && await authRepo.findActiveAuthCode(user._id, "email_verification");
    if (!user || !code || code.attempts >= MAX_OTP_ATTEMPTS || authRepo.hashSecret(otp) !== code.codeHash) {
        if (code) await authRepo.incrementAuthCodeAttempts(code._id);
        await auditAuth({ user: user?._id, email, event: "email_verification", status: "failure", ...context });
        throw new ApiError(400, "Invalid or expired verification code");
    }
    await authRepo.consumeAuthCode(code._id);
    await userRepo.markEmailVerified(user._id);
    await auditAuth({ user: user._id, email: user.email, event: "email_verification", status: "success", ...context });
};

export const requestPasswordReset = async (email, context = {}) => {
    const user = await userRepo.findUserByEmail(email.toLowerCase().trim());
    if (user) await issueOtp(user, "password_reset", context);
};

export const resetPassword = async (email, otp, newPassword, context = {}) => {
    const user = await userRepo.findUserByEmail(email.toLowerCase().trim());
    const code = user && await authRepo.findActiveAuthCode(user._id, "password_reset");
    if (!user || !code || code.attempts >= MAX_OTP_ATTEMPTS || authRepo.hashSecret(otp) !== code.codeHash) {
        if (code) await authRepo.incrementAuthCodeAttempts(code._id);
        await auditAuth({ user: user?._id, email, event: "password_reset", status: "failure", ...context });
        throw new ApiError(400, "Invalid or expired reset code");
    }
    user.password = newPassword;
    await user.save();
    await authRepo.consumeAuthCode(code._id);
    await authRepo.revokeAllSessions(user._id);
    await auditAuth({ user: user._id, email: user.email, event: "password_reset", status: "success", ...context });
};
