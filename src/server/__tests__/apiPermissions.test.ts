// Calls the real route handlers with forged requests — the same thing someone could do
// from browser dev tools or curl — to prove the server, not the UI, enforces roles.
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db";
import { addUser, cookieFor, freshDb, request, SAMPLE_CONFIG, SAMPLE_SOURCE } from "./helpers";
import * as datasetRoute from "@/app/api/dataset/route";
import * as datasetConfigRoute from "@/app/api/dataset/config/route";
import * as datasetRowsRoute from "@/app/api/dataset/rows/route";
import * as exportRoute from "@/app/api/dataset/export/route";
import * as usersRoute from "@/app/api/users/route";
import * as userRoute from "@/app/api/users/[id]/route";
import * as meRoute from "@/app/api/auth/me/route";
import * as firstLoginSend from "@/app/api/auth/first-login/send-otp/route";

let db: Db;
let ids: Record<string, number>;
let cookies: Record<string, string>;

const PASSWORD = "Test#Pass2026";

beforeEach(async () => {
  db = await freshDb();
  ids = {
    creator: await addUser(db, { username: "Vishvag", role: "CREATOR_ADMIN", password: PASSWORD, email: "c@gmail.com", verified: true }),
    admin: await addUser(db, { username: "administrator", role: "ADMINISTRATOR", password: PASSWORD, email: "a@gmail.com", verified: true }),
    hod: await addUser(db, { username: "hod", role: "HOD", password: PASSWORD, email: "h@gmail.com", verified: true }),
    faculty: await addUser(db, { username: "faculty", role: "FACULTY", password: PASSWORD, email: "f@gmail.com", verified: true }),
    pending: await addUser(db, { username: "newbie", role: "FACULTY", password: PASSWORD, email: "n@gmail.com", mustChange: true }),
  };
  cookies = {
    creator: await cookieFor(db, "Vishvag", PASSWORD),
    admin: await cookieFor(db, "administrator", PASSWORD),
    hod: await cookieFor(db, "hod", PASSWORD),
    faculty: await cookieFor(db, "faculty", PASSWORD),
    pending: await cookieFor(db, "newbie", PASSWORD),
  };
});

async function publish(cookie = cookies.admin) {
  const res = await datasetRoute.PUT(request("PUT", "/api/dataset", { cookie, body: { source: SAMPLE_SOURCE, config: SAMPLE_CONFIG } }), undefined);
  expect(res.status).toBe(200);
  return ((await res.json()) as { version: number }).version;
}

const readOnly = ["hod", "faculty"] as const;

describe("unauthenticated and not-yet-activated requests", () => {
  it("rejects every data endpoint without a session", async () => {
    expect((await datasetRoute.GET(request("GET", "/api/dataset"), undefined)).status).toBe(401);
    expect((await exportRoute.GET(request("GET", "/api/dataset/export"), undefined)).status).toBe(401);
    expect((await usersRoute.GET(request("GET", "/api/users"), undefined)).status).toBe(401);
    expect((await meRoute.GET(request("GET", "/api/auth/me"), undefined)).status).toBe(401);
    expect((await datasetRoute.PUT(request("PUT", "/api/dataset", { body: { source: SAMPLE_SOURCE, config: SAMPLE_CONFIG } }), undefined)).status).toBe(401);
  });

  it("rejects a forged/unknown session cookie", async () => {
    const res = await datasetRoute.GET(request("GET", "/api/dataset", { cookie: "ic_session=forged-token-value" }), undefined);
    expect(res.status).toBe(401);
  });

  it("gives a first-login session access to nothing but the first-login steps", async () => {
    const res = await datasetRoute.GET(request("GET", "/api/dataset", { cookie: cookies.pending }), undefined);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe("first_login_required");
  });

  it("refuses the first-login endpoints to an already activated account", async () => {
    const res = await firstLoginSend.POST(request("POST", "/api/auth/first-login/send-otp", { cookie: cookies.faculty, body: { email: "f@gmail.com" } }), undefined);
    expect(res.status).toBe(400);
  });
});

describe("HOD and Faculty are read-only at the API", () => {
  it.each(readOnly)("%s can read the dataset and download exports", async (who) => {
    await publish();
    const get = await datasetRoute.GET(request("GET", "/api/dataset", { cookie: cookies[who] }), undefined);
    expect(get.status).toBe(200);
    const csv = await exportRoute.GET(request("GET", "/api/dataset/export?format=students", { cookie: cookies[who] }), undefined);
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-disposition")).toMatch(/attachment/);
    expect(await csv.text()).toContain("Alice");
  });

  it.each(readOnly)("%s cannot upload, reset, reconfigure, or edit/add/delete records", async (who) => {
    const version = await publish();
    const cookie = cookies[who];
    const attempts = [
      datasetRoute.PUT(request("PUT", "/api/dataset", { cookie, body: { source: SAMPLE_SOURCE, config: SAMPLE_CONFIG } }), undefined),
      datasetRoute.DELETE(request("DELETE", "/api/dataset", { cookie }), undefined),
      datasetConfigRoute.PUT(request("PUT", "/api/dataset/config", { cookie, body: { config: { ...SAMPLE_CONFIG, departmentOverrides: { CSE: "ECE" } } } }), undefined),
      datasetRowsRoute.POST(request("POST", "/api/dataset/rows", { cookie, body: { type: "update", sheetId: "s1", index: 0, values: { Score: 100 }, version } }), undefined),
      datasetRowsRoute.POST(request("POST", "/api/dataset/rows", { cookie, body: { type: "add", sheetId: "s1", values: { Name: "Mallory" }, version } }), undefined),
      datasetRowsRoute.POST(request("POST", "/api/dataset/rows", { cookie, body: { type: "delete", sheetId: "s1", index: 1, version } }), undefined),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(403);
      expect(((await res.json()) as { code: string }).code).toBe("forbidden");
    }
    // Nothing changed.
    const after = (await (await datasetRoute.GET(request("GET", "/api/dataset", { cookie }), undefined)).json()) as {
      dataset: { version: number; source: typeof SAMPLE_SOURCE };
    };
    expect(after.dataset.version).toBe(version);
    expect(after.dataset.source.sheets[0].rows).toEqual(SAMPLE_SOURCE.sheets[0].rows);
  });

  it.each(readOnly)("%s cannot list, create, or manage accounts", async (who) => {
    const cookie = cookies[who];
    expect((await usersRoute.GET(request("GET", "/api/users", { cookie }), undefined)).status).toBe(403);
    const create = await usersRoute.POST(
      request("POST", "/api/users", { cookie, body: { displayName: "Eve", email: "eve@gmail.com", role: "FACULTY", initialPassword: "Initial#123" } }),
      undefined
    );
    expect(create.status).toBe(403);
    const self = await userRoute.PATCH(request("PATCH", `/api/users/${ids[who]}`, { cookie, body: { role: "ADMINISTRATOR" } }), {
      params: Promise.resolve({ id: String(ids[who]) }),
    });
    expect(self.status).toBe(403);
    const role = (await db.one<{ role: string }>("SELECT role FROM users WHERE id = $1", [ids[who]]))!.role;
    expect(role).toBe(who === "hod" ? "HOD" : "FACULTY");
  });
});

describe("Administrator", () => {
  it("can add, correct, and delete records with version checks", async () => {
    let version = await publish();
    const edit = async (body: object) => datasetRowsRoute.POST(request("POST", "/api/dataset/rows", { cookie: cookies.admin, body: { ...body, version } }), undefined);

    let res = await edit({ type: "update", sheetId: "s1", index: 1, values: { Name: "Robert", Score: 61 } });
    expect(res.status).toBe(200);
    version = ((await res.json()) as { version: number }).version;
    res = await edit({ type: "add", sheetId: "s1", values: { Name: "Carol", Registration: "R003", Department: "CSE", Score: 88 } });
    version = ((await res.json()) as { version: number }).version;

    const stale = await datasetRowsRoute.POST(
      request("POST", "/api/dataset/rows", { cookie: cookies.admin, body: { type: "delete", sheetId: "s1", index: 0, version: version - 1 } }),
      undefined
    );
    expect(stale.status).toBe(409);

    const unknownColumn = await edit({ type: "update", sheetId: "s1", index: 0, values: { Password: "x" } });
    expect(unknownColumn.status).toBe(400);

    const data = (await (await datasetRoute.GET(request("GET", "/api/dataset", { cookie: cookies.faculty }), undefined)).json()) as {
      dataset: { source: typeof SAMPLE_SOURCE };
    };
    expect(data.dataset.source.sheets[0].rows.map((r) => [r.Name, r.Score])).toEqual([
      ["Alice", 78],
      ["Robert", 61],
      ["Carol", 88],
    ]);
  });

  it("can create HOD and Faculty accounts that must change password at first login", async () => {
    const res = await usersRoute.POST(
      request("POST", "/api/users", { cookie: cookies.admin, body: { displayName: "Dr. Priya", email: "Priya.HOD@gmail.com", role: "HOD", initialPassword: "Initial#123" } }),
      undefined
    );
    expect(res.status).toBe(201);
    const { user } = (await res.json()) as { user: { username: string; email: string; role: string; mustChangePassword: boolean; emailVerified: boolean } };
    expect(user).toMatchObject({ username: "priya.hod", email: "priya.hod@gmail.com", role: "HOD", mustChangePassword: true, emailVerified: false });
    expect(JSON.stringify(user)).not.toMatch(/password_hash|Initial#123/);
  });

  it("cannot create Administrator or Creator Admin accounts", async () => {
    for (const role of ["ADMINISTRATOR", "CREATOR_ADMIN"]) {
      const res = await usersRoute.POST(
        request("POST", "/api/users", { cookie: cookies.admin, body: { displayName: "X Y", email: `${role.toLowerCase()}@gmail.com`, role, initialPassword: "Initial#123" } }),
        undefined
      );
      expect(res.status).toBe(403);
    }
  });

  it("can deactivate and reactivate Faculty, which ends their sessions", async () => {
    const patch = (body: object) =>
      userRoute.PATCH(request("PATCH", `/api/users/${ids.faculty}`, { cookie: cookies.admin, body }), { params: Promise.resolve({ id: String(ids.faculty) }) });
    expect((await patch({ isActive: false })).status).toBe(200);
    expect((await datasetRoute.GET(request("GET", "/api/dataset", { cookie: cookies.faculty }), undefined)).status).toBe(401);
    expect((await patch({ isActive: true })).status).toBe(200);
  });

  it("cannot change their own role, deactivate themselves, or touch the Creator Admin", async () => {
    const self = await userRoute.PATCH(request("PATCH", `/api/users/${ids.admin}`, { cookie: cookies.admin, body: { role: "HOD" } }), {
      params: Promise.resolve({ id: String(ids.admin) }),
    });
    expect(self.status).toBe(403);
    const creator = await userRoute.PATCH(request("PATCH", `/api/users/${ids.creator}`, { cookie: cookies.admin, body: { isActive: false } }), {
      params: Promise.resolve({ id: String(ids.creator) }),
    });
    expect(creator.status).toBe(403);
  });
});

describe("Creator Admin", () => {
  it("can create an Administrator but cannot change their own role", async () => {
    const res = await usersRoute.POST(
      request("POST", "/api/users", { cookie: cookies.creator, body: { displayName: "Second Admin", email: "admin2@gmail.com", role: "ADMINISTRATOR", initialPassword: "Initial#123" } }),
      undefined
    );
    expect(res.status).toBe(201);
    const self = await userRoute.PATCH(request("PATCH", `/api/users/${ids.creator}`, { cookie: cookies.creator, body: { role: "FACULTY" } }), {
      params: Promise.resolve({ id: String(ids.creator) }),
    });
    expect(self.status).toBe(403);
  });
});

describe("CSRF and input validation", () => {
  it("rejects state-changing requests from another origin", async () => {
    const res = await datasetRoute.PUT(
      request("PUT", "/api/dataset", { cookie: cookies.admin, origin: "https://evil.example", body: { source: SAMPLE_SOURCE, config: SAMPLE_CONFIG } }),
      undefined
    );
    expect(res.status).toBe(403);
  });

  it("rejects malformed datasets", async () => {
    const res = await datasetRoute.PUT(
      request("PUT", "/api/dataset", { cookie: cookies.admin, body: { source: { ...SAMPLE_SOURCE, sheets: [] }, config: SAMPLE_CONFIG } }),
      undefined
    );
    expect(res.status).toBe(400);
  });
});
