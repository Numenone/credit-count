"use client";

import { useId } from "react";
import type { Emotion } from "@/lib/mascot-shared";

/**
 * Rusty, the engineer dog.
 *
 * Drawn in the flat-with-outlines idiom of hand-animated cartoons: every solid
 * shape carries the same warm-brown contour at the same weight, which is what
 * separates "a character" from "some coloured blobs". Shading is a single
 * darker fur tone, never a gradient.
 *
 * ## The pose
 *
 * He lies on his front behind a parapet with his forearms genuinely crossed on
 * top of it. LEDGE_Y is the line where that parapet passes: everything above it
 * is inside the container, everything below hangs over the edge. His torso is
 * clipped at that line — his belly is behind the wall, so it must not be drawn
 * below it — while the arms and paws deliberately cross it. `ledgeOffset()`
 * gives callers the pixel offset that puts LEDGE_Y on their own bottom edge.
 *
 * ## Expression
 *
 * FACES is a rig, not a set of pictures. Each emotion supplies continuous
 * values — brow ends that move independently, upper and lower lids as
 * fractions, a pupil direction, a head tilt — and the drawing interpolates
 * between them with CSS transitions, so changing emotion is a performance
 * rather than a cut. Three things do most of the work:
 *
 *   - The brow's INNER end. Up is worried or apologetic, down is angry. Nearly
 *     every readable expression is that one number.
 *   - Asymmetry. Real faces are not mirrored; `asymmetry` lifts one brow, which
 *     is the whole difference between "thinking" and "staring".
 *   - Lids over a whole eyeball. Squinting by deleting the eye and drawing an
 *     arc is the classic mistake — it reads as dead. The eyeball stays; lids
 *     come down over it.
 */

/* -------------------------------------------------------------- geometry -- */

const VIEW_W = 300;
const VIEW_H = 300;

/** The parapet line, in user units. See `ledgeOffset`. */
const LEDGE_Y = 250;

/**
 * How far below a container's bottom edge the artwork must be pushed for
 * LEDGE_Y to land on that edge.
 */
export function ledgeOffset(width: number) {
  return (width * (VIEW_H - LEDGE_Y)) / VIEW_W;
}

const HEAD = { cx: 150, cy: 132, rx: 76, ry: 70 };
const EYE = { y: 122, dx: 31, rx: 17, ry: 19 };
const BROW_Y = 88;
const MUZZLE = { cx: 150, cy: 170, rx: 46, ry: 34 };

const LINE = "var(--mascot-line)";
const STROKE = 4;

/* ------------------------------------------------------------------ rig -- */

type Mouth =
  | "smile"
  | "smile-small"
  | "smile-open"
  | "grin"
  | "o"
  | "purse"
  | "wavy"
  | "frown";

type Prop = "steam" | "spark" | "pin" | "sweat";

interface Face {
  /** Vertical shift of the whole brow. Negative is raised. */
  browY: number;
  /** Inner end of the brow. Positive is down — the angry direction. */
  browInner: number;
  /** Outer end of the brow. Positive is down. */
  browOuter: number;
  /** Extra lift on his right brow only. Asymmetry is what reads as thought. */
  asymmetry: number;
  /** Fraction of the eye covered from the top. */
  lidTop: number;
  /** Fraction covered from the bottom — a cheek pushing up, not a closed eye. */
  lidBottom: number;
  /** Eyeball scale. Wide eyes are bigger, not just more open. */
  eyeScale: number;
  /** Pupil offset in user units: where he is looking. */
  look: [number, number];
  mouth: Mouth;
  /** Ear droop in degrees. Negative perks them up. */
  ears: number;
  /** Head tilt in degrees. */
  tilt: number;
  /** Cheek colour, 0–1. */
  blush: number;
  /** Whether he blinks. A startled character holds his eyes open. */
  blink: boolean;
  /** Idle motion: "breathe" is the resting state, "bob" is excitement. */
  motion: "breathe" | "bob" | "still";
  prop?: Prop;
}

const FACES: Record<Emotion, Face> = {
  idle: {
    browY: 0, browInner: 0, browOuter: 0, asymmetry: 0,
    lidTop: 0.14, lidBottom: 0, eyeScale: 1, look: [0, 0],
    mouth: "smile", ears: 0, tilt: 0, blush: 0.35, blink: true, motion: "breathe",
  },

  // Looking up and away, one brow raised, mouth pushed to one side. The tilt
  // and the look direction agree — a head tilted left with eyes right reads as
  // suspicion, not thought.
  thinking: {
    browY: -5, browInner: -6, browOuter: 2, asymmetry: -8,
    lidTop: 0.3, lidBottom: 0, eyeScale: 1, look: [-6, -8],
    mouth: "purse", ears: 7, tilt: -7, blush: 0.3, blink: true, motion: "breathe",
    prop: "steam",
  },

  happy: {
    browY: -2, browInner: -2, browOuter: -1, asymmetry: -1,
    lidTop: 0.06, lidBottom: 0.04, eyeScale: 1.02, look: [0, 0],
    mouth: "smile-open", ears: -3, tilt: 0, blush: 0.45, blink: true, motion: "breathe",
  },

  // The lower lid comes up rather than the upper coming down: that is the
  // difference between a smile that reaches the eyes and one that does not.
  thrilled: {
    browY: -9, browInner: -5, browOuter: -7, asymmetry: -2,
    lidTop: 0, lidBottom: 0.2, eyeScale: 1.12, look: [0, -1],
    mouth: "grin", ears: -15, tilt: 3, blush: 0.6, blink: false, motion: "bob",
    prop: "spark",
  },

  // Reminiscing: half-lidded and soft, not grinning. Wistful is a quiet face.
  history: {
    browY: -3, browInner: -4, browOuter: 1, asymmetry: -3,
    lidTop: 0.34, lidBottom: 0.1, eyeScale: 1, look: [-4, -3],
    mouth: "smile", ears: 4, tilt: -4, blush: 0.4, blink: true, motion: "breathe",
    prop: "steam",
  },

  // Both pupils go the same way — eyes that diverge look broken. Head tilts
  // with the look, as though picturing somewhere over there.
  geography: {
    browY: -5, browInner: -3, browOuter: -4, asymmetry: -4,
    lidTop: 0.08, lidBottom: 0.02, eyeScale: 1.02, look: [9, -2],
    mouth: "smile-small", ears: 1, tilt: 5, blush: 0.35, blink: true, motion: "breathe",
    prop: "pin",
  },

  surprised: {
    browY: -15, browInner: -13, browOuter: -12, asymmetry: -2,
    lidTop: 0, lidBottom: 0, eyeScale: 1.3, look: [0, 1],
    mouth: "o", ears: -19, tilt: -3, blush: 0.3, blink: false, motion: "still",
  },

  // Inner brows up, outer down, eyes down and away, ears flat: the whole face
  // retreats. The blush does more here than any other single value.
  sheepish: {
    browY: -3, browInner: -10, browOuter: 6, asymmetry: -3,
    lidTop: 0.44, lidBottom: 0.26, eyeScale: 0.96, look: [-8, 4],
    mouth: "wavy", ears: 23, tilt: 9, blush: 0.85, blink: true, motion: "breathe",
    prop: "sweat",
  },

  // Inner brows down and outer up — the reverse of sheepish, and the reason
  // this reads as anger rather than as a frown.
  stern: {
    browY: 5, browInner: 10, browOuter: -5, asymmetry: 0,
    lidTop: 0.4, lidBottom: 0.16, eyeScale: 1, look: [0, 1],
    mouth: "frown", ears: 13, tilt: 0, blush: 0, blink: false, motion: "still",
  },
};

/* ------------------------------------------------------------- fragments -- */

const EASE = "460ms var(--ease-out)";

/** Floppy hound ear, authored once and mirrored. `side` is -1 (his right). */
function earPath(side: -1 | 1) {
  const x = (d: number) => 150 + side * d;
  return [
    `M ${x(58)} 96`,
    `C ${x(96)} 100 ${x(106)} 140 ${x(96)} 178`,
    `C ${x(88)} 204 ${x(52)} 210 ${x(48)} 186`,
    `C ${x(45)} 168 ${x(52)} 130 ${x(50)} 100`,
    "Z",
  ].join(" ");
}

function Mouth({ shape }: { shape: Mouth }) {
  const common = {
    stroke: LINE,
    strokeWidth: 5,
    strokeLinecap: "round" as const,
    fill: "none",
  };

  switch (shape) {
    case "smile":
      return <path d="M 124 174 Q 150 196 176 174" {...common} />;
    case "smile-small":
      return <path d="M 133 176 Q 150 190 167 176" {...common} />;
    case "purse":
      // Off-centre on purpose: a symmetric small mouth reads as neutral.
      return <path d="M 134 180 Q 148 170 164 180" {...common} />;
    case "wavy":
      return <path d="M 127 179 Q 139 168 150 178 Q 161 188 173 176" {...common} />;
    case "frown":
      return <path d="M 126 189 Q 150 168 174 189" {...common} />;
    case "o":
      return (
        <g>
          <ellipse
            cx={150} cy={186} rx={16} ry={20}
            fill="var(--mascot-nose)" stroke={LINE} strokeWidth={STROKE}
          />
          <ellipse cx={150} cy={196} rx={10} ry={8} fill="var(--mascot-tongue)" />
        </g>
      );
    case "smile-open":
      return (
        <g>
          <path
            d="M 122 172 Q 150 210 178 172 Q 150 182 122 172 Z"
            fill="var(--mascot-nose)" stroke={LINE} strokeWidth={STROKE} strokeLinejoin="round"
          />
          <path d="M 134 190 Q 150 206 166 190 Q 150 196 134 190 Z" fill="var(--mascot-tongue)" />
        </g>
      );
    case "grin":
      return (
        <g>
          <path
            d="M 114 166 Q 150 220 186 166 Q 150 180 114 166 Z"
            fill="var(--mascot-nose)" stroke={LINE} strokeWidth={STROKE} strokeLinejoin="round"
          />
          {/* A strip of teeth along the top lip, not a full set — a mouthful of
              teeth on a dog reads as a snarl. */}
          <path d="M 122 170 Q 150 180 178 170 Q 150 186 122 170 Z" fill="var(--mascot-shirt)" />
          <path d="M 130 196 Q 150 218 170 196 Q 150 202 130 196 Z" fill="var(--mascot-tongue)" />
        </g>
      );
  }
}

function Paw({ x, y, flip }: { x: number; y: number; flip: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${flip * 6})`}>
      <ellipse
        rx={29} ry={22}
        fill="var(--mascot-fur)" stroke={LINE} strokeWidth={STROKE}
      />
      {/* Toe separations, fanned from the wrist side so the paw has a front. */}
      {[-1, 0, 1].map((i) => (
        <path
          key={i}
          d={`M ${i * 13 + flip * 4} -6 q ${i * 3} 12 ${i * 4} 20`}
          stroke={LINE} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.7}
        />
      ))}
    </g>
  );
}

/* ----------------------------------------------------------- the drawing -- */

export function Mascot({
  emotion = "idle",
  className = "",
}: {
  emotion?: Emotion;
  /**
   * Sizing lives on the wrapper, not here — see `.mascot-perch` in globals.css.
   * The drawing fills whatever box it is given so it can change size at a
   * breakpoint without the perch arithmetic having to be repeated in JS.
   */
  className?: string;
}) {
  const face = FACES[emotion] ?? FACES.happy;
  // Two Mascots can be on the page at once (the card and the modal). Duplicate
  // clip-path ids would silently resolve to whichever rendered first.
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;

  const motion =
    face.motion === "bob"
      ? "rusty-bob 1.1s ease-in-out infinite"
      : face.motion === "breathe"
        ? "rusty-breathe 4.2s ease-in-out infinite"
        : "none";

  return (
    <svg
      className={className}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      fill="none"
      role="img"
      aria-label={`Rusty the engineer dog, looking ${emotion}`}
      style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
    >
      <defs>
        {/* His belly is behind the parapet, so nothing of the body may be drawn
            below the ledge line. The arms are outside this clip on purpose. */}
        <clipPath id={id("above-ledge")}>
          <rect x={-40} y={-40} width={VIEW_W + 80} height={LEDGE_Y + 40} />
        </clipPath>
        <clipPath id={id("crown")}>
          <path d="M 74 92 C 68 34 110 14 150 14 C 190 14 232 34 226 92 Z" />
        </clipPath>
        {[-1, 1].map((side) => (
          <clipPath key={side} id={id(`eye${side > 0 ? "r" : "l"}`)}>
            <ellipse
              cx={150 + side * EYE.dx}
              cy={EYE.y}
              rx={EYE.rx * face.eyeScale}
              ry={EYE.ry * face.eyeScale}
            />
          </clipPath>
        ))}
      </defs>

      <g style={{ animation: motion, transformOrigin: `150px ${LEDGE_Y}px` }}>
        {/* ------------------------------------------------------- ears -- */}
        {/* Behind the head, and they lag the head's motion rather than tracking
            it — soft things do not turn on the same frame as the skull. */}
        {([-1, 1] as const).map((side) => (
          <g
            key={side}
            style={{
              transformOrigin: `${150 + side * 54}px 104px`,
              transform: `rotate(${side * face.ears}deg)`,
              transition: `transform ${EASE}`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...({ "--ear-swing": `${side * 3.5}deg` } as any),
              animation: face.motion === "still" ? "none" : `rusty-ear 4.6s ease-in-out ${side > 0 ? 0.5 : 0}s infinite`,
            }}
          >
            <path
              d={earPath(side)}
              fill="var(--mascot-fur-mid)"
              stroke={LINE}
              strokeWidth={STROKE}
              strokeLinejoin="round"
            />
            <path
              d={earPath(side)}
              fill="var(--mascot-fur-dark)"
              opacity={0.35}
              transform={`translate(${side * 7} 8) scale(0.86)`}
              transform-origin={`${150 + side * 54}px 150px`}
            />
          </g>
        ))}

        {/* ------------------------------------- body, behind the parapet -- */}
        <g clipPath={`url(#${id("above-ledge")})`}>
          {/* Shoulders */}
          <path
            d="M 60 268 C 62 216 100 196 150 196 C 200 196 238 216 240 268 Z"
            fill="var(--mascot-fur)" stroke={LINE} strokeWidth={STROKE} strokeLinejoin="round"
          />

          {/* Denim bib and straps — the engineer's overalls. */}
          <path
            d="M 104 236 C 104 216 124 208 150 208 C 176 208 196 216 196 236 L 196 268 L 104 268 Z"
            fill="var(--mascot-denim)" stroke={LINE} strokeWidth={STROKE} strokeLinejoin="round"
          />
          {([-1, 1] as const).map((side) => (
            <path
              key={side}
              d={`M ${150 + side * 30} 212 C ${150 + side * 46} 206 ${150 + side * 62} 216 ${150 + side * 66} 240`}
              stroke="var(--mascot-denim)" strokeWidth={17} strokeLinecap="round" fill="none"
            />
          ))}
          {([-1, 1] as const).map((side) => (
            <g key={side}>
              <path
                d={`M ${150 + side * 30} 212 C ${150 + side * 46} 206 ${150 + side * 62} 216 ${150 + side * 66} 240`}
                stroke={LINE} strokeWidth={3.2} fill="none" opacity={0.85}
                strokeDasharray="0"
                transform={`translate(0 -9)`}
              />
              <circle
                cx={150 + side * 31} cy={220} r={6}
                fill="var(--mascot-brass)" stroke={LINE} strokeWidth={3}
              />
            </g>
          ))}
          {/* Chest pocket, so the denim is a garment and not a blue shape. */}
          <path
            d="M 134 240 L 166 240 L 166 262 L 150 270 L 134 262 Z"
            fill="var(--mascot-denim-dark)" stroke={LINE} strokeWidth={3} strokeLinejoin="round"
          />

          {/* Neckerchief, over the collarbone. */}
          <path
            d="M 100 194 C 118 216 182 216 200 194 C 196 214 178 230 150 232 C 122 230 104 214 100 194 Z"
            fill="var(--mascot-scarf)" stroke={LINE} strokeWidth={STROKE} strokeLinejoin="round"
          />
          <path
            d="M 128 218 C 140 226 160 226 172 218 C 166 228 158 232 150 232 C 142 232 134 228 128 218 Z"
            fill="var(--mascot-scarf-dark)"
          />
        </g>

        {/* ------------------------------------------------------- head -- */}
        <g
          style={{
            transformOrigin: "150px 200px",
            transform: `rotate(${face.tilt}deg)`,
            transition: `transform ${EASE}`,
          }}
        >
          <ellipse
            cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry}
            fill="var(--mascot-fur)" stroke={LINE} strokeWidth={STROKE}
          />

          {/* Muzzle first, so the nose and mouth sit on it. */}
          <ellipse
            cx={MUZZLE.cx} cy={MUZZLE.cy} rx={MUZZLE.rx} ry={MUZZLE.ry}
            fill="var(--mascot-muzzle)" stroke={LINE} strokeWidth={STROKE}
          />

          {/* Cheeks. Opacity carries most of "embarrassed". */}
          {([-1, 1] as const).map((side) => (
            <ellipse
              key={side}
              cx={150 + side * 60} cy={158} rx={17} ry={11}
              fill="var(--mascot-blush)"
              opacity={face.blush}
              style={{ transition: `opacity ${EASE}` }}
            />
          ))}

          {/* ------------------------------------------------ the eyes -- */}
          {([-1, 1] as const).map((side) => {
            const cx = 150 + side * EYE.dx;
            const rx = EYE.rx * face.eyeScale;
            const ry = EYE.ry * face.eyeScale;
            const clip = `url(#${id(`eye${side > 0 ? "r" : "l"}`)})`;
            const top = EYE.y - ry;

            return (
              <g key={side}>
                <ellipse
                  cx={cx} cy={EYE.y} rx={rx} ry={ry}
                  fill="#ffffff" stroke={LINE} strokeWidth={STROKE}
                  style={{ transition: `all ${EASE}` }}
                />

                <g clipPath={clip}>
                  <circle
                    cx={cx + face.look[0]} cy={EYE.y + face.look[1]} r={ry * 0.62}
                    fill="var(--mascot-iris)"
                    style={{ transition: `all ${EASE}` }}
                  />
                  <circle
                    cx={cx + face.look[0]} cy={EYE.y + face.look[1]} r={ry * 0.38}
                    fill="var(--mascot-pupil)"
                    style={{ transition: `all ${EASE}` }}
                  />
                  {/* Two highlights: a big one for life, a small opposite one so
                      the eye reads as a sphere rather than a sticker. */}
                  <circle
                    cx={cx + face.look[0] - ry * 0.22} cy={EYE.y + face.look[1] - ry * 0.3}
                    r={ry * 0.2} fill="#ffffff"
                    style={{ transition: `all ${EASE}` }}
                  />
                  <circle
                    cx={cx + face.look[0] + ry * 0.28} cy={EYE.y + face.look[1] + ry * 0.26}
                    r={ry * 0.09} fill="#ffffff" opacity={0.85}
                    style={{ transition: `all ${EASE}` }}
                  />

                  {/* Lids are fur laid over the whole eyeball. */}
                  <rect
                    x={cx - rx - 2} y={top - 1}
                    width={rx * 2 + 4} height={Math.max(0.001, ry * 2 * face.lidTop) + 1}
                    fill="var(--mascot-fur)"
                    style={{ transition: `height ${EASE}` }}
                  />
                  <rect
                    x={cx - rx - 2} y={EYE.y + ry - ry * 2 * face.lidBottom}
                    width={rx * 2 + 4} height={Math.max(0.001, ry * 2 * face.lidBottom) + 1}
                    fill="var(--mascot-fur-mid)"
                    style={{ transition: `all ${EASE}` }}
                  />

                  {face.blink && (
                    <rect
                      x={cx - rx - 2} y={top - 1}
                      width={rx * 2 + 4} height={ry * 2 + 3}
                      fill="var(--mascot-fur)"
                      style={{
                        transformOrigin: `${cx}px ${top}px`,
                        animation: "rusty-blink 8.4s ease-in-out infinite",
                      }}
                    />
                  )}
                </g>

                {/* Redrawn on top so the lid never covers the eye's outline. */}
                <ellipse
                  cx={cx} cy={EYE.y} rx={rx} ry={ry}
                  fill="none" stroke={LINE} strokeWidth={STROKE}
                  style={{ transition: `all ${EASE}` }}
                />
              </g>
            );
          })}

          {/* ----------------------------------------------- the brows -- */}
          {([-1, 1] as const).map((side) => {
            const cx = 150 + side * EYE.dx;
            const lift = face.browY + (side < 0 ? face.asymmetry : 0);
            // "Inner" is the end nearest the middle of the face, whichever side
            // of the face that happens to be on.
            const innerX = cx - side * -24;
            const outerX = cx + side * -24;
            const innerY = BROW_Y + lift + face.browInner;
            const outerY = BROW_Y + lift + face.browOuter;

            return (
              <path
                key={side}
                d={`M ${outerX} ${outerY} Q ${cx} ${(innerY + outerY) / 2 - 7} ${innerX} ${innerY}`}
                stroke="var(--mascot-fur-dark)" strokeWidth={9} strokeLinecap="round" fill="none"
                style={{ transition: `d ${EASE}` }}
              />
            );
          })}

          {/* ------------------------------------------- nose and mouth -- */}
          <path
            d="M 150 140 C 168 140 175 149 170 157 C 165 165 150 168 150 168 C 150 168 135 165 130 157 C 125 149 132 140 150 140 Z"
            fill="var(--mascot-nose)" stroke={LINE} strokeWidth={STROKE} strokeLinejoin="round"
          />
          <path d="M 150 166 L 150 176" stroke={LINE} strokeWidth={4} strokeLinecap="round" />
          <Mouth shape={face.mouth} />

          {/* --------------------------------------------------- cap -- */}
          <g>
            <path
              d="M 74 92 C 68 34 110 14 150 14 C 190 14 232 34 226 92 Z"
              fill="var(--mascot-cap)" stroke={LINE} strokeWidth={STROKE} strokeLinejoin="round"
            />
            <g clipPath={`url(#${id("crown")})`}>
              {[-2, -1, 0, 1, 2].map((i) => (
                <path
                  key={i}
                  d={`M ${150 + i * 30} 8 L ${150 + i * 30 + 6} 96`}
                  stroke="var(--mascot-cap-stripe)" strokeWidth={13} opacity={0.9}
                />
              ))}
            </g>
            {/* Redrawn so the stripes stop cleanly at the crown's contour. */}
            <path
              d="M 74 92 C 68 34 110 14 150 14 C 190 14 232 34 226 92 Z"
              fill="none" stroke={LINE} strokeWidth={STROKE} strokeLinejoin="round"
            />
            {/* The brim, seen head-on: a shallow lens under the crown. */}
            <path
              d="M 68 90 C 78 124 222 124 232 90 Z"
              fill="var(--mascot-cap-dark)" stroke={LINE} strokeWidth={STROKE} strokeLinejoin="round"
            />
            <circle cx={150} cy={16} r={8} fill="var(--mascot-cap-dark)" stroke={LINE} strokeWidth={3} />
          </g>
        </g>

        {/* ------------------------------------------------------ props -- */}
        {face.prop === "steam" &&
          [0, 1, 2].map((i) => (
            <circle
              key={i}
              cx={244 + i * 11} cy={70 - i * 16} r={7 + i * 3}
              fill="var(--mascot-steam)" stroke={LINE} strokeWidth={2.5}
              style={{ animation: `puff 2.6s ease-in-out ${i * 0.34}s infinite` }}
            />
          ))}

        {face.prop === "spark" &&
          ([-1, 1] as const).map((side) => (
            <path
              key={side}
              d={`M ${150 + side * 108} 46 l 5 14 14 5 -14 5 -5 14 -5 -14 -14 -5 14 -5 Z`}
              fill="var(--mascot-brass)" stroke={LINE} strokeWidth={2.5} strokeLinejoin="round"
              style={{
                transformOrigin: `${150 + side * 108}px 65px`,
                animation: `twinkle-spark 1.5s ease-in-out ${side > 0 ? 0.45 : 0}s infinite`,
              }}
            />
          ))}

        {face.prop === "pin" && (
          <g
            style={{
              transformOrigin: "246px 74px",
              animation: "sway 3.8s ease-in-out infinite",
            }}
          >
            <path
              d="M 246 40 C 262 40 272 52 272 66 C 272 82 254 96 246 106 C 238 96 220 82 220 66 C 220 52 230 40 246 40 Z"
              fill="var(--mascot-scarf)" stroke={LINE} strokeWidth={3} strokeLinejoin="round"
            />
            <circle cx={246} cy={66} r={9} fill="var(--mascot-shirt)" stroke={LINE} strokeWidth={3} />
          </g>
        )}

        {face.prop === "sweat" && (
          <path
            d="M 232 76 C 242 92 242 102 232 104 C 222 102 222 92 232 76 Z"
            fill="var(--mascot-sweat)" stroke={LINE} strokeWidth={2.5} strokeLinejoin="round"
            style={{ animation: "bead 1.9s ease-in-out infinite" }}
          />
        )}

        {/* --------------------------------------- arms, crossed on the ledge -- */}
        {/* Drawn back-to-front in two passes. Each arm is stroked twice — once
            wide in the line colour, once narrower in fur — which is what puts a
            contour around a stroked limb, and what makes the near forearm read
            as passing IN FRONT of the far one rather than merging with it. */}
        {(
          [
            // Far arm: from his left shoulder, paw ending on the right.
            { d: "M 224 212 C 216 238 186 254 130 256", paw: [114, 255], flip: -1 },
            // Near arm: crosses lower and later, so the overlap is unambiguous.
            { d: "M 76 216 C 84 246 118 268 176 266", paw: [194, 265], flip: 1 },
          ] as const
        ).map((arm, i) => (
          <g key={i}>
            <path d={arm.d} stroke={LINE} strokeWidth={41} strokeLinecap="round" fill="none" />
            <path
              d={arm.d}
              stroke={i === 0 ? "var(--mascot-fur-mid)" : "var(--mascot-fur)"}
              strokeWidth={33} strokeLinecap="round" fill="none"
            />
            {/* Rolled shirt cuff, three-quarters along. */}
            <g transform={`translate(${arm.paw[0] + arm.flip * -44} ${arm.paw[1] - 8}) rotate(${arm.flip * 68})`}>
              <rect
                x={-20} y={-9} width={40} height={18} rx={8}
                fill="var(--mascot-shirt)" stroke={LINE} strokeWidth={3.4}
              />
            </g>
            <Paw x={arm.paw[0]} y={arm.paw[1]} flip={arm.flip} />
          </g>
        ))}
      </g>
    </svg>
  );
}
