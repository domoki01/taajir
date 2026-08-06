"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Promo } from "@/types/promo";

/**
 * The advertising strip under the search filter.
 *
 * Built on scroll-snap rather than a translated track. A carousel that animates
 * `transform: translateX(...)` has to know which way is forward, and this site
 * is RTL — the sign of that offset is the classic place an RTL carousel breaks,
 * and browsers still disagree about the sign of `scrollLeft` in RTL. Native
 * scrolling sidesteps the whole question: the browser already knows the
 * direction, swipe and keyboard work for free, and `scrollIntoView` needs no
 * arithmetic at all.
 */
export function PromoCarousel({ promos }: { promos: Promo[] }) {
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((i: number) => {
    const slide = track.current?.children[i] as HTMLElement | undefined;
    // `block: "nearest"` keeps this from scrolling the page vertically to bring
    // the strip into view — the visitor did not ask to be moved.
    slide?.scrollIntoView({
      behavior: "smooth",
      inline: "start",
      block: "nearest",
    });
  }, []);

  // The active dot follows the scroll position rather than being set by the
  // click, so a swipe updates it too.
  useEffect(() => {
    const node = track.current;
    if (!node || promos.length < 2) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIndex(Array.from(node.children).indexOf(entry.target));
          }
        }
      },
      { root: node, threshold: 0.6 },
    );
    for (const child of node.children) observer.observe(child);
    return () => observer.disconnect();
  }, [promos.length]);

  // Auto-advance, unless the visitor is interacting or has asked the system for
  // less motion — an animation nobody can stop is worse than a static banner.
  useEffect(() => {
    if (promos.length < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => goTo((index + 1) % promos.length), 6000);
    return () => clearInterval(timer);
  }, [index, paused, promos.length, goTo]);

  if (promos.length === 0) return null;

  const arrow =
    "hidden md:grid absolute top-1/2 z-10 size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-soft transition-opacity hover:opacity-100 opacity-80";

  return (
    <section
      aria-label="إشهارات"
      aria-roledescription="carousel"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <ul
        ref={track}
        className="rounded-card shadow-soft flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden"
      >
        {promos.map((promo, i) => {
          const external = /^https?:/.test(promo.linkUrl);
          return (
            <li key={promo.id} className="w-full shrink-0 snap-start">
              <a
                href={promo.linkUrl}
                // These are sold placements. rel="sponsored" is what Google
                // asks for on paid links; without it the site is passing on
                // ranking signal it was paid to pass on, which is the kind of
                // thing that gets a young domain penalised.
                rel={external ? "sponsored noopener noreferrer" : "sponsored"}
                target={external ? "_blank" : undefined}
                className="relative block aspect-[2/1] w-full overflow-hidden md:aspect-[16/5]"
              >
                <Image
                  src={promo.imageUrl}
                  alt={promo.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 1120px"
                  // Only the first slide is above the fold; the rest would
                  // compete with the listings for bandwidth.
                  priority={i === 0}
                  className="object-cover"
                />
              </a>
            </li>
          );
        })}
      </ul>

      {promos.length > 1 && (
        <>
          {/* start = right in RTL, so this is the one that goes back. */}
          <button
            type="button"
            aria-label="الإشهار السابق"
            onClick={() => goTo((index - 1 + promos.length) % promos.length)}
            className={`${arrow} start-2`}
          >
            <ChevronRight className="size-5" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            aria-label="الإشهار التالي"
            onClick={() => goTo((index + 1) % promos.length)}
            className={`${arrow} end-2`}
          >
            <ChevronLeft className="size-5" strokeWidth={2.5} />
          </button>

          <div className="mt-3 flex justify-center gap-2">
            {promos.map((promo, i) => (
              <button
                key={promo.id}
                type="button"
                aria-label={`الإشهار ${i + 1}`}
                aria-current={i === index}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "bg-primary w-6" : "bg-border w-2"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
