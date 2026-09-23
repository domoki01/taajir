import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
            // Self-hosted at build time, which is what next/font did on the other
            // side. No runtime request to Google, and no build-time curl of a
            // .ttf — the sibling repo fetched fonts that way and silently wrote
            // an HTML error page as a font file when the URL moved.
            fonts: [
                bunny('Cairo', {
                    weights: [400, 600, 700, 800, 900],
                    subsets: ['arabic', 'latin'],
                    // Five weights across two subsets is ten woff2 files, and the
                    // plugin preloads all of them by default — 150 kB of <link
                    // rel=preload> on every page, competing with the page itself
                    // on the 3G connections most of this audience is on. Only the
                    // two weights that are on screen before anything is scrolled
                    // are worth that: body text and the headings. The rest arrive
                    // through the stylesheet with display:swap, as they did under
                    // next/font.
                    preload: [{ weight: 400 }, { weight: 800 }],
                }),
            ],
        }),
        tailwindcss(),
    ],
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
