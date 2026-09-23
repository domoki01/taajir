// ── THE FUNNEL OPENS A FORM, NOT A SIGN-UP SCREEN ────────────────────────────
// /bienvenue asks "واش تحبّ دير؟" and used to answer every button with a
// registration screen: the two demand intents because the page behind them
// called requireUser(), and all four because IntentPicker routed a signed-out
// visitor through /inscription. A stranger was being asked to register before
// being told what for — and while phone sign-up is switched off, on a screen
// with fewer ways in than it looks like it has.
//
// Both actions were already written for this: createRequest() answered a
// signed-out caller with `needsAuth` rather than a redirect so the account
// could be asked for at the end. This pins the doors open, because the guard
// that closes one of them again is a single line in a page nobody is looking at.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const kFiles = {
  picker: "src/components/launch/IntentPicker.tsx",
  newRequest: "src/app/demandes/nouvelle/page.tsx",
  publish: "src/app/publier/page.tsx",
  listingAction: "src/server/actions/listings.ts",
  requestAction: "src/server/actions/requests.ts",
  postForm: "src/components/listing/PostForm.tsx",
  wizard: "src/components/requests/RequestWizard.tsx",
} as const;

/** Comments explain guards; only code is one. */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

describe("the four funnel buttons", () => {
  it("send everybody to the form, signed in or not", () => {
    const picker = code(kFiles.picker);
    expect(picker).toContain("href={funnelHref(intent)}");
    expect(picker).not.toContain("funnelSignupHref");
  });
});

describe("the two forms behind them", () => {
  it("open for a signed-out visitor", () => {
    // requireUser() redirects. On these two pages that is the sign-up screen
    // the funnel exists to avoid.
    expect(code(kFiles.newRequest)).not.toContain("requireUser");
    expect(code(kFiles.publish)).not.toContain("requireUser");
  });

  it("are answered with needsAuth, not a redirect, when nobody is signed in", () => {
    for (const file of [kFiles.listingAction, kFiles.requestAction]) {
      expect(code(file)).toContain("needsAuth: true");
    }
    // The listing action is the one that used to redirect out of a nine-screen
    // form and throw away every answer in it.
    expect(code(kFiles.listingAction)).not.toContain('requireUser("/publier")');
  });

  it("offer a way in once the answers are typed", () => {
    // The signal is useless unless the form does something visible with it —
    // and the two doors, not one: somebody arriving from /bienvenue has no
    // account yet, so "سجّل الدخول" alone is the wrong half.
    for (const file of [kFiles.postForm, kFiles.wizard]) {
      const form = code(file);
      expect(form).toContain("setNeedsAuth(");
      expect(form).toContain("{needsAuth && (");
      expect(form).toContain("/inscription?next=");
      expect(form).toContain("/connexion?next=");
    }
  });

  it("carry the answer back through sign-up", () => {
    // Otherwise the funnel asks "واش تحبّ دير؟" twice — once before the account
    // and once after it.
    expect(code(kFiles.postForm)).toContain("returnPath");
    expect(code(kFiles.wizard)).toContain("returnPath");
  });
});
