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
  // And a sign-up outranks whatever took the visit's dialog slot before it.
  // Somebody who spends more than a couple of seconds on the sign-up form has
  // already been offered the install by then, which used to spend the claim —
  // so the two dialogs that belong to *this* moment, the notification ask and
  // the contest invitation, found the slot taken and neither ever appeared.
  releaseFirstRunDialog();
}

const kDialogClaimed = "taajir.firstRunDialog";

/** Fired when a claim is handed back, so a stood-down dialog can try again. */
export const kFirstRunReleased = "taajir:first-run-released";

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

/**
 * Hand the claim back.
 *
 * The contest dialog has to claim before it knows whether it has anything to
 * show — deciding needs a round trip, and a dialog that asked the server first
 * would lose the claim to the notification prompt while it waited. So it claims,
 * asks, and releases when the answer is "no campaign", which lets the next
 * dialog in the queue take its turn instead of the visit ending with none.
 *
 * A sign-up releases it too, for the same reason from the other direction: the
 * claim is there to stop two dialogs sharing a screen, not to let a dialog
 * shown five minutes ago silence the one that belongs to what just happened.
 */
export function releaseFirstRunDialog() {
  try {
    sessionStorage.removeItem(kDialogClaimed);
  } catch {}
  // The dialogs that lost the claim have already run their timers by now, and a
  // timer does not fire twice. Without this they would all have stood down for
  // a dialog that then decided it had nothing to say — or for one shown long
  // before the moment worth interrupting — and the visit would end with no
  // dialog at all. Listeners re-arm their delay rather than opening on the
  // event, so a release during a navigation cannot flash a dialog onto a page
  // that is already leaving.
  try {
    window.dispatchEvent(new Event(kFirstRunReleased));
  } catch {}
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
