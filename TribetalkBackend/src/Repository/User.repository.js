import { User } from "../Models/User.model.js";

export const findUserByEmailOrUsername = async (email, username) => {
    return await User.findOne({
        $or: [{ username }, { email }]
    });
};

export const findUserByEmail = async (email) => {
    return await User.findOne({ email });
};

export const findUserById = async (userId) => {
    return await User.findById(userId);
};

export const findUserByIdWithoutSensitiveData = async (userId) => {
    return await User.findById(userId).select("-password -refreshToken").lean();
};

export const createUserDoc = async (userData) => {
    return await User.create(userData);
};

export const saveUserRefreshToken = async (userId, refreshToken) => {
    const user = await User.findById(userId);
    if (!user) return null;

    user.refreshToken = refreshToken;
    return await user.save({ validateBeforeSave: false });
};

export const unsetUserRefreshToken = async (userId) => {
    return await User.findByIdAndUpdate(
        userId,
        {
            $unset: {
                refreshToken: 1
            }
        },
        { new: true }
    );
};

export const updateUserProfile = async (userId, profile) => {
    return await User.findByIdAndUpdate(
        userId,
        { $set: profile },
        { new: true, runValidators: true }
    ).select("-password -refreshToken").lean();
};

export const findPublicUserProfileById = async (userId) => {
    return await User.findById(userId)
        .select("_id username displayName avatar bio createdAt lastSeenAt")
        .lean();
};
