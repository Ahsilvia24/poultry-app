import assert from "node:assert/strict";
import { createResetToken, hashResetToken } from "../src/lib/password-reset-token.ts";
import { forgotPasswordSchema, resetPasswordSchema } from "../src/lib/validations/index.ts";

const token = createResetToken();
assert.ok(token.length >= 32);
assert.equal(hashResetToken(token), hashResetToken(token));
assert.notEqual(hashResetToken(token), hashResetToken(token + "x"));

assert.equal(forgotPasswordSchema.safeParse({ email: "tech@farm.example" }).success, true);
assert.equal(forgotPasswordSchema.safeParse({ email: "nope" }).success, false);
assert.equal(resetPasswordSchema.safeParse({ token, password: "longenough" }).success, true);
assert.equal(resetPasswordSchema.safeParse({ token: "short", password: "longenough" }).success, false);

console.log("password-reset: ok");
