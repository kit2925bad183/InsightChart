// Large datasets travel gzipped so they fit hosting limits (Vercel caps request and
// response bodies at 4.5 MB).
import { beforeEach, describe, expect, it } from "vitest";
import { gunzipSync, gzipSync } from "node:zlib";
import { addUser, cookieFor, freshDb, SAMPLE_CONFIG, SAMPLE_SOURCE } from "./helpers";
import * as datasetRoute from "@/app/api/dataset/route";

const PASSWORD = "Test#Pass2026";
let cookie: string;

// ~2,000 students with long free-text columns: several MB of JSON.
const bigSource = {
  ...SAMPLE_SOURCE,
  sheets: [
    {
      ...SAMPLE_SOURCE.sheets[0],
      rows: Array.from({ length: 2000 }, (_, i) => ({
        Name: `Student ${i}`,
        Registration: `R${String(i).padStart(5, "0")}`,
        Department: ["CSE", "ECE", "MECH"][i % 3],
        Score: i % 100,
        Remarks: "Consistent performer in lab sessions; needs more practice with timed problem solving. ".repeat(30),
      })),
    },
  ],
};

function gzRequest(method: string, body: Buffer, extra: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/dataset", {
    method,
    headers: { host: "localhost:3000", cookie, "content-type": "application/json", "x-body-encoding": "gzip", ...extra },
    body: new Uint8Array(body),
  });
}

beforeEach(async () => {
  const db = await freshDb();
  await addUser(db, { username: "admin", role: "ADMINISTRATOR", password: PASSWORD, email: "a@gmail.com", verified: true });
  cookie = await cookieFor(db, "admin", PASSWORD);
});

describe("compressed dataset transfer", () => {
  it("accepts a gzipped upload far larger than 4.5 MB, then serves it back gzipped", async () => {
    const json = JSON.stringify({ source: bigSource, config: SAMPLE_CONFIG });
    const gz = gzipSync(json);
    expect(json.length).toBeGreaterThan(4.5 * 1024 * 1024);
    expect(gz.length).toBeLessThan(1024 * 1024);

    const put = await datasetRoute.PUT(gzRequest("PUT", gz), undefined);
    expect(put.status).toBe(200);

    const get = await datasetRoute.GET(
      new Request("http://localhost:3000/api/dataset", { headers: { host: "localhost:3000", cookie, "accept-encoding": "gzip, deflate, br" } }),
      undefined
    );
    expect(get.headers.get("content-encoding")).toBe("gzip");
    const raw = Buffer.from(await get.arrayBuffer());
    expect(raw.length).toBeLessThan(4.5 * 1024 * 1024);
    const body = JSON.parse(gunzipSync(raw).toString("utf8")) as { dataset: { source: typeof bigSource } };
    expect(body.dataset.source.sheets[0].rows).toHaveLength(2000);
    expect(body.dataset.source.sheets[0].rows[1999].Registration).toBe("R01999");
  });

  it("still serves plain JSON to clients that don't accept gzip", async () => {
    const get = await datasetRoute.GET(new Request("http://localhost:3000/api/dataset", { headers: { host: "localhost:3000", cookie } }), undefined);
    expect(get.headers.get("content-encoding")).toBeNull();
    expect(await get.json()).toEqual({ dataset: null });
  });

  it("rejects a compressed body that expands past the size limit, and garbage", async () => {
    const bomb = gzipSync(Buffer.alloc(30 * 1024 * 1024, 32)); // 30 MB of spaces → ~30 KB compressed
    const tooBig = await datasetRoute.PUT(gzRequest("PUT", bomb), undefined);
    expect(tooBig.status).toBe(413);
    const garbage = await datasetRoute.PUT(gzRequest("PUT", Buffer.from("not gzip at all")), undefined);
    expect(garbage.status).toBe(400);
  });
});
