// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  handleGetProfile,
  handleUpdateProfile,
  handleLogin,
} from "../handlers.js";
import { hashPassword } from "../password.js";
import {
  handleFriendsList,
  handleUserSearch,
  handleFriendRequestsList,
} from "../friends.js";
import { signToken } from "../jwt.js";

describe("profile persistence and friend identity", () => {
  let db, env, token;
  const request = (path, method = "GET", body, auth = true) =>
    new Request(`https://zhaxiaoji.com${path}`, {
      method,
      headers: {
        ...(auth ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  beforeEach(async () => {
    db = new DatabaseSync(":memory:");
    db.exec(
      readFileSync(new URL("../../../schema.sql", import.meta.url), "utf8"),
    );
    // Migration is safe to run on an initialized schema and repeatedly.
    db.exec(
      readFileSync(
        new URL("../../../migrations/013_user_profiles.sql", import.meta.url),
        "utf8",
      ),
    );
    db.exec(
      readFileSync(
        new URL("../../../migrations/004_friendships.sql", import.meta.url),
        "utf8",
      ),
    );
    db.exec(
      "INSERT INTO users (id,username,email,password_hash) VALUES (1,'alice','alice@example.test','test'), (2,'bob','bob@example.test','test'); INSERT INTO friendships (user_a,user_b,created_at) VALUES (1,2,1)",
    );
    env = {
      JWT_SECRET: "local-test-only-key",
      DB: {
        prepare(sql) {
          const statement = db.prepare(sql);
          let args = [];
          const wrapped = {
            bind(...values) {
              args = values;
              return wrapped;
            },
            async first() {
              return statement.get(...args) || null;
            },
            async all() {
              return { results: statement.all(...args) };
            },
            async run() {
              return statement.run(...args);
            },
          };
          return wrapped;
        },
      },
    };
    token = await signToken({ sub: 1, username: "alice" }, env.JWT_SECRET);
  });
  afterEach(() => db.close());
  it("saves and reloads Chinese display name, signature, link and avatar", async () => {
    const fields = {
      displayName: "小纪",
      bio: "保持好奇",
      location: "伦敦",
      website: "https://example.com",
      avatarColor: "sage",
    };
    const saved = await handleUpdateProfile(
      request("/api/user/profile", "PUT", fields),
      env,
    );
    expect(saved.status).toBe(200);
    const fresh = await (
      await handleGetProfile(request("/api/user/profile"), env)
    ).json();
    expect(fresh.user).toMatchObject(fields);
    expect(fresh.user.username).toBe("alice");
    await handleUpdateProfile(
      request("/api/user/profile", "PUT", { bio: "" }),
      env,
    );
    const cleared = await (
      await handleGetProfile(request("/api/user/profile"), env)
    ).json();
    expect(cleared.user.bio).toBe("");
    expect(cleared.user.displayName).toBe("小纪");
  });
  it("rejects invalid links before changing persisted data and requires authentication", async () => {
    expect(
      (
        await handleUpdateProfile(
          request("/api/user/profile", "PUT", {
            website: "javascript:alert(1)",
          }),
          env,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handleUpdateProfile(
          request("/api/user/profile", "PUT", { bio: "test" }, false),
          env,
        )
      ).status,
    ).toBe(401);
    expect(db.prepare("SELECT COUNT(*) AS n FROM user_profiles").get().n).toBe(
      0,
    );
  });
  it("returns saved profile details immediately after signing back in", async () => {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = 1").run(
      await hashPassword("LocalTest2026!"),
    );
    await handleUpdateProfile(
      request("/api/user/profile", "PUT", {
        displayName: "新的昵称",
        bio: "新的签名",
      }),
      env,
    );
    const login = await (
      await handleLogin(
        request(
          "/api/auth/login",
          "POST",
          { email: "alice@example.test", password: "LocalTest2026!" },
          false,
        ),
        env,
      )
    ).json();
    expect(login.success).toBe(true);
    expect(login.user).toMatchObject({
      displayName: "新的昵称",
      bio: "新的签名",
    });
  });
  it("shows saved names and signatures in friend lists and searches without leaking email", async () => {
    db.exec(
      "INSERT INTO user_profiles (user_id,display_name,bio,avatar_color) VALUES (2,'新朋友','一起玩吧','slate')",
    );
    const friends = await (
      await handleFriendsList(request("/api/friends"), env)
    ).json();
    expect(friends.friends[0]).toMatchObject({
      username: "bob",
      displayName: "新朋友",
      bio: "一起玩吧",
      avatarColor: "slate",
    });
    const search = await (
      await handleUserSearch(request("/api/users/search?q=新朋友"), env)
    ).json();
    expect(search.results[0].displayName).toBe("新朋友");
    expect(JSON.stringify(search)).not.toContain("bob@example.test");
    db.exec(
      "INSERT INTO friend_requests (from_user,to_user,status,created_at) VALUES (2,1,'pending',1)",
    );
    const requests = await (
      await handleFriendRequestsList(request("/api/friends/requests"), env)
    ).json();
    expect(requests.requests[0]).toMatchObject({
      fromDisplayName: "新朋友",
      avatarColor: "slate",
    });
  });
});
