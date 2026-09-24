import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Heebo";

const { fontFamily } = loadFont("normal", {
  weights: ["700", "800"],
  subsets: ["hebrew", "latin"],
});

// Matches the site's design tokens (src/styles.css)
const COLORS = {
  foreground: "oklch(0.24 0.012 260)",
  primary: "oklch(0.58 0.15 250)",
  primarySoft: "oklch(0.95 0.025 250)",
};

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

const WORDS: { text: string; color: string }[] = [
  { text: "נהל", color: COLORS.foreground },
  { text: "הכל", color: COLORS.primary },
];

// Flatten to characters, carrying a global stagger index (reading order = array order, since dir="rtl" handles visual placement).
const CHARS = WORDS.flatMap((word, wordIndex) =>
  word.text.split("").map((ch) => ({ ch, color: word.color, wordIndex })),
);

const CHAR_STEP = 3; // frames between each character's reveal start
const CHAR_START = 14; // frame the first character begins revealing
const CHAR_DUR = 22; // frames each character takes to fully reveal

const lastCharEnd = CHAR_START + (CHARS.length - 1) * CHAR_STEP + CHAR_DUR;
const UNDERLINE_START = lastCharEnd - 6;
const UNDERLINE_DUR = 26;
const SHINE_START = UNDERLINE_START + UNDERLINE_DUR + 4;
const SHINE_DUR = 34;

export const LOGO_REVEAL_DURATION = SHINE_START + SHINE_DUR + 26;
export const LOGO_REVEAL_FPS = 30;
export const LOGO_REVEAL_WIDTH = 1200;
export const LOGO_REVEAL_HEIGHT = 630;

export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();

  const glowOpacity = interpolate(frame, [0, 26], [0, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
  const glowScale = interpolate(frame, [0, 34], [0.7, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
    output: "perceptual-scale",
  });

  const underlineScaleX = interpolate(
    frame,
    [UNDERLINE_START, UNDERLINE_START + UNDERLINE_DUR],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_OUT,
    },
  );
  const underlineOpacity = interpolate(
    frame,
    [UNDERLINE_START, UNDERLINE_START + 10],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT },
  );

  const shineOpacity = interpolate(
    frame,
    [SHINE_START, SHINE_START + 8, SHINE_START + SHINE_DUR - 8, SHINE_START + SHINE_DUR],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT },
  );
  const shinePosition = interpolate(
    frame,
    [SHINE_START, SHINE_START + SHINE_DUR],
    [140, -60],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT },
  );

  return (
    <AbsoluteFill
      name="Scene"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Interactive.Div
        name="Glow"
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.primarySoft} 0%, transparent 70%)`,
          filter: "blur(30px)",
          opacity: glowOpacity,
          scale: glowScale,
        }}
      />

      <div
        dir="rtl"
        style={{
          position: "relative",
          display: "inline-block",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "0.32em",
            fontFamily,
            fontWeight: 800,
            fontSize: 116,
            letterSpacing: "-0.01em",
          }}
        >
          {WORDS.map((word, wordIndex) => (
            <span key={wordIndex} style={{ display: "flex" }}>
              {CHARS.filter((c) => c.wordIndex === wordIndex).map((c, i) => {
                const globalIndex = WORDS.slice(0, wordIndex).reduce(
                  (acc, w) => acc + w.text.length,
                  0,
                ) + i;
                const start = CHAR_START + globalIndex * CHAR_STEP;
                const end = start + CHAR_DUR;
                const opacity = interpolate(frame, [start, end], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: EASE_OUT,
                });
                const translateY = interpolate(frame, [start, end], [18, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: EASE_OUT,
                });
                const scale = interpolate(frame, [start, end], [0.92, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: EASE_OUT,
                  output: "perceptual-scale",
                });
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      color: word.color,
                      opacity,
                      translate: `0px ${translateY}px`,
                      scale,
                    }}
                  >
                    {c.ch}
                  </span>
                );
              })}
            </span>
          ))}
        </div>

        {/* Shine sweep overlay, clipped to the same text shape */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "row",
            gap: "0.32em",
            fontFamily,
            fontWeight: 800,
            fontSize: 116,
            letterSpacing: "-0.01em",
            opacity: shineOpacity,
            pointerEvents: "none",
          }}
        >
          {WORDS.map((word, wordIndex) => (
            <span
              key={wordIndex}
              style={{
                backgroundImage:
                  "linear-gradient(100deg, transparent 35%, rgba(255,255,255,0.85) 50%, transparent 65%)",
                backgroundSize: "300% 100%",
                backgroundPositionX: `${shinePosition}%`,
                backgroundPositionY: "0%",
                backgroundRepeat: "no-repeat",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              {word.text}
            </span>
          ))}
        </div>

        {/* Underline sweep */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -20,
            height: 4,
            borderRadius: 999,
            background: `linear-gradient(90deg, transparent, ${COLORS.primary}, transparent)`,
            opacity: underlineOpacity,
            scale: `${underlineScaleX} 1`,
            transformOrigin: "center",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
