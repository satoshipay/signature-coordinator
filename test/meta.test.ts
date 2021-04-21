import test from "ava"
import request from "supertest"
import { withApp } from "./_helpers/bootstrap"

test("index route returns capabilities", t =>
  withApp(async ({ server }) => {
    const response = await request(server).get("/")

    t.true(Array.isArray(response.body.capabilities))
    t.true(response.body.capabilities.includes("transactions"))
  }))
