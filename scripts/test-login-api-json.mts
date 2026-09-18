import assert from "node:assert/strict";
import { POST as loginPost } from "../src/app/api/login/route";
import { POST as registerPost } from "../src/app/api/register/route";

async function main() {
  const badLogin = await loginPost(new Request("http://localhost/api/login", { method: "POST", body: "nope" }));
  assert.equal(badLogin.status, 400);
  assert.deepEqual(await badLogin.json(), { error: "Invalid email or password" });

  const emptyLogin = await loginPost(
    new Request("http://localhost/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "", password: "" }),
    }),
  );
  assert.equal(emptyLogin.status, 400);
  assert.deepEqual(await emptyLogin.json(), { error: "Invalid email or password" });

  const badRegister = await registerPost(new Request("http://localhost/api/register", { method: "POST", body: "nope" }));
  assert.equal(badRegister.status, 400);
  assert.deepEqual(await badRegister.json(), { error: "Invalid input" });

  const formLogin = await loginPost(
    new Request("http://localhost/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "email=&password=",
    }),
  );
  assert.equal(formLogin.status, 303);
  assert.equal(new URL(formLogin.headers.get("location") ?? "", "http://localhost").pathname, "/login");

  console.log("login-api-json: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
