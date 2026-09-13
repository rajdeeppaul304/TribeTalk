import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ID");
const optionalDescription = z.string().trim().max(200).optional();

export const registerSchema = z.object({
  body: z.object({
    username: z.string().trim().min(3).max(30),
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(72),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(72),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const refreshTokenSchema = z.object({
  body: z.object({ refreshToken: z.string().min(1).optional() }),
  params: z.object({}),
  query: z.object({}),
});

export const createServerSchema = z.object({
  body: z.object({ name: z.string().trim().min(3).max(50), description: optionalDescription }),
  params: z.object({}),
  query: z.object({}),
});

export const updateServerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(3).max(50).optional(),
    description: optionalDescription,
  }).refine((body) => Object.keys(body).length > 0, "Provide at least one field to update"),
  params: z.object({ id: objectId }),
  query: z.object({}),
});

export const serverIdParamsSchema = z.object({
  body: z.object({}),
  params: z.object({ id: objectId }),
  query: z.object({}),
});

export const joinServerSchema = z.object({
  body: z.object({ inviteCode: z.string().uuid() }),
  params: z.object({ id: objectId }),
  query: z.object({}),
});

export const createChannelSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(30),
    serverId: objectId,
    description: z.string().trim().max(100).optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const updateChannelSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(30).optional(),
    description: z.string().trim().max(100).optional(),
  }).refine((body) => Object.keys(body).length > 0, "Provide at least one field to update"),
  params: z.object({ id: objectId }),
  query: z.object({}),
});

export const channelIdParamsSchema = z.object({
  body: z.object({}),
  params: z.object({ id: objectId }),
  query: z.object({}),
});

export const messageHistorySchema = z.object({
  body: z.object({}),
  params: z.object({ channelId: objectId }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    before: objectId.optional(),
    after: objectId.optional(),
  }).refine((query) => !(query.before && query.after), "Use either before or after, not both"),
});

export const markReadSchema = z.object({
  body: z.object({ lastReadMessageId: objectId.optional() }),
  params: z.object({ channelId: objectId }),
  query: z.object({}),
});

export const messageIdParamsSchema = z.object({
  body: z.object({}),
  params: z.object({ messageId: objectId }),
  query: z.object({}),
});

export const editMessageSchema = z.object({
  body: z.object({ content: z.string().trim().min(1).max(2000) }),
  params: z.object({ messageId: objectId }),
  query: z.object({}),
});
