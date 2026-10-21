import { describe, expect, it } from "vitest";
import { openapiSpecification } from "../src/config/openapi.js";

describe("OpenAPI contract", () => {
  it("documents HTTPS deployments and local development", () => {
    expect(openapiSpecification.servers).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "/api/v1" }),
      expect.objectContaining({ url: "https://tribetalk.rajdeep.app/api/v1" }),
      expect.objectContaining({ url: "http://localhost:3000/api/v1" }),
    ]));
  });

  it("documents the Socket.IO connection and event contract", () => {
    const socket = openapiSpecification["x-socketio"];
    expect(socket.connection.productionUrl).toBe("wss://tribetalk.rajdeep.app/socket.io");
    expect(socket.transports).toEqual(expect.arrayContaining(["websocket", "polling"]));
    expect(Object.keys(socket.events.clientToServer)).toEqual(expect.arrayContaining(["send_message", "mark_read", "presence_heartbeat"]));
    expect(socket.events.serverToClient).toContain("new_message");
  });
});
