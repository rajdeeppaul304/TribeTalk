import { ApiError } from "../Utils/ApiError.js";
import { asyncHandler } from "../Utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { User } from "../Models/User.model.js";
import { AuthSession } from "../Models/AuthSession.model.js";

export const verifyJWT = asyncHandler(async(req, _, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
        
        // console.log(token);
        if (!token) {
            throw new ApiError(401, "Unauthorized request")
        }
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        if (decodedToken.sid) {
            const session = await AuthSession.findOne({ sessionId: decodedToken.sid, revokedAt: null, expiresAt: { $gt: new Date() } }).select("_id").lean();
            if (!session) throw new ApiError(401, "Session revoked or expired");
        }
    
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
        if (!user) {
            
            throw new ApiError(401, "Invalid Access Token")
        }
    
        req.user = user;
        req.auth = decodedToken;
        next()
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token")
    }
    
})




export async function getUserFromToken(token) {
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    if (decoded.sid) {
        const session = await AuthSession.findOne({ sessionId: decoded.sid, revokedAt: null, expiresAt: { $gt: new Date() } }).select("_id").lean();
        if (!session) return null;
    }
    const user = await User.findById(decoded._id).select("-password -refreshToken");
    return user;
}
