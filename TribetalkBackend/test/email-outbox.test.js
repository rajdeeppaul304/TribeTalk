import { beforeEach, describe, expect, it, vi } from "vitest";
const env = { RESEND_API_KEY: null, EMAIL_FROM: null, NODE_ENV: "test" }; const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }; const outbox = { dispatchOutboxEvent: vi.fn() };
vi.mock("../src/config/env.js", () => ({ env })); vi.mock("../src/config/logger.js", () => ({ logger })); vi.mock("../src/Service/Outbox.service.js", () => outbox);
const email = await import("../src/Service/Email.service.js");
beforeEach(() => { vi.clearAllMocks(); env.RESEND_API_KEY = null; env.EMAIL_FROM = null; env.NODE_ENV = "test"; outbox.dispatchOutboxEvent.mockImplementation(({ fallback }) => fallback()); });
describe("email delivery paths", () => {
  it("generates development OTP/security messages and outbox events", async () => {
    await expect(email.sendAuthOtpNow({ email: "a@b.com", otp: "123456", purpose: "email_verification" })).resolves.toMatchObject({ developmentOnly: true }); await expect(email.sendSecurityAlertNow({ email: "a@b.com" })).resolves.toMatchObject({ developmentOnly: true }); await expect(email.sendAuthOtp({ email: "a@b.com", otp: "123456", purpose: "password_reset" })).resolves.toMatchObject({ developmentOnly: true }); await expect(email.sendSecurityAlert({ email: "a@b.com" })).resolves.toMatchObject({ developmentOnly: true }); expect(logger.info).toHaveBeenCalled();
  });
  it("sends through the provider and handles provider failures", async () => {
    env.RESEND_API_KEY = "key"; env.EMAIL_FROM = "noreply@example.com"; globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }); await expect(email.sendAuthOtpNow({ email: "a@b.com", otp: "123456", purpose: "email_verification" })).resolves.toMatchObject({ delivered: true }); expect(fetch).toHaveBeenCalled();
    globalThis.fetch.mockResolvedValue({ ok: false, status: 400 }); await expect(email.sendSecurityAlertNow({ email: "a@b.com" })).rejects.toMatchObject({ statusCode: 503 });
    env.NODE_ENV = "production"; env.RESEND_API_KEY = null; env.EMAIL_FROM = null; await expect(email.sendAuthOtpNow({ email: "a@b.com", otp: "123456", purpose: "email_verification" })).rejects.toMatchObject({ statusCode: 503 });
  });
});
