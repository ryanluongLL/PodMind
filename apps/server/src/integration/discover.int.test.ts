import { describe, it, expect } from "vitest"
import request from "supertest"
import { app } from "../app.js"

/// Only the request checks here: real feeds are never fetched in tests.
/// The preview rules themselves are covered by feedPreview unit tests.
describe("POST /discover/preview", () => {
  it("rejects a missing or empty list", async () => {
    expect((await request(app).post("/discover/preview").send({})).status).toBe(400)
    expect((await request(app).post("/discover/preview").send({ podcasts: [] })).status).toBe(400)
    expect((await request(app).post("/discover/preview").send({ podcasts: "nope" })).status).toBe(400)
  })

  it("returns null for private or invalid addresses without fetching them", async () => {
    const res = await request(app)
      .post("/discover/preview")
      .send({
        podcasts: [
          { feedUrl: "http://localhost:3001/health", genre: "News" },
          { feedUrl: "http://169.254.169.254/latest/meta-data", genre: "News" },
          { feedUrl: "not a url" },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.previews).toEqual({
      "http://localhost:3001/health": null,
      "http://169.254.169.254/latest/meta-data": null,
      "not a url": null,
    })
  })
})