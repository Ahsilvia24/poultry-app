import { signOutAction } from "@/app/actions/auth";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className={
          className ?? "text-sm font-semibold text-stone-700 underline"
        }
      >
        Sign out
      </button>
    </form>
  );
}
