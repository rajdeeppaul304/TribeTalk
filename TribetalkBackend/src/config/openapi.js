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
      "/users/current-user": { get: { summary: "Get the current user", security: [{ bearerAuth: [] }], responses: { 200: { description: "Current user" } } } },
      "/server/list-all-server": { get: { summary: "List accessible servers", security: [{ bearerAuth: [] }], responses: { 200: { description: "Server list" } } } },
      "/server/create-server": { post: { summary: "Create a server", security: [{ bearerAuth: [] }], responses: { 201: { description: "Created" } } } },
      "/channels/create-channel": { post: { summary: "Create a channel", security: [{ bearerAuth: [] }], responses: { 201: { description: "Created" } } } },
      "/messages/{channelId}/messages": { get: { summary: "Get channel messages", security: [{ bearerAuth: [] }], parameters: [{ name: "channelId", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Message history" } } } },
    },
  },
  apis: [],
});
