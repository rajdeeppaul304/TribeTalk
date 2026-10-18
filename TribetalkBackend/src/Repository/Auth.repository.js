import crypto from "node:crypto";
import { AuthCode } from "../Models/AuthCode.model.js";
import { AuthEvent } from "../Models/AuthEvent.model.js";
import { AuthSession } from "../Models/AuthSession.model.js";

export const hashSecret = (value) => crypto.createHash("sha256").update(value).digest("hex");

export const createAuthCode = (data) => AuthCode.create(data);
export const findActiveAuthCode = (userId, purpose) => AuthCode.findOne({ user: userId, purpose, consumedAt: null, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
export const consumeAuthCode = (id) => AuthCode.findByIdAndUpdate(id, { $set: { consumedAt: new Date() } }, { new: true });
export const incrementAuthCodeAttempts = (id) => AuthCode.findByIdAndUpdate(id, { $inc: { attempts: 1 } }, { new: true });
export const invalidateAuthCodes = (userId, purpose) => AuthCode.updateMany({ user: userId, purpose, consumedAt: null }, { $set: { consumedAt: new Date() } });

export const createSession = (data) => AuthSession.create(data);
export const findSession = (sessionId) => AuthSession.findOne({ sessionId });
export const rotateSession = (sessionId, replacement) => AuthSession.findOneAndUpdate(
  { sessionId, revokedAt: null, expiresAt: { $gt: new Date() } },
  { $set: { revokedAt: new Date(), replacedBy: replacement } },
  { new: true },
);
export const revokeSession = (userId, sessionId) => AuthSession.findOneAndUpdate(
  { user: userId, sessionId, revokedAt: null },
  { $set: { revokedAt: new Date() } },
  { new: true },
);
export const revokeAllSessions = (userId) => AuthSession.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });

export const recordAuthEvent = (data) => AuthEvent.create(data);
