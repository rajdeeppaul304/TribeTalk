import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("application baseline", () => {
  it("reports a healthy service without a database connection", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok" });
  });

  it("returns the standard JSON shape for unknown routes", async () => {
    const response = await request(app).get("/api/v1/not-a-route");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      success: false,
      message: "Route not found",
    });
  });

  it("validates malformed registration payloads before reaching the database", async () => {
    const response = await request(app).post("/api/v1/users/register").send({ email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      success: false,
      message: "Validation failed",
    });
  });
});
