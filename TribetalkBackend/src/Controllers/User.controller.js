import { asyncHandler } from "../Utils/asyncHandler.js";
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import * as userService from "../Service/User.service.js";
import { env } from "../config/env.js";
import * as notificationService from "../Service/Notification.service.js";

const cookieOptions = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/"
};

export const registerUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;

    if (!email?.trim() || !username?.trim() || !password?.trim()) {
        throw new ApiError(400, "All fields (email, username, password) are required");
    }

    const createdUser = await userService.registerUser({
        email: email.trim(),
        username: username.trim(),
        password
    }, requestContext(req));

    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully")
    );
});

export const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    const { user, accessToken, refreshToken } = await userService.loginUser({
        email: email.trim(),
        password
    }, requestContext(req));

    return res
        .status(200)
        .cookie("accessToken", accessToken, {
            ...cookieOptions,
            maxAge: 60 * 60 * 1000 // 1 hour
        })
        .cookie("refreshToken", refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        })
        .json(
            new ApiResponse(
                200,
                { user, accessToken },
                "User logged in successfully"
            )
        );
});

export const logoutUser = asyncHandler(async (req, res) => {
    await userService.logoutUser(req.user._id, req.auth?.sid);

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, {}, "User logged out successfully"));
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies?.refreshToken || req.body?.refreshToken;

    const { accessToken, refreshToken: newRefreshToken } =
        await userService.refreshAccessToken(incomingRefreshToken, requestContext(req));

    return res
        .status(200)
        .cookie("accessToken", accessToken, {
            ...cookieOptions,
            maxAge: 60 * 60 * 1000
        })
        .cookie("refreshToken", newRefreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000
        })
        .json(
            new ApiResponse(
                200,
                { accessToken },
                "Access token refreshed successfully"
            )
        );
});

const requestContext = (req) => ({
    ip: req.ip,
    userAgent: req.get("user-agent") || null,
    requestId: req.id || null,
});

export const requestEmailVerification = asyncHandler(async (req, res) => {
    await userService.requestEmailVerification(req.body.email, requestContext(req));
    return res.json(new ApiResponse(200, null, "If the account exists, a verification code has been sent"));
});

export const verifyEmail = asyncHandler(async (req, res) => {
    await userService.verifyEmail(req.body.email, req.body.otp, requestContext(req));
    return res.json(new ApiResponse(200, null, "Email verified successfully"));
});

export const requestPasswordReset = asyncHandler(async (req, res) => {
    await userService.requestPasswordReset(req.body.email, requestContext(req));
    return res.json(new ApiResponse(200, null, "If the account exists, a password reset code has been sent"));
});

export const resetPassword = asyncHandler(async (req, res) => {
    await userService.resetPassword(req.body.email, req.body.otp, req.body.password, requestContext(req));
    return res.json(new ApiResponse(200, null, "Password reset successfully"));
});

export const logoutAllSessions = asyncHandler(async (req, res) => {
    await userService.logoutAllSessions(req.user._id);
    return res.status(200).clearCookie("accessToken", cookieOptions).clearCookie("refreshToken", cookieOptions).json(new ApiResponse(200, null, "All sessions revoked"));
});

export const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "User profile fetched successfully"));
});

export const updateCurrentUserProfile = asyncHandler(async (req, res) => {
    const updatedUser = await userService.updateProfile(req.user._id, req.body);

    return res.status(200).json(
        new ApiResponse(200, updatedUser, "Profile updated successfully")
    );
});

export const getPublicUserProfile = asyncHandler(async (req, res) => {
    const profile = await userService.getPublicProfile(req.params.userId);

    return res.status(200).json(
        new ApiResponse(200, profile, "Public profile fetched successfully")
    );
});

export const getNotifications = asyncHandler(async (req, res) => {
    const notifications = await notificationService.listNotifications(req.user._id);
    return res.json(new ApiResponse(200, notifications, "Notifications retrieved"));
});

export const markNotificationsRead = asyncHandler(async (req, res) => {
    await notificationService.markNotificationsRead(req.user._id, req.body.ids || []);
    return res.json(new ApiResponse(200, null, "Notifications marked as read"));
});
