import assert from "node:assert/strict"
import test from "node:test"
import { hashPassword, verifyPassword } from "../src/services/authService.js"

test("hashPassword and verifyPassword roundtrip", () => {
  const hashed = hashPassword("StrongPassword123!")
  assert.equal(hashed.startsWith("scrypt$"), true)
  assert.equal(verifyPassword("StrongPassword123!", hashed), true)
  assert.equal(verifyPassword("wrong-password", hashed), false)
})
