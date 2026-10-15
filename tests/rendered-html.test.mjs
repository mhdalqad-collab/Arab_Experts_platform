import assert from "node:assert/strict";
import test from "node:test";

test("redirects the site root directly to the EIM application", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.ok([301, 302, 303, 307, 308].includes(response.status));
  assert.equal(
    new URL(response.headers.get("location"), "http://localhost").pathname,
    "/eim/index.html",
  );
});
