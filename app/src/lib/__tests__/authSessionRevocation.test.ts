import test from "node:test";
import assert from "node:assert/strict";
import { createToken, verifyToken, TokenPayload } from "../auth";

test("Token creation and verification preserves tokenVersion", async () => {
  const payload: TokenPayload = {
    userId: 999,
    role: "NHAN_SU_HYBRID",
    fullName: "Test User",
    tokenVersion: 1,
  };

  const token = await createToken(payload, false);
  assert.ok(token, "Token should be created");

  const verified = await verifyToken(token);
  assert.ok(verified, "Token should be verified");
  assert.equal(verified?.userId, 999);
  assert.equal(verified?.tokenVersion, 1);
});

test("Session revocation logic on password change", async () => {
  // Device A and Device B both have tokenVersion: 1
  const tokenDevA = await createToken({ userId: 1, role: "ADMIN", fullName: "User", tokenVersion: 1 });
  const tokenDevB = await createToken({ userId: 1, role: "ADMIN", fullName: "User", tokenVersion: 1 });

  const sessionDevA = await verifyToken(tokenDevA);
  const sessionDevB = await verifyToken(tokenDevB);

  // Device A changes password -> DB increments tokenVersion to 2
  let dbUserTokenVersion = 2;

  // Device A gets new token with tokenVersion: 2
  const newDevAToken = await createToken({ userId: 1, role: "ADMIN", fullName: "User", tokenVersion: dbUserTokenVersion });
  const verifiedNewDevA = await verifyToken(newDevAToken);

  // Check Device A: tokenVersion (2) === dbUserTokenVersion (2) -> VALID
  const isDevARevoked = verifiedNewDevA?.tokenVersion !== dbUserTokenVersion;
  assert.equal(isDevARevoked, false, "Device A with new token should be valid");

  // Check Device B: tokenVersion (1) !== dbUserTokenVersion (2) -> REVOKED!
  const isDevBRevoked =
    (sessionDevB?.tokenVersion !== undefined && sessionDevB?.tokenVersion !== dbUserTokenVersion) ||
    (sessionDevB?.tokenVersion === undefined && dbUserTokenVersion > 1);

  assert.equal(isDevBRevoked, true, "Device B with old token MUST be revoked");
});

