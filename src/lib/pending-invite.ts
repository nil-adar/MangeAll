/**
 * An invite link (/shopping?invite=…) kept on the device until it's answered.
 *
 * ?redirect carries the link through a plain sign-in, but not every path does:
 * a new user signs up, confirms by email and comes back via ?verified=1 with
 * no redirect, and a stale session can mount /shopping (which tidies the
 * address bar) a moment before it signs out. So the link is also stored here,
 * picked up after sign-in (login.tsx) and cleared once the invitee answers.
 */
const PENDING_INVITE_KEY = "nahel-hakol:pending-invite";

export function rememberInvite(path: string | undefined) {
  if (!path?.includes("invite=")) return;
  try {
    localStorage.setItem(PENDING_INVITE_KEY, path);
  } catch {
    /* storage blocked — the link still works if opened again */
  }
}

/** The saved invite path, once: reading it clears it. */
export function takePendingInvite(): string | undefined {
  try {
    const path = localStorage.getItem(PENDING_INVITE_KEY) ?? undefined;
    localStorage.removeItem(PENDING_INVITE_KEY);
    return path;
  } catch {
    return undefined;
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    /* storage blocked — nothing was stored either */
  }
}
