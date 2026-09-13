import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const cookieOptions = { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "lax", path: "/api/admin" };

export const createAdminSession = (res) => {
  const token = jwt.sign({ scope: "admin-dashboard" }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "2h" });
  res.cookie("tribetalk_admin", token, { ...cookieOptions, maxAge: 2 * 60 * 60 * 1000 });
};

export const clearAdminSession = (res) => res.clearCookie("tribetalk_admin", cookieOptions);

export const requireAdminSession = (req, res, next) => {
  try {
    const token = req.cookies?.tribetalk_admin;
    const payload = token && jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    if (!payload || typeof payload === "string" || payload.scope !== "admin-dashboard") return res.status(401).json({ message: "Admin login required" });
    next();
  } catch { return res.status(401).json({ message: "Admin login required" }); }
};
