import { lazy, Suspense, useEffect, useState } from "react";

// Keep in sync with src/remotion/LogoReveal.tsx's exported constants.
// Hardcoded (rather than statically imported) so this file doesn't pull the
// Remotion runtime into the main bundle before it's actually needed.
const LOGO_REVEAL_DURATION = 135;
const LOGO_REVEAL_FPS = 30;
const LOGO_REVEAL_WIDTH = 1200;
const LOGO_REVEAL_HEIGHT = 630;

const Player = lazy(() =>
  import("@remotion/player").then((mod) => ({ default: mod.Player })),
);

function StaticWordmark() {
  return (
    <h1 className="text-3xl font-bold">
      <span>נהל </span>
      <span className="text-primary">הכל</span>
    </h1>
  );
}

/**
 * Animated "נהל הכל" wordmark for the hero/welcome screen.
 * Renders the static wordmark until mounted client-side, and falls back to it
 * entirely when the visitor prefers reduced motion or JS hasn't loaded yet.
 */
export function LogoRevealHero() {
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (!mounted || reducedMotion) {
    return <StaticWordmark />;
  }

  return (
    <>
      {/* Real heading for screen readers; the animation below is decorative */}
      <h1 className="sr-only">נהל הכל</h1>
      <div
        aria-hidden="true"
        dir="ltr"
        style={{
          width: "100%",
          maxWidth: 420,
          margin: "0 auto",
          aspectRatio: `${LOGO_REVEAL_WIDTH} / ${LOGO_REVEAL_HEIGHT}`,
        }}
      >
        <Suspense fallback={<StaticWordmark />}>
          <Player
            lazyComponent={() =>
              import("@/remotion/LogoReveal").then((mod) => ({
                default: mod.LogoReveal,
              }))
            }
            durationInFrames={LOGO_REVEAL_DURATION}
            compositionWidth={LOGO_REVEAL_WIDTH}
            compositionHeight={LOGO_REVEAL_HEIGHT}
            fps={LOGO_REVEAL_FPS}
            autoPlay
            loop={false}
            moveToBeginningWhenEnded={false}
            controls={false}
            clickToPlay={false}
            showPosterWhenUnplayed={false}
            style={{ width: "100%", height: "100%" }}
          />
        </Suspense>
      </div>
    </>
  );
}
