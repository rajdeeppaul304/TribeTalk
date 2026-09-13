import jwt from "jsonwebtoken";
import * as userRepo from "../Repository/User.repository.js";
import { ApiError } from "../Utils/ApiError.js";

export const generateAccessAndRefreshTokens = async (userId) => {
    const user = await userRepo.findUserById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    await userRepo.saveUserRefreshToken(user._id, refreshToken);

    return { accessToken, refreshToken };
};

export const registerUser = async ({ email, username, password }) => {
    const existedUser = await userRepo.findUserByEmailOrUsername(email, username);
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists");
    }

    const createdUser = await userRepo.createUserDoc({
        email,
        password,
        username: username.toLowerCase(),
        displayName: username.trim()
    });

    const safeUser = await userRepo.findUserByIdWithoutSensitiveData(createdUser._id);
    if (!safeUser) {
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    return safeUser;
};

export const loginUser = async ({ email, password }) => {
    const user = await userRepo.findUserByEmail(email);
    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const safeUser = await userRepo.findUserByIdWithoutSensitiveData(user._id);

    return {
        user: safeUser,
        accessToken,
        refreshToken
    };
};

export const logoutUser = async (userId) => {
    await userRepo.unsetUserRefreshToken(userId);
    return true;
};

export const updateProfile = async (userId, profile) => {
    const updatedUser = await userRepo.updateUserProfile(userId, profile);
    if (!updatedUser) {
        throw new ApiError(404, "User not found");
    }
    return updatedUser;
};

export const getPublicProfile = async (userId) => {
    const user = await userRepo.findPublicUserProfileById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    return {
        ...user,
        displayName: user.displayName || user.username,
    };
};

export const refreshAccessToken = async (incomingRefreshToken) => {
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request: Token missing");
    }

    let decodedToken;
    try {
        decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );
    } catch (err) {
        throw new ApiError(401, "Invalid refresh token");
    }

    const user = await userRepo.findUserById(decodedToken._id);
    if (!user || user.refreshToken !== incomingRefreshToken) {
        throw new ApiError(401, "Refresh token expired or reused");
    }

    return await generateAccessAndRefreshTokens(user._id);
};
