/**
 * Two one-shot signals between a moment and the dialog that answers it.
 *
 * Both live in the browser rather than in a document because they are about
 * *this* browser: whether this device has been offered the install, and whether
 * the person at this keyboard has just finished signing up. A server has no
 * opinion on either, and reading one would make every page dynamic.
 */

const kInstallSnoozed = "taajir.install.dismissed";
const kJustSignedUp = "taajir.justSignedUp";

/** A month. Long enough not to nag, short enough to catch a change of mind. */
export const kInstallSnooze = 30 * 24 * 60 * 60 * 1000;

export function installSnoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(kInstallSnoozed) ?? 0);
    return at > 0 && Date.now() - at < kInstallSnooze;
  } catch {
    // Private browsing with storage denied. Showing the dialog once per page is
    // better than crashing on the read; the site does not depend on either.
    return false;
  }
}

export function snoozeInstall() {
  try {
    localStorage.setItem(kInstallSnoozed, String(Date.now()));
  } catch {}
}

/**
 * Marked when an account is created, read once on the next screen.
 *
 * sessionStorage, not local: the prompt belongs to the sign-up that just
 * happened, and a flag that outlived the tab would ambush someone days later
 * with a dialog about a thing they had long since done.
 */
export function markJustSignedUp() {
  try {
    sessionStorage.setItem(kJustSignedUp, "1");
  } catch {}
}

const kDialogClaimed = "taajir.firstRunDialog";

/**
 * One first-run dialog per visit, whichever gets there first.
 *
 * Peeking at the sign-up flag was not enough: the notification dialog consumes
 * that flag when it opens, so by the time the install dialog looked, nothing
 * was left to see and both ended up on screen. A claim outlives the flag.
 */
export function claimFirstRunDialog(): boolean {
  try {
    if (sessionStorage.getItem(kDialogClaimed) === "1") return false;
    sessionStorage.setItem(kDialogClaimed, "1");
    return true;
  } catch {
    return true;
  }
}

/** Peek without consuming — the install dialog uses it to stand down. */
export function justSignedUpPending(): boolean {
  try {
    return sessionStorage.getItem(kJustSignedUp) === "1";
  } catch {
    return false;
  }
}

export function takeJustSignedUp(): boolean {
  try {
    const had = sessionStorage.getItem(kJustSignedUp) === "1";
    if (had) sessionStorage.removeItem(kJustSignedUp);
    return had;
  } catch {
    return false;
  }
}
