import { registerSchema } from "../src/lib/validations/index.ts";

const ok = registerSchema.safeParse({
  name: "Pat Tech",
  email: "pat@farm.example",
  password: "longenough",
});
if (!ok.success) {
  console.error(ok.error);
  process.exit(1);
}

const short = registerSchema.safeParse({
  name: "Pat Tech",
  email: "pat@farm.example",
  password: "short",
});
if (short.success) {
  console.error("expected short password to fail");
  process.exit(1);
}

console.log("register schema ok");
