import Alpine from "alpinejs";

// ── THE SIDE MENU SWITCH ─────────────────────────────────────────────────────
// One panel, two triggers. The header owns the desktop trigger and the mobile
// top bar owns the phone one; the layout renders the panel once and both
// triggers flip this store. Giving each trigger its own copy would put two
// `aria-modal` dialogs in every document, one of them hidden only by CSS.
Alpine.store("menu", {
    open: false,

    /** Remembered so focus can go back where it came from on close. */
    opener: null,

    show() {
        this.opener = document.activeElement;
        this.open = true;
        // The page behind must not scroll under the panel — on a phone that
        // reads as the panel itself scrolling to nowhere.
        document.body.style.overflow = "hidden";
    },

    hide() {
        this.open = false;
        document.body.style.overflow = "";
        // Without this the keyboard lands at the top of the document with no
        // idea what just happened.
        this.opener?.focus?.();
        this.opener = null;
    },
});

// ── SIGN-IN ──────────────────────────────────────────────────────────────────
// Drives the Firebase SDK in the browser and posts the resulting ID token to
// /auth/session, which is the only thing the server ever sees of this. The SDK
// itself is loaded by the sign-in page, not here: it is large, and no other
// page needs it.
Alpine.data("signIn", (next) => ({
    busy: false,
    error: "",
    phone: "",
    code: "",
    codeSent: false,
    confirmation: null,

    /** Resolves once the page's module script has published the SDK. */
    async firebase() {
        if (window.taajirFirebase) return window.taajirFirebase;
        await new Promise((resolve) =>
            window.addEventListener("taajir:firebase-ready", resolve, { once: true }),
        );
        return window.taajirFirebase;
    },

    async withGoogle() {
        const { auth, GoogleAuthProvider, signInWithPopup } = await this.firebase();
        await this.run(async () => {
            const result = await signInWithPopup(auth, new GoogleAuthProvider());
            await this.exchange(await result.user.getIdToken());
        });
    },

    async sendCode() {
        const fb = await this.firebase();
        await this.run(async () => {
            // Built on demand rather than at load: the widget attaches itself to
            // the DOM node, and a verifier created for a page the visitor never
            // used is a reCAPTCHA challenge nobody asked for.
            this.verifier ??= new fb.RecaptchaVerifier(fb.auth, "recaptcha", {
                size: "invisible",
            });
            this.confirmation = await fb.signInWithPhoneNumber(
                fb.auth,
                this.phone.trim(),
                this.verifier,
            );
            this.codeSent = true;
        });
    },

    async confirmCode() {
        await this.run(async () => {
            const result = await this.confirmation.confirm(this.code.trim());
            await this.exchange(await result.user.getIdToken());
        });
    },

    /**
     * Hand the token to the server and go where we were headed.
     *
     * The server decides what the token is worth — the provider gate, the ban
     * check and the account row all live there. This only reports what it said.
     */
    async exchange(idToken) {
        const response = await fetch("/auth/session", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "X-CSRF-TOKEN": document.querySelector('meta[name="csrf-token"]')?.content ?? "",
            },
            body: JSON.stringify({ idToken }),
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const refused = new Error(this.messageFor(response.status, body.code));
            // Marked as ours so run() knows this message is already translated
            // and meant to be read, unlike the SDK's English internals.
            refused.taajir = true;
            throw refused;
        }

        window.location.assign(next);
    },

    messageFor(status, code) {
        if (code === "password-disabled") return window.taajirMessages.passwordDisabled;
        if (code === "phone-disabled") return window.taajirMessages.phoneDisabled;
        if (code === "email-claimed") return window.taajirMessages.emailClaimed;
        if (code === "account-banned") return window.taajirMessages.banned;
        if (status === 429) return window.taajirMessages.tooMany;
        return window.taajirMessages.failed;
    },

    /** One place that owns `busy` and `error`, so no branch can leave either stuck. */
    async run(work) {
        if (this.busy) return;
        this.busy = true;
        this.error = "";
        try {
            await work();
        } catch (e) {
            // A popup the visitor closed themselves is not an error to shout
            // about. Our own refusals carry a translated message; everything
            // else falls back to the generic one, because the SDK's text is
            // English and often names internals.
            if (e?.code === "auth/popup-closed-by-user" || e?.code === "auth/cancelled-popup-request") {
                this.error = "";
            } else {
                this.error = e?.taajir ? e.message : window.taajirMessages.failed;
            }
        } finally {
            this.busy = false;
        }
    },
}));

// ── THE FOLLOW BUTTON ────────────────────────────────────────────────────────
// Posts rather than navigates: following is a decision about the next ad, not a
// reason to lose your place on the page you are reading. The count updates from
// the server's answer, not by adding one locally — two tabs, or a stale page,
// would otherwise drift apart and never come back.
Alpine.data("followButton", (publicId, initial, count, signedIn) => ({
    following: initial,
    followers: count,
    busy: false,
    error: "",

    async toggle() {
        // A signed-out visitor gets sent to sign in, not a failed request:
        // the route is behind auth and would answer 401 with nothing useful.
        if (!signedIn) {
            window.location.href = `/connexion?next=${encodeURIComponent(window.location.pathname)}`;
            return;
        }

        this.busy = true;
        this.error = "";

        try {
            const response = await fetch(`/vendeur/${encodeURIComponent(publicId)}/suivre`, {
                method: this.following ? "DELETE" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": document.querySelector('meta[name="csrf-token"]')?.content ?? "",
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(String(response.status));
            }

            const body = await response.json();
            this.following = body.following;
            this.followers = body.followers;
        } catch {
            this.error = window.taajirMessages.failed;
        } finally {
            this.busy = false;
        }
    },
}));

// ── THE PUBLISH WIZARD ───────────────────────────────────────────────────────
// The steps are a presentation of one form: nothing between them needs the
// server, so the whole thing posts once. What does need the server is the
// commune list, which is fetched per wilaya rather than embedded — all 1541 of
// them is a quarter of a megabyte nobody on a phone should download to pick one.
Alpine.data("publishWizard", () => ({
    step: 1,
    total: 4,
    wilaya: "",
    commune: "",
    communes: [],
    price: "",
    priceOnRequest: false,
    photoCount: 0,

    async loadCommunes() {
        this.communes = [];
        this.commune = "";
        if (!this.wilaya) return;

        const response = await fetch(`/api/communes/${encodeURIComponent(this.wilaya)}`, {
            headers: { Accept: "application/json" },
        });
        if (response.ok) this.communes = await response.json();
    },

    /**
     * What the typed dinars are in the unit the market speaks.
     *
     * Shown, never submitted. The input is dinars and the column is dinars; an
     * input that accepted ملايين is the 10 000x error waiting to happen.
     */
    get millions() {
        const dinars = Number(this.price);
        if (!dinars) return "";
        const m = dinars / 10000;
        return m >= 1 ? `${m >= 10 ? Math.round(m) : Math.round(m * 10) / 10} مليون` : "";
    },

    countPhotos(event) {
        this.photoCount = event.target.files?.length ?? 0;
    },
}));

window.Alpine = Alpine;
Alpine.start();
