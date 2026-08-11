import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

describe("api foundation", () => {
  const app = createApp();

  it("starts and responds to health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("rejects protected route without token", async () => {
    const res = await request(app).get("/api/v1/protected/ping");
    expect([401, 503]).toContain(res.status);
  });

  it("validates login payload", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "bad", password: "x" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/api/v1/this-route-does-not-exist");
    expect(res.status).toBe(404);
  });
});
