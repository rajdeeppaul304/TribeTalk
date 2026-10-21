import { beforeEach, describe, expect, it, vi } from "vitest";
const es = { search: vi.fn(), index: vi.fn(), delete: vi.fn(), bulk: vi.fn() }; const cache = { getCached: vi.fn(), setCached: vi.fn(), cacheKeys: { search: vi.fn(() => "cache:search") } }; const serverRepo = { findUserAccessibleChannelIds: vi.fn() }; const messageModel = { find: vi.fn() }; const outbox = { dispatchOutboxEvent: vi.fn() }; const metrics = { trackDependency: vi.fn(async (_d, _o, work) => work()) };
vi.mock("../src/config/elasticsearch.js", () => ({ getElasticsearchClient: () => es, isElasticsearchReady: () => true, MESSAGE_INDEX: "messages" })); vi.mock("../src/Service/Cache.service.js", () => cache); vi.mock("../src/Repository/Server.repository.js", () => serverRepo); vi.mock("../src/Models/Message.model.js", () => ({ Message: messageModel })); vi.mock("../src/Service/Outbox.service.js", () => outbox); vi.mock("../src/config/metrics.js", () => metrics);
const service = await import("../src/Service/Search.service.js"); const oid = (v) => ({ toString: () => v });
beforeEach(() => { vi.clearAllMocks(); cache.getCached.mockResolvedValue(null); cache.setCached.mockResolvedValue(true); serverRepo.findUserAccessibleChannelIds.mockResolvedValue(["c1"]); es.search.mockResolvedValue({ hits: { hits: [] } }); es.index.mockResolvedValue({}); es.delete.mockResolvedValue({}); outbox.dispatchOutboxEvent.mockImplementation(({ fallback }) => fallback()); });
describe("search indexing and querying", () => {
  it("indexes and removes messages, including unavailable behavior", async () => {
    await expect(service.indexMessageNow({ _id: oid("m"), channel: oid("c"), sender: oid("u"), content: "hello", createdAt: new Date() })).resolves.toBeUndefined(); expect(es.index).toHaveBeenCalled();
    await expect(service.removeMessageFromIndexNow("m")).resolves.toBeUndefined(); await expect(service.indexMessage({ _id: oid("m"), channel: oid("c"), sender: oid("u"), content: "hello" })).resolves.toBeUndefined(); await expect(service.removeMessageFromIndex("m")).resolves.toBeUndefined();
  });
  it("returns cached, empty, filtered, highlighted, and fresh results", async () => {
    cache.getCached.mockResolvedValueOnce([{ messageId: "cached" }]); await expect(service.searchMessages("u", "hello", 10)).resolves.toEqual([{ messageId: "cached" }]);
    serverRepo.findUserAccessibleChannelIds.mockResolvedValue([]); cache.getCached.mockResolvedValue(null); await expect(service.searchMessages("u", "hello", 10)).resolves.toEqual([]);
    serverRepo.findUserAccessibleChannelIds.mockResolvedValue(["c1"]); es.search.mockResolvedValue({ hits: { hits: [{ _source: { messageId: "m", content: "hello" }, highlight: { content: ["<mark>hello</mark>"] } }] } }); await expect(service.searchMessages("u", "hello", 10, { channelId: "c1", senderId: "u", hasAttachments: true, from: "2026-01-01", to: "2026-01-02" })).resolves.toMatchObject([{ messageId: "m", highlight: "<mark>hello</mark>" }]); expect(cache.setCached).toHaveBeenCalled();
  });
  it("backfills existing messages and handles missing Elasticsearch", async () => {
    messageModel.find.mockReturnValue({ select: () => ({ populate: () => ({ lean: async () => [{ _id: oid("m"), channel: oid("c"), sender: { _id: oid("u"), username: "raj" }, content: "hi", createdAt: new Date() }] }) }) }); es.bulk.mockResolvedValue({ errors: false }); await expect(service.backfillMessageSearchIndex()).resolves.toBeUndefined(); expect(es.bulk).toHaveBeenCalled();
    es.delete.mockRejectedValue({ meta: { statusCode: 404 } }); await expect(service.removeMessageFromIndexNow("missing")).resolves.toBeUndefined();
  });
});
