import swaggerJSDoc from "swagger-jsdoc";

export const openapiSpecification = swaggerJSDoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "TribeTalk API",
      version: "1.0.0",
      description: "REST API for the TribeTalk real-time community platform.",
    },
    servers: [{ url: "/api/v1", description: "Current deployment" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        ApiResponse: {
          type: "object",
          properties: {
            statusCode: { type: "integer" },
            data: { nullable: true },
            message: { type: "string" },
            success: { type: "boolean" },
          },
        },
      },
    },
    paths: {
      "/users/register": { post: { summary: "Register a user", requestBody: { required: true }, responses: { 201: { description: "Created" }, 400: { description: "Validation failed" }, 409: { description: "User already exists" } } } },
      "/users/login": { post: { summary: "Log in", requestBody: { required: true }, responses: { 200: { description: "Authenticated" }, 401: { description: "Invalid credentials" } } } },
      "/users/email-verification/request": { post: { summary: "Request an email verification OTP", requestBody: { required: true }, responses: { 200: { description: "Generic response" } } } },
      "/users/email-verification/verify": { post: { summary: "Verify an email with an OTP", requestBody: { required: true }, responses: { 200: { description: "Email verified" }, 400: { description: "Invalid or expired OTP" } } } },
      "/users/password-reset/request": { post: { summary: "Request a password reset OTP", requestBody: { required: true }, responses: { 200: { description: "Generic response" } } } },
      "/users/password-reset/confirm": { post: { summary: "Reset a password with an OTP", requestBody: { required: true }, responses: { 200: { description: "Password reset" }, 400: { description: "Invalid or expired OTP" } } } },
      "/users/logout-all": { post: { summary: "Revoke all authenticated sessions", security: [{ bearerAuth: [] }], responses: { 200: { description: "Sessions revoked" } } } },
      "/users/current-user": { get: { summary: "Get the current user", security: [{ bearerAuth: [] }], responses: { 200: { description: "Current user" } } } },
      "/users/profile": { patch: { summary: "Update the authenticated user's profile", security: [{ bearerAuth: [] }], requestBody: { required: true }, responses: { 200: { description: "Updated profile" } } } },
      "/users/{userId}/profile": { get: { summary: "Get a public user profile", security: [{ bearerAuth: [] }], parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Public profile" }, 404: { description: "User not found" } } } },
      "/server/list-all-server": { get: { summary: "List accessible servers", security: [{ bearerAuth: [] }], responses: { 200: { description: "Server list" } } } },
      "/server/create-server": { post: { summary: "Create a server", security: [{ bearerAuth: [] }], responses: { 201: { description: "Created" } } } },
      "/server/{id}/members/{memberId}/warnings": { post: { summary: "Warn a server member", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "memberId", in: "path", required: true, schema: { type: "string" } }], responses: { 201: { description: "Warning created" }, 403: { description: "Moderator permission required" } } } },
      "/server/{id}/members/{memberId}/ban": { post: { summary: "Temporarily ban a server member", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "memberId", in: "path", required: true, schema: { type: "string" } }], responses: { 201: { description: "Temporary ban created" }, 403: { description: "Moderator permission required" } } }, delete: { summary: "Revoke a temporary ban", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "memberId", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Ban revoked" } } } },
      "/server/{id}/moderation-actions": { get: { summary: "List moderation actions", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Moderation history" }, 403: { description: "Moderator permission required" } } } },
      "/channels/create-channel": { post: { summary: "Create a channel", security: [{ bearerAuth: [] }], responses: { 201: { description: "Created" } } } },
      "/uploads/image": { post: { summary: "Upload an image for an avatar or message attachment", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["image"], properties: { image: { type: "string", format: "binary" } } } } } }, responses: { 201: { description: "Cloudinary image metadata" }, 413: { description: "Image exceeds 5 MB" }, 503: { description: "Cloudinary is not configured" } } } },
      "/search/messages": { get: { summary: "Search accessible message content", security: [{ bearerAuth: [] }], parameters: [{ name: "q", in: "query", required: true, schema: { type: "string", minLength: 2 } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50 } }, { name: "channelId", in: "query", schema: { type: "string" } }, { name: "senderId", in: "query", schema: { type: "string" } }, { name: "from", in: "query", schema: { type: "string", format: "date-time" } }, { name: "to", in: "query", schema: { type: "string", format: "date-time" } }, { name: "hasAttachments", in: "query", schema: { type: "boolean" } }], responses: { 200: { description: "Search results" }, 503: { description: "Elasticsearch is unavailable" } } } },
      "/direct-messages/conversations": { get: { summary: "List direct-message conversations", security: [{ bearerAuth: [] }], responses: { 200: { description: "Conversations" } } }, post: { summary: "Create or find a direct-message conversation", security: [{ bearerAuth: [] }], responses: { 201: { description: "Conversation" } } } },
      "/direct-messages/conversations/{id}/messages": { get: { summary: "List direct messages", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Messages" } } }, post: { summary: "Send a direct message", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 201: { description: "Message sent" } } } },
      "/scheduled-messages": { post: { summary: "Schedule a channel message", security: [{ bearerAuth: [] }], responses: { 201: { description: "Scheduled message" } } } },
      "/scheduled-messages/{channelId}": { get: { summary: "List scheduled messages for a channel", security: [{ bearerAuth: [] }], parameters: [{ name: "channelId", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Scheduled messages" } } } },
      "/scheduled-messages/{id}": { delete: { summary: "Cancel a scheduled message", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Cancelled" } } } },
      "/messages/{channelId}/messages": { get: { summary: "Get channel messages", security: [{ bearerAuth: [] }], parameters: [{ name: "channelId", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Message history" } } } },
    },
  },
  apis: [],
});
