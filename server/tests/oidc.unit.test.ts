import assert from "node:assert/strict"
import test from "node:test"
import { createOidcService } from "../src/services/oidcService.js"

test("oidc service: buildSafeReturnToUrl blocks open redirects", () => {
  const service = createOidcService({
    config: {
      authMode: "oidc",
      nodeEnv: "test",
      jwtSecret: "test-jwt-secret-please-change-1234567890",
      frontendOrigin: "http://localhost:5173",
      issuerUrl: "http://issuer.example",
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "http://localhost:4000/api/auth/oidc/callback"
    },
    getClient: async () => {
      return {
        authorizationUrl: () => "http://issuer.example/auth",
        callback: async () => ({ claims: () => ({ email: "user@example.com", name: "User" }) })
      }
    }
  })

  assert.equal(service.buildSafeReturnToUrl("/"), "http://localhost:5173/")
  assert.equal(service.buildSafeReturnToUrl("http://localhost:5173/app"), "http://localhost:5173/app")
  assert.equal(service.buildSafeReturnToUrl("https://evil.example/steal"), "http://localhost:5173")
  assert.equal(service.buildSafeReturnToUrl("not-a-url"), "http://localhost:5173")
})

test("oidc service: state cookie roundtrips and rejects tampering", () => {
  const service = createOidcService({
    config: {
      authMode: "oidc",
      nodeEnv: "test",
      jwtSecret: "test-jwt-secret-please-change-1234567890",
      frontendOrigin: "http://localhost:5173"
    }
  })

  const token = service.signOidcStateCookie({
    type: "oidc_state",
    state: "state_state_state_state",
    nonce: "nonce_nonce_nonce_nonce",
    codeVerifier: "verifier_verifier_verifier_verifier_verifier_1234",
    returnTo: "http://localhost:5173/"
  })

  const decoded = service.verifyOidcStateCookie(token)
  assert.equal(decoded.type, "oidc_state")
  assert.equal(decoded.state, "state_state_state_state")
  assert.equal(decoded.nonce, "nonce_nonce_nonce_nonce")

  assert.throws(() => service.verifyOidcStateCookie(`${token}tamper`))
})

test("oidc service: authorization redirect issues signed cookie and url", async () => {
  const service = createOidcService({
    config: {
      authMode: "oidc",
      nodeEnv: "test",
      jwtSecret: "test-jwt-secret-please-change-1234567890",
      frontendOrigin: "http://localhost:5173",
      issuerUrl: "http://issuer.example",
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "http://localhost:4000/api/auth/oidc/callback"
    },
    getClient: async () => {
      return {
        authorizationUrl: (params) => {
          const state = String(params.state)
          const nonce = String(params.nonce)
          assert.ok(state.length > 10)
          assert.ok(nonce.length > 10)
          assert.equal(params.code_challenge_method, "S256")
          return `http://issuer.example/authorize?state=${encodeURIComponent(state)}`
        },
        callback: async () => ({ claims: () => ({ email: "user@example.com", name: "User" }) })
      }
    }
  })

  const result = await service.buildOidcAuthorizationRedirect({
    returnTo: "/after-login",
    requestedOrgId: "org_default"
  })

  assert.ok(result.url.startsWith("http://issuer.example/authorize"))

  const state = service.verifyOidcStateCookie(result.cookie)
  assert.equal(state.type, "oidc_state")
  assert.equal(state.returnTo, "http://localhost:5173/after-login")
  assert.equal(state.requestedOrgId, "org_default")
})

test("oidc service: callback rejects missing cookie and state mismatch", async () => {
  const service = createOidcService({
    config: {
      authMode: "oidc",
      nodeEnv: "test",
      jwtSecret: "test-jwt-secret-please-change-1234567890",
      frontendOrigin: "http://localhost:5173",
      issuerUrl: "http://issuer.example",
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "http://localhost:4000/api/auth/oidc/callback"
    },
    getClient: async () => {
      return {
        authorizationUrl: () => "http://issuer.example/auth",
        callback: async () => ({ claims: () => ({ email: "user@example.com", name: "User" }) })
      }
    }
  })

  await assert.rejects(async () => {
    await service.redeemOidcCallback({
      code: "abc",
      state: "state",
      cookieHeader: undefined
    })
  }, /Missing or expired OIDC state/)

  const cookieToken = service.signOidcStateCookie({
    type: "oidc_state",
    state: "expected_state_123456",
    nonce: "nonce_nonce_nonce_nonce",
    codeVerifier: "verifier_verifier_verifier_verifier_verifier_1234",
    returnTo: "http://localhost:5173/"
  })

  await assert.rejects(async () => {
    await service.redeemOidcCallback({
      code: "abc",
      state: "wrong_state",
      cookieHeader: `rp_oidc=${encodeURIComponent(cookieToken)}`
    })
  }, /Invalid OIDC state/)
})

test("oidc service: callback returns profile and returnTo", async () => {
  const service = createOidcService({
    config: {
      authMode: "oidc",
      nodeEnv: "test",
      jwtSecret: "test-jwt-secret-please-change-1234567890",
      frontendOrigin: "http://localhost:5173",
      issuerUrl: "http://issuer.example",
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "http://localhost:4000/api/auth/oidc/callback"
    },
    getClient: async () => {
      return {
        authorizationUrl: () => "http://issuer.example/auth",
        callback: async (_redirect, params, checks) => {
          assert.equal(params.state, "expected_state_123456")
          assert.equal(checks.state, "expected_state_123456")
          assert.ok(String(checks.code_verifier).length > 10)
          return {
            claims: () => ({
              email: "oidc.user@example.com",
              name: "OIDC User"
            })
          }
        }
      }
    }
  })

  const cookieToken = service.signOidcStateCookie({
    type: "oidc_state",
    state: "expected_state_123456",
    nonce: "nonce_nonce_nonce_nonce",
    codeVerifier: "verifier_verifier_verifier_verifier_verifier_1234",
    returnTo: "http://localhost:5173/after"
  })

  const result = await service.redeemOidcCallback({
    code: "abc",
    state: "expected_state_123456",
    cookieHeader: `rp_oidc=${encodeURIComponent(cookieToken)}`
  })

  assert.equal(result.profile.email, "oidc.user@example.com")
  assert.equal(result.profile.name, "OIDC User")
  assert.equal(result.returnTo, "http://localhost:5173/after")
})
