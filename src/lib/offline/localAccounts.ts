import bcrypt from "bcryptjs";
import { idbRead, idbWrite } from "@/lib/offline/idb";
import { isOwnerEmail, normalizeOwnerEmail } from "@/lib/offline/ownerEmail";

export type LocalAccount = {
  email: string;
  passwordHash: string;
  userId: string;
  name: string;
};

const ACCOUNTS_KEY = "local-accounts";

async function loadAccounts(): Promise<Record<string, LocalAccount>> {
  try {
    return (await idbRead<Record<string, LocalAccount>>(ACCOUNTS_KEY)) ?? {};
  } catch {
    return {};
  }
}

async function saveAccounts(accounts: Record<string, LocalAccount>) {
  await idbWrite(ACCOUNTS_KEY, accounts);
}

export async function getLocalAccount(email: string) {
  const accounts = await loadAccounts();
  return accounts[normalizeOwnerEmail(email)] ?? null;
}

export async function upsertLocalAccount(input: {
  email: string;
  password: string;
  userId?: string;
  name?: string;
}): Promise<LocalAccount> {
  const email = normalizeOwnerEmail(input.email);
  if (!isOwnerEmail(email)) throw new Error("Use the email for this account.");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");
  const accounts = await loadAccounts();
  const existing = accounts[email];
  const account: LocalAccount = {
    email,
    passwordHash: await bcrypt.hash(input.password, 12),
    userId: input.userId || existing?.userId || crypto.randomUUID(),
    name: (input.name || existing?.name || email.split("@")[0] || "Tech").trim(),
  };
  accounts[email] = account;
  await saveAccounts(accounts);
  return account;
}

export async function verifyLocalAccount(email: string, password: string) {
  const account = await getLocalAccount(email);
  if (!account) return null;
  const valid = await bcrypt.compare(password, account.passwordHash);
  return valid ? account : null;
}

export async function updateLocalPassword(email: string, currentPassword: string, nextPassword: string) {
  const account = await verifyLocalAccount(email, currentPassword);
  if (!account) throw new Error("Current password is wrong.");
  return upsertLocalAccount({
    email: account.email,
    password: nextPassword,
    userId: account.userId,
    name: account.name,
  });
}
