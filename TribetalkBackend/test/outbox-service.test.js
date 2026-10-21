import { beforeEach, describe, expect, it, vi } from "vitest";

const eventModel = { create: vi.fn(), updateOne: vi.fn() };
const queues = { areQueuesReady: vi.fn(), enqueueOutboxEvent: vi.fn() };
const logger = { warn: vi.fn(), error: vi.fn() };
vi.mock("../src/Models/OutboxEvent.model.js", () => ({ OutboxEvent: eventModel }));
vi.mock("../src/config/queues.js", () => queues);
vi.mock("../src/config/logger.js", () => ({ logger }));

const { dispatchOutboxEvent } = await import("../src/Service/Outbox.service.js");

beforeEach(() => {
  vi.clearAllMocks();
  queues.areQueuesReady.mockReturnValue(false);
  queues.enqueueOutboxEvent.mockResolvedValue(true);
  eventModel.create.mockResolvedValue({ _id: { toString: () => "e1" } });
  eventModel.updateOne.mockResolvedValue({});
});

describe("outbox processing", () => {
  it("persists and completes inline fallback", async () => {
    await expect(dispatchOutboxEvent({ type: "x", payload: {}, fallback: vi.fn(async () => "ok") })).resolves.toBe("ok");
    expect(eventModel.create).toHaveBeenCalled();
    expect(eventModel.updateOne).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ $set: expect.objectContaining({ status: "completed" }) }));
  });

  it("queues when workers are ready", async () => {
    queues.areQueuesReady.mockReturnValue(true);
    await expect(dispatchOutboxEvent({ type: "x", payload: {} })).resolves.toMatchObject({ queued: true, eventId: "e1" });
    expect(queues.enqueueOutboxEvent).toHaveBeenCalled();
  });

  it("marks queue failures and propagates them", async () => {
    queues.areQueuesReady.mockReturnValue(true);
    queues.enqueueOutboxEvent.mockRejectedValue(new Error("queue down"));
    await expect(dispatchOutboxEvent({ type: "x", payload: {} })).rejects.toThrow("queue down");
    expect(eventModel.updateOne).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ $set: expect.objectContaining({ status: "failed" }) }));
  });

  it("falls back when persistence fails", async () => {
    eventModel.create.mockRejectedValue(new Error("mongo down"));
    await expect(dispatchOutboxEvent({ type: "x", payload: {}, fallback: vi.fn(async () => "fallback") })).resolves.toBe("fallback");
    expect(logger.warn).toHaveBeenCalled();
  });

  it("marks inline fallback failures", async () => {
    await expect(dispatchOutboxEvent({ type: "x", payload: {}, fallback: vi.fn(async () => { throw new Error("send failed"); }) })).rejects.toThrow("send failed");
    expect(eventModel.updateOne).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ $set: expect.objectContaining({ status: "failed" }) }));
  });
});
