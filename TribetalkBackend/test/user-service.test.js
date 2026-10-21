import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

const userRepo = Object.fromEntries("findUserById findUserByEmailOrUsername createUserDoc findUserByIdWithoutSensitiveData findUserByEmail updateLoginFailure updateLoginSecurity unsetUserRefreshToken updateUserProfile findPublicUserProfileById searchPublicUsers markEmailVerified".split(" ").map((name) => [name, vi.fn()]));
const authRepo = Object.fromEntries("invalidateAuthCodes createAuthCode recordAuthEvent createSession revokeSession revokeAllSessions findSession hashSecret rotateSession findActiveAuthCode incrementAuthCodeAttempts consumeAuthCode".split(" ").map((name) => [name, vi.fn()]));
const cache = { cacheKeys: { profile: vi.fn((id) => `profile:${id}`) }, getCached: vi.fn(), setCached: vi.fn(), deleteCached: vi.fn() };
const email = { sendAuthOtp: vi.fn(), sendSecurityAlert: vi.fn() };
vi.mock("../src/Repository/User.repository.js", () => userRepo);
vi.mock("../src/Repository/Auth.repository.js", () => authRepo);
vi.mock("../src/Service/Email.service.js", () => email);
vi.mock("../src/Service/Cache.service.js", () => cache);
vi.mock("../src/config/redis.js", () => ({ getUsersPresence: vi.fn(async (ids) => Object.fromEntries(ids.map((id) => [id.toString(), true]))) }));
vi.mock("../src/config/env.js", () => ({ env: { EMAIL_VERIFICATION_REQUIRED: false } }));
const service = await import("../src/Service/User.service.js");
const makeUser = (id = "u1") => ({ _id: id, email: "raj@example.com", username: "raj", emailVerifiedAt: new Date(), failedLoginAttempts: 0, generateRefreshToken: vi.fn((sid) => `refresh-${sid}`), generateAccessToken: vi.fn((sid) => `access-${sid}`), isPasswordCorrect: vi.fn(async () => true), save: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";
  authRepo.hashSecret.mockImplementation((value) => `hash:${value}`); authRepo.recordAuthEvent.mockResolvedValue({}); authRepo.createSession.mockResolvedValue({}); authRepo.invalidateAuthCodes.mockResolvedValue({}); authRepo.createAuthCode.mockResolvedValue({});
  cache.getCached.mockResolvedValue(null); cache.setCached.mockResolvedValue(true); cache.deleteCached.mockResolvedValue(true);
});

describe("authentication service", () => {
  it("registers users and issues verification OTPs", async () => {
    userRepo.findUserByEmailOrUsername.mockResolvedValue(null); const user = makeUser(); userRepo.createUserDoc.mockResolvedValue(user); userRepo.findUserByIdWithoutSensitiveData.mockResolvedValue({ _id: "u1", username: "raj" });
    await expect(service.registerUser({ email: "RAJ@example.com", username: "Raj", password: "password123" })).resolves.toMatchObject({ username: "raj" });
    expect(authRepo.createAuthCode).toHaveBeenCalled(); expect(email.sendAuthOtp).toHaveBeenCalled();
    userRepo.findUserByEmailOrUsername.mockResolvedValue(user);
    await expect(service.registerUser({ email: "raj@example.com", username: "raj", password: "password123" })).rejects.toMatchObject({ statusCode: 409 });
  });
  it("logs in, detects invalid credentials, locks accounts, and refreshes sessions", async () => {
    const user = makeUser(); userRepo.findUserByEmail.mockResolvedValue(user); userRepo.findUserById.mockResolvedValue(user); userRepo.findUserByIdWithoutSensitiveData.mockResolvedValue({ _id: "u1", username: "raj" });
    await expect(service.loginUser({ email: "raj@example.com", password: "password123" }, { ip: "1.1.1.1" })).resolves.toMatchObject({ user: { username: "raj" } });
    user.isPasswordCorrect.mockResolvedValue(false);
    await expect(service.loginUser({ email: "raj@example.com", password: "bad" })).rejects.toMatchObject({ statusCode: 401 });
    user.isPasswordCorrect.mockResolvedValue(true); user.loginLockedUntil = new Date(Date.now() + 10_000);
    await expect(service.loginUser({ email: "raj@example.com", password: "password123" })).rejects.toMatchObject({ statusCode: 423 });
    user.loginLockedUntil = null;
    const sessionId = "s1"; const token = jwt.sign({ _id: "u1", sid: sessionId }, process.env.REFRESH_TOKEN_SECRET); authRepo.findSession.mockResolvedValue({ sessionId, refreshTokenHash: `hash:${token}`, revokedAt: null, expiresAt: new Date(Date.now() + 10000), ip: null, userAgent: null }); authRepo.rotateSession.mockResolvedValue(true);
    await expect(service.refreshAccessToken(token)).resolves.toMatchObject({ accessToken: expect.any(String), refreshToken: expect.any(String) });
    await expect(service.refreshAccessToken()).rejects.toMatchObject({ statusCode: 401 });
    await expect(service.refreshAccessToken("bad-token")).rejects.toMatchObject({ statusCode: 401 });
  });
  it("updates profiles, searches users, and handles public profile caching", async () => {
    userRepo.updateUserProfile.mockResolvedValue({ _id: "u1", username: "raj" });
    await expect(service.updateProfile("u1", { bio: "hello" })).resolves.toMatchObject({ username: "raj" });
    cache.getCached.mockResolvedValue({ _id: "u1", username: "raj", online: true });
    await expect(service.getPublicProfile("u1")).resolves.toMatchObject({ online: true });
    cache.getCached.mockResolvedValue(null); userRepo.findPublicUserProfileById.mockResolvedValue({ _id: "u1", username: "raj" });
    await expect(service.getPublicProfile("u1")).resolves.toMatchObject({ displayName: "raj" });
    userRepo.searchPublicUsers.mockResolvedValue([{ _id: "u1", username: "raj" }]);
    await expect(service.searchUsers("raj", 10)).resolves.toMatchObject([{ online: true }]);
  });
  it("verifies and resets passwords with valid and invalid OTPs", async () => {
    const user = makeUser(); userRepo.findUserByEmail.mockResolvedValue(user); const code = { _id: "code", attempts: 0, codeHash: "hash:123456" }; authRepo.findActiveAuthCode.mockResolvedValue(code);
    await expect(service.verifyEmail("raj@example.com", "123456")).resolves.toBeUndefined(); expect(userRepo.markEmailVerified).toHaveBeenCalled();
    authRepo.findActiveAuthCode.mockResolvedValue({ ...code, codeHash: "wrong" });
    await expect(service.verifyEmail("raj@example.com", "123456")).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.resetPassword("raj@example.com", "123456", "new-password")).rejects.toMatchObject({ statusCode: 400 });
    authRepo.findActiveAuthCode.mockResolvedValue(code); await expect(service.resetPassword("raj@example.com", "123456", "new-password")).resolves.toBeUndefined(); expect(user.save).toHaveBeenCalled();
  });
});
