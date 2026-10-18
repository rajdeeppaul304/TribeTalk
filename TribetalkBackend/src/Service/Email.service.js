import { logger } from "../config/logger.js"
import { env } from "../config/env.js"
import { ApiError } from "../Utils/ApiError.js"
import { dispatchOutboxEvent } from "./Outbox.service.js"

const sendEmail = async ({ email, subject, text, purpose, ip, userAgent }) => {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    if (env.NODE_ENV === "production" && purpose !== "security_alert") throw new ApiError(503, "Email delivery is not configured")
    if (env.NODE_ENV !== "production") logger.info({ email, purpose, otp: purpose === "security_alert" ? undefined : text.match(/code is (\d+)/)?.[1], ip, userAgent }, "Development email generated")
    return { delivered: false, developmentOnly: true }
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email], subject, text }),
  })
  if (!response.ok) {
    logger.error({ statusCode: response.status, email, purpose }, "Email provider rejected message")
    throw new ApiError(503, "Could not deliver email")
  }
  return { delivered: true, developmentOnly: false }
}

export const sendAuthOtpNow = async ({ email, otp, purpose }) => {
  const subject = purpose === "email_verification" ? "Verify your TribeTalk email" : "Reset your TribeTalk password"
  const text = purpose === "email_verification"
    ? `Your TribeTalk verification code is ${otp}. It expires in 10 minutes.`
    : `Your TribeTalk password reset code is ${otp}. It expires in 10 minutes.`
  return sendEmail({ email, subject, text, purpose })
}

export const sendAuthOtp = async (payload) => dispatchOutboxEvent({ type: "email.auth_otp", payload, fallback: () => sendAuthOtpNow(payload) })

export const sendSecurityAlertNow = async ({ email, ip, userAgent }) => {
  const subject = "New TribeTalk sign-in detected"
  const text = `A sign-in was detected for your TribeTalk account. IP: ${ip || "unknown"}. Device: ${userAgent || "unknown"}. If this was not you, reset your password and revoke your sessions.`
  return sendEmail({ email, subject, text, purpose: "security_alert", ip, userAgent })
}

export const sendSecurityAlert = async (payload) => dispatchOutboxEvent({ type: "email.security_alert", payload, fallback: () => sendSecurityAlertNow(payload) })

