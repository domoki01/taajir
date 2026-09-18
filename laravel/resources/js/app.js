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

window.Alpine = Alpine;
Alpine.start();
