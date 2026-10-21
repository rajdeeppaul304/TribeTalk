import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const baseUrl = __ENV.BASE_URL || "http://localhost:8080";
const token = __ENV.ACCESS_TOKEN;
const serverId = __ENV.SERVER_ID;
const channelId = __ENV.CHANNEL_ID;
const userId = __ENV.USER_ID;
const loadTestKey = __ENV.LOAD_TEST_KEY;
const searchQuery = __ENV.SEARCH_QUERY;
const workload = __ENV.WORKLOAD || "mixed";
const responseStatuses = new Counter("api_response_status_total");

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || "2m",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

const headers = {
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...(loadTestKey ? { "x-tribetalk-load-test": loadTestKey } : {}),
};

export default function () {
  const requests = workload === "cacheable" ? [] : [
    ["current-user", `${baseUrl}/api/v1/users/current-user`],
    ["notifications", `${baseUrl}/api/v1/users/notifications`],
  ];
  requests.push(["list-servers", `${baseUrl}/api/v1/server/list-all-server`]);
  if (userId && workload !== "cacheable") {
    requests.push(["current-user-profile", `${baseUrl}/api/v1/users/${userId}/profile`]);
  }
  if (userId) {
    requests.push(["public-profile", `${baseUrl}/api/v1/users/${userId}/profile`]);
    if (workload !== "cacheable") requests.push(["user-search", `${baseUrl}/api/v1/users/search?q=bench&limit=10`]);
  }
  if (serverId) {
    requests.push(["single-server", `${baseUrl}/api/v1/server/single-server/${serverId}`]);
    if (workload !== "cacheable") {
      requests.push(["invites", `${baseUrl}/api/v1/server/${serverId}/invites`]);
      requests.push(["audit-logs", `${baseUrl}/api/v1/server/${serverId}/audit-logs`]);
      requests.push(["moderation-actions", `${baseUrl}/api/v1/server/${serverId}/moderation-actions`]);
    }
  }
  if (channelId && workload !== "cacheable") {
    requests.push(["channel-info", `${baseUrl}/api/v1/channels/channel-info/${channelId}`]);
    requests.push(["message-history", `${baseUrl}/api/v1/messages/${channelId}/messages?limit=20`]);
    requests.push(["unread-count", `${baseUrl}/api/v1/messages/${channelId}/unread-count?limit=20`]);
    requests.push(["channel-sync", `${baseUrl}/api/v1/messages/${channelId}/sync?limit=20`]);
  }
  if (searchQuery) requests.push(["message-search", `${baseUrl}/api/v1/search/messages?q=${encodeURIComponent(searchQuery)}&limit=20`]);
  requests.forEach(([operation, url]) => {
    const response = http.get(url, { headers, tags: { flow: "cache-api", operation } });
    responseStatuses.add(1, { operation, status: String(response.status) });
    check(response, { "status is successful": (item) => item.status >= 200 && item.status < 400 });
  });
  sleep(Number(__ENV.SLEEP_SECONDS || 0.5));
}
