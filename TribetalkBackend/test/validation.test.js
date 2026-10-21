import { describe, expect, it } from "vitest";
import {
  registerSchema, loginSchema, refreshTokenSchema, verifyEmailSchema, resetPasswordSchema,
  updateProfileSchema, publicProfileParamsSchema, createServerSchema, updateServerSchema,
  joinServerSchema, createInviteSchema, memberRoleSchema, moderationWarningSchema,
  temporaryBanSchema, createChannelSchema, updateChannelSchema, messageHistorySchema,
  markReadSchema, editMessageSchema, searchMessagesSchema, createConversationSchema,
  conversationIdSchema, directMessageSchema, scheduleMessageSchema, listScheduledMessagesSchema,
  cancelScheduledMessageSchema,
} from "../src/Validation/schemas.js";

const id = "507f1f77bcf86cd799439011";
const envelope = (body = {}, params = {}, query = {}) => ({ body, params, query });
const cases = [
  ["accepts a valid registration", registerSchema, envelope({ username: "rajdeep", email: "raj@example.com", password: "password123" }) , true],
  ["rejects a short username", registerSchema, envelope({ username: "ra", email: "raj@example.com", password: "password123" }), false],
  ["accepts a valid login", loginSchema, envelope({ email: "raj@example.com", password: "password123" }), true],
  ["rejects an invalid login email", loginSchema, envelope({ email: "not-email", password: "password123" }), false],
  ["accepts an optional refresh token", refreshTokenSchema, envelope({}), true],
  ["accepts a six digit OTP", verifyEmailSchema, envelope({ email: "raj@example.com", otp: "123456" }), true],
  ["rejects a malformed OTP", verifyEmailSchema, envelope({ email: "raj@example.com", otp: "123" }), false],
  ["accepts a password reset", resetPasswordSchema, envelope({ email: "raj@example.com", otp: "123456", password: "password123" }), true],
  ["accepts a profile update", updateProfileSchema, envelope({ displayName: "Rajdeep", bio: "Hello" }), true],
  ["accepts a public profile id", publicProfileParamsSchema, envelope({}, { userId: id }), true],
  ["rejects an invalid public profile id", publicProfileParamsSchema, envelope({}, { userId: "bad" }), false],
  ["accepts server creation", createServerSchema, envelope({ name: "TribeTalk" }), true],
  ["rejects a short server name", createServerSchema, envelope({ name: "x" }), false],
  ["accepts server update", updateServerSchema, envelope({ name: "New name" }, { id }), true],
  ["accepts a UUID invite join", joinServerSchema, envelope({ inviteCode: "123e4567-e89b-12d3-a456-426614174000" }, { id }), true],
  ["rejects a non UUID invite", joinServerSchema, envelope({ inviteCode: "raw-server-id" }, { id }), false],
  ["accepts invite limits", createInviteSchema, envelope({ expiresInHours: 24, maxUses: 10 }, { id }), true],
  ["accepts a moderator role", memberRoleSchema, envelope({ role: "moderator" }, { id, memberId: id }), true],
  ["rejects an owner role promotion", memberRoleSchema, envelope({ role: "owner" }, { id, memberId: id }), false],
  ["accepts a moderation warning", moderationWarningSchema, envelope({ reason: "Repeated spam" }, { id, memberId: id }), true],
  ["rejects a short moderation reason", moderationWarningSchema, envelope({ reason: "no" }, { id, memberId: id }), false],
  ["accepts a temporary ban", temporaryBanSchema, envelope({ durationMinutes: 30, reason: "Repeated spam" }, { id, memberId: id }), true],
  ["rejects a zero minute ban", temporaryBanSchema, envelope({ durationMinutes: 0, reason: "Repeated spam" }, { id, memberId: id }), false],
  ["accepts channel creation", createChannelSchema, envelope({ name: "general", serverId: id }), true],
  ["accepts channel update", updateChannelSchema, envelope({ description: "Chat" }, { id }), true],
  ["accepts paginated history", messageHistorySchema, envelope({}, { channelId: id }, { limit: "50" }), true],
  ["rejects conflicting history cursors", messageHistorySchema, envelope({}, { channelId: id }, { before: id, after: id }), false],
  ["accepts a mark-read payload", markReadSchema, envelope({ lastReadMessageId: id }, { channelId: id }), true],
  ["accepts an edited message", editMessageSchema, envelope({ content: "Updated" }, { messageId: id }), true],
  ["rejects an empty edited message", editMessageSchema, envelope({ content: " " }, { messageId: id }), false],
  ["accepts filtered message search", searchMessagesSchema, envelope({}, {}, { q: "hello", hasAttachments: "true" }), true],
  ["accepts a direct-message conversation", createConversationSchema, envelope({ participantId: id }), true],
  ["accepts a scheduled message", scheduleMessageSchema, envelope({ channelId: id, content: "Later", scheduledFor: "2027-01-01T00:00:00.000Z" }), true],
];

describe("request validation contract", () => {
  it.each(cases)("%s", (_name, schema, payload, expected) => {
    expect(schema.safeParse(payload).success).toBe(expected);
  });
});

describe("direct-message and scheduled-message contracts", () => {
  it("accepts a direct message with an idempotency key", () => expect(directMessageSchema.safeParse(envelope({ content: "Hi", clientId: "client-1" }, { id })).success).toBe(true));
  it("accepts a conversation history cursor", () => expect(conversationIdSchema.safeParse(envelope({}, { id }, { limit: "20" })).success).toBe(true));
  it("accepts scheduled-message listing", () => expect(listScheduledMessagesSchema.safeParse(envelope({}, { channelId: id })).success).toBe(true));
  it("accepts scheduled-message cancellation", () => expect(cancelScheduledMessageSchema.safeParse(envelope({}, { id })).success).toBe(true));
});
