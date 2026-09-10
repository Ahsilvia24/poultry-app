import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOWED_REGISTER_EMAILS, isRegisterEmailAllowed } from "../src/lib/allowedRegisterEmails.ts";
import { changePasswordSchema } from "../src/lib/validations/index.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

assert.ok(ALLOWED_REGISTER_EMAILS.includes("tech@poultry.local"));
assert.ok(ALLOWED_REGISTER_EMAILS.includes("alexsilvia24@yahoo.com"));
assert.ok(ALLOWED_REGISTER_EMAILS.includes("lanetyler2004@gmail.com"));
assert.ok(ALLOWED_REGISTER_EMAILS.includes("jeffreywalden@gmail.com"));
assert.equal(isRegisterEmailAllowed("tech@poultry.local"), true);
assert.equal(isRegisterEmailAllowed("AlexSilvia24@yahoo.com"), true);
assert.equal(isRegisterEmailAllowed("Lanetyler2004@gmail.com"), true);
assert.equal(isRegisterEmailAllowed("jeffreywalden@gmail.com"), true);
assert.equal(isRegisterEmailAllowed("jeffreywalden@ymail.com"), false);
assert.equal(isRegisterEmailAllowed("stranger@example.com"), false);

const auth = readFileSync(join(root, "src/app/actions/auth.ts"), "utf8");
assert.match(auth, /isRegisterEmailAllowed/);
assert.match(auth, /This email is not approved for an account/);
assert.match(auth, /changePasswordAction/);

const register = readFileSync(join(root, "src/app/(auth)/register/page.tsx"), "utf8");
assert.match(register, /Only approved emails can create an account/);

assert.equal(
  changePasswordSchema.safeParse({
    currentPassword: "password123",
    password: "newpassword",
    confirmPassword: "newpassword",
  }).success,
  true,
);
assert.equal(
  changePasswordSchema.safeParse({
    currentPassword: "password123",
    password: "newpassword",
    confirmPassword: "mismatch1",
  }).success,
  false,
);

const mobileSettings = readFileSync(join(root, "mobile/app/settings.tsx"), "utf8");
assert.match(mobileSettings, /Order Farms By:/);
assert.match(mobileSettings, /Email:/);
assert.match(mobileSettings, /Change password/);
assert.ok(
  mobileSettings.indexOf("Order Farms By:") < mobileSettings.indexOf("Email:"),
  "mobile email should sit below Order By",
);
assert.ok(
  mobileSettings.indexOf("Email:") < mobileSettings.indexOf("Change password"),
  "mobile change password should sit below email",
);

console.log("allowed-register: ok");
