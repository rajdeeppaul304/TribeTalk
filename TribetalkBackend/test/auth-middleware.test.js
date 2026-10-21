import { beforeEach, describe, expect, it, vi } from "vitest";

const jwt = { verify: vi.fn() };
const users = { findById: vi.fn() };
const sessions = { findOne: vi.fn() };
vi.mock("jsonwebtoken", () => ({ default: jwt }));
vi.mock("../src/Models/User.model.js", () => ({ User: users }));
vi.mock("../src/Models/AuthSession.model.js", () => ({ AuthSession: sessions }));

const { verifyJWT, getUserFromToken } = await import("../src/Middlewares/Auth.middleware.js");

const chain = (value) => ({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(value) }) });
beforeEach(() => {
  vi.clearAllMocks();
  process.env.ACCESS_TOKEN_SECRET = "test-secret";
  sessions.findOne.mockReturnValue(chain({ _id: "session" }));
  users.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: "u1" }) });
  jwt.verify.mockReturnValue({ _id: "u1", sid: "s1" });
});

describe("JWT middleware", () => {
  it("rejects a request without a token", async () => {
    const next = vi.fn();
    await verifyJWT({ cookies: {}, header: () => undefined }, {}, next);
    await new Promise((resolve) => setImmediate(resolve));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("accepts a bearer token and attaches user/auth context", async () => {
    const req = { cookies: {}, header: (name) => name === "Authorization" ? "Bearer token" : undefined };
    const next = vi.fn();
    await verifyJWT(req, {}, next);
    await new Promise((resolve) => setImmediate(resolve));
    expect(req.user).toEqual({ _id: "u1" });
    expect(req.auth).toMatchObject({ _id: "u1" });
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects revoked sessions and unknown users", async () => {
    sessions.findOne.mockReturnValueOnce(chain(null));
    const firstNext = vi.fn();
    await verifyJWT({ cookies: { accessToken: "token" }, header: () => undefined }, {}, firstNext);
    await new Promise((resolve) => setImmediate(resolve));
    expect(firstNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));

    sessions.findOne.mockReturnValueOnce(chain({ _id: "session" }));
    users.findById.mockReturnValueOnce({ select: vi.fn().mockResolvedValue(null) });
    const secondNext = vi.fn();
    await verifyJWT({ cookies: { accessToken: "token" }, header: () => undefined }, {}, secondNext);
    await new Promise((resolve) => setImmediate(resolve));
    expect(secondNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("reads valid, missing, revoked, and invalid tokens", async () => {
    await expect(getUserFromToken(null)).resolves.toBeNull();
    await expect(getUserFromToken("token")).resolves.toEqual({ _id: "u1" });
    sessions.findOne.mockReturnValueOnce(chain(null));
    await expect(getUserFromToken("token")).resolves.toBeNull();
    jwt.verify.mockImplementationOnce(() => { throw new Error("bad token"); });
    await expect(getUserFromToken("bad")).rejects.toThrow("bad token");
  });
});
