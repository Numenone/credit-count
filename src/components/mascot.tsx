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
 * He leans out from behind a parapet. LEDGE_Y is the line where that parapet
 * passes, the torso is clipped against it, and the container crops him there —
 * so what you see is a bust in dungarees, not a floating cut-out.
 *
 * He had crossed forearms resting on that ledge through three drafts and they
 * never read: folded arms need the elbows, the overlap and both hands to be
 * legible at 200 pixels, and at that size they collapse into one lump whatever
 * you do with the shading. Cutting them is what let the costume become the
 * costume instead of a sliver of blue behind a limb.
 *
 * ## Expression
 *
 * FACES is a rig, not a set of pictures. Each emotion supplies continuous
 * values — brow ends that move independently, upper and lower lids as
 * fractions, a pupil direction, a head tilt — and the drawing interpolates
 * between them with CSS transitions, so changing emotion is a performance
 * rather than a cut. Four things do most of the work:
 *
 *   - The brow's INNER end. Up is worried or apologetic, down is angry. Nearly
 *     every readable expression is that one number.
 *   - Asymmetry. Real faces are not mirrored; `asymmetry` lifts one brow, which
 *     is the whole difference between "thinking" and "staring".
 *   - Lids over a whole eyeball. Squinting by deleting the eye and drawing an
 *     arc is the classic mistake — it reads as dead. The eyeball stays; lids
 *     come down over it.
 *   - Where he is looking. A thought goes up and away, embarrassment goes down
 *     and away, and both pupils always agree with each other.
 */

/* -------------------------------------------------------------- geometry -- */

const VIEW_W = 300;
const VIEW_H = 300;

/**
 * The parapet line, in user units.
 *
 * With no arms to rest on it, nothing hangs over the edge any more: the line is
 * the bottom of the box, and the container clips him there. He reads as leaning
 * out from behind a counter rather than over a wall.
 *
 * Kept as a named constant rather than inlined because it is what the torso is
 * clipped against, and because `.mascot-perch` in globals.css depends on it —
 * CSS cannot read this file, so the two are kept in step by hand.
 */
const LEDGE_Y = VIEW_H;

/**
 * The head is deliberately smaller than a first pass wants it to be. A big head
 * is correct for this idiom, but at rx 76 it filled half the canvas and left no
 * room between the chin and the parapet for anything to be worn.
 */
const HEAD = { cx: 150, cy: 124, rx: 68, ry: 62 };
const EYE = { y: 116, dx: 28, rx: 15.5, ry: 17 };
const BROW_Y = 92;
const MUZZLE = { cx: 150, cy: 158, rx: 41, ry: 30 };

const LINE = "var(--mascot-line)";
const STROKE = 4;
const EASE = "460ms var(--ease-out)";

/* ------------------------------------------------------------------ rig -- */

type Mouth = "smile" | "smile-small" | "smile-open" | "grin" | "o" | "purse" | "wavy" | "frown";

/**
 * The thought bubbling beside his head.
 *
 * These are the cartoon shorthand that does what a drawn face cannot: a
 * question mark says "working on it" in a way no arrangement of eyebrows can.
 * Each one is anchored clear of the ears so it never collides with the head.
 */
type Prop = "question" | "exclaim" | "steam" | "spark" | "pin" | "sweat" | "huff";

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
  /** Whether he blinks. A startled character holds his eyes open. */
  blink: boolean;
  /** Idle motion: "breathe" is resting, "bob" excited, "still" braced. */
  motion: "breathe" | "bob" | "still";
  prop?: Prop;
}

const FACES: Record<Emotion, Face> = {
  idle: {
    browY: 0, browInner: 0, browOuter: 0, asymmetry: 0,
    lidTop: 0.14, lidBottom: 0, eyeScale: 1, look: [0, 0],
    mouth: "smile", ears: 0, tilt: 0, blink: true, motion: "breathe",
  },

  // Up and to his left, one brow raised, mouth pushed off-centre, and a
  // question mark surfacing beside his head. The tilt agrees with the look —
  // a head tilted one way with eyes the other reads as suspicion, not thought.
  thinking: {
    // The pupils go up only far enough to leave the centre — pushed to the very
    // top of the eye they leave a band of white underneath, and that is an eye
    // ROLL, which reads as scepticism. Same for a heavy upper lid: hooded eyes
    // are suspicious, not thoughtful. Both were wrong here before.
    browY: -8, browInner: -6, browOuter: 0, asymmetry: -6,
    lidTop: 0.1, lidBottom: 0, eyeScale: 1, look: [-7, -7],
    mouth: "purse", ears: 6, tilt: -8, blink: true, motion: "breathe",
    prop: "question",
  },

  happy: {
    browY: -2, browInner: -2, browOuter: -1, asymmetry: -1,
    lidTop: 0.06, lidBottom: 0.06, eyeScale: 1.02, look: [0, 0],
    mouth: "smile-open", ears: -4, tilt: 0, blink: true, motion: "breathe",
  },

  // The lower lid comes up rather than the upper coming down: that is the
  // difference between a smile that reaches the eyes and one that does not.
  thrilled: {
    browY: -9, browInner: -6, browOuter: -7, asymmetry: -2,
    lidTop: 0, lidBottom: 0.22, eyeScale: 1.14, look: [0, -1],
    mouth: "grin", ears: -16, tilt: 4, blink: false, motion: "bob",
    prop: "spark",
  },

  // Reminiscing is a quiet face, not a grin: half-lidded, looking softly past
  // you, with the engine's steam drifting up beside him.
  history: {
    browY: -3, browInner: -5, browOuter: 2, asymmetry: -4,
    lidTop: 0.36, lidBottom: 0.12, eyeScale: 1, look: [-5, -4],
    mouth: "smile", ears: 5, tilt: -5, blink: true, motion: "breathe",
    prop: "steam",
  },

  // Both pupils go the same way — eyes that diverge look broken — and the head
  // tilts with them, as though picturing somewhere over there.
  geography: {
    browY: -6, browInner: -4, browOuter: -5, asymmetry: -5,
    lidTop: 0.06, lidBottom: 0.04, eyeScale: 1.02, look: [10, -3],
    mouth: "smile-small", ears: 0, tilt: 6, blink: true, motion: "breathe",
    prop: "pin",
  },

  surprised: {
    browY: -11, browInner: -8, browOuter: -7, asymmetry: -2,
    lidTop: 0, lidBottom: 0, eyeScale: 1.32, look: [0, 1],
    mouth: "o", ears: -20, tilt: -4, blink: false, motion: "still",
    prop: "exclaim",
  },

  // Inner brows up, outer down, eyes down and away, ears flat: the whole face
  // retreats. The single most important value here is the inner brow.
  sheepish: {
    browY: -3, browInner: -11, browOuter: 7, asymmetry: -3,
    lidTop: 0.46, lidBottom: 0.28, eyeScale: 0.96, look: [-9, 5],
    mouth: "wavy", ears: 24, tilt: 10, blink: true, motion: "breathe",
    prop: "sweat",
  },

  // Inner brows down and outer up — the exact reverse of sheepish, and the
  // reason this reads as anger rather than as a frown. He huffs.
  stern: {
    browY: 3, browInner: 7, browOuter: -6, asymmetry: 0,
    lidTop: 0.42, lidBottom: 0.18, eyeScale: 1, look: [0, 2],
    mouth: "frown", ears: 14, tilt: 0, blink: false, motion: "still",
    prop: "huff",
  },
};

/* ------------------------------------------------------------- fragments -- */

/** Floppy hound ear, authored once and mirrored. `side` is -1 (his right). */
function earPath(side: -1 | 1) {
  const x = (d: number) => 150 + side * d;
  return [
    `M ${x(52)} 90`,
    `C ${x(86)} 94 ${x(95)} 130 ${x(86)} 164`,
    `C ${x(79)} 187 ${x(47)} 193 ${x(43)} 171`,
    `C ${x(41)} 155 ${x(47)} 121 ${x(45)} 94`,
    "Z",
  ].join(" ");
}

/**
 * The mouth.
 *
 * Open mouths keep the tongue small, low and well clear of the lip line. A
 * pink band following the lip is what makes a cartoon mouth read as lipstick
 * rather than as a mouth, and there are no teeth for the same reason — a
 * mouthful of white on a dog reads as a snarl.
 */
function Mouth({ shape }: { shape: Mouth }) {
  const line = {
    stroke: LINE,
    strokeWidth: 5,
    strokeLinecap: "round" as const,
    fill: "none",
  };
  const cavity = {
    fill: "var(--mascot-nose)",
    stroke: LINE,
    strokeWidth: STROKE,
    strokeLinejoin: "round" as const,
  };

  switch (shape) {
    case "smile":
      return <path d="M 131 177 Q 150 189 169 177" {...line} />;
    case "smile-small":
      return <path d="M 137 178 Q 150 186 163 178" {...line} />;
    case "purse":
      // Off-centre on purpose: a symmetric small mouth reads as neutral.
      return <path d="M 137 180 Q 146 175 157 179" {...line} />;
    case "wavy":
      return <path d="M 132 179 Q 141 172 150 178 Q 159 184 168 176" {...line} />;
    case "frown":
      return <path d="M 132 188 Q 150 176 168 188" {...line} />;
    case "o":
      return (
        <g>
          <ellipse cx={150} cy={180} rx={10} ry={11} {...cavity} />
          <ellipse cx={150} cy={185} rx={5} ry={3} fill="var(--mascot-tongue)" />
        </g>
      );
    case "smile-open":
      return (
        <g>
          <path d="M 132 175 Q 150 195 168 175 Z" {...cavity} />
          <path d="M 142 179 Q 150 187 158 179 Z" fill="var(--mascot-tongue)" />
        </g>
      );
    case "grin":
      return (
        <g>
          <path d="M 128 173 Q 150 200 172 173 Z" {...cavity} />
          <path d="M 139 181 Q 150 192 161 181 Z" fill="var(--mascot-tongue)" />
        </g>
      );
  }
}

/** The punctuation that floats beside his head while he thinks or reacts. */
function Glyph({ kind }: { kind: "question" | "exclaim" }) {
  const paint = {
    fill: "none",
    stroke: kind === "question" ? "var(--mascot-cap)" : "var(--mascot-scarf)",
    strokeWidth: 11,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <g
      style={{
        transformOrigin: "262px 58px",
        animation:
          kind === "question"
            ? "rusty-wonder 2.8s ease-in-out infinite"
            : "rusty-alarm 1.5s ease-out infinite",
      }}
    >
      {kind === "question" ? (
        <>
          <path d="M 248 40 C 248 26 278 25 278 40 C 278 51 262 52 262 64" {...paint} />
          <path d="M 262 80 L 262 81" {...paint} />
        </>
      ) : (
        <>
          <path d="M 262 26 L 262 60" {...paint} />
          <path d="M 262 78 L 262 79" {...paint} />
        </>
      )}
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
        {([-1, 1] as const).map((side) => (
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
        {/* Ears live INSIDE the head's tilt, not beside it. They used to be
            siblings of the head group, so tilting the head left the ears where
            they were — which is why one ear drifted off the side of the skull
            on every tilted expression. They still lag the tilt by animating
            separately, because soft things do not turn on the same frame as the
            bone they hang off. */}
        <g
          style={{
            transformOrigin: "150px 200px",
            transform: `rotate(${face.tilt}deg)`,
            transition: `transform ${EASE}`,
          }}
        >
          {([-1, 1] as const).map((side) => (
            <g
              key={side}
              style={{
                transformOrigin: `${150 + side * 48}px 98px`,
                transform: `rotate(${side * face.ears}deg)`,
                transition: `transform ${EASE}`,
                animation:
                  face.motion === "still"
                    ? "none"
                    : `rusty-ear 4.6s ease-in-out ${side > 0 ? 0.5 : 0}s infinite`,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ...({ "--ear-swing": `${side * 3.5}deg` } as any),
              }}
            >
              <path
                d={earPath(side)}
                fill="var(--mascot-fur-mid)" stroke={LINE} strokeWidth={STROKE} strokeLinejoin="round"
              />
              <path
                d={earPath(side)}
                fill="var(--mascot-fur-dark)" opacity={0.3}
                style={{ transformOrigin: `${150 + side * 48}px 140px`, transform: "scale(0.86)" }}
              />
            </g>
          ))}
        </g>

        {/* ------------------------------------- body, behind the parapet -- */}
        {/* No arms. Folded forearms need the elbows, the overlap and the two
            hands all to read at 200px, and they did not; without them the
            silhouette is a clean bust and the overalls finally have room to be
            the costume rather than a sliver of blue behind a limb. */}
        <g clipPath={`url(#${id("above-ledge")})`}>
          <path
            d="M 48 300 C 50 208 100 186 150 186 C 200 186 250 208 252 300 Z"
            fill="var(--mascot-fur)" stroke={LINE} strokeWidth={STROKE} strokeLinejoin="round"
          />

          {/* The dungarees. Straps first so the bib's top edge covers where they
              buckle, the way real ones do. */}
          {([-1, 1] as const).map((side) => (
            <path
              key={side}
              d={`M ${150 + side * 44} 220 C ${150 + side * 58} 206 ${150 + side * 70} 208 ${150 + side * 77} 226`}
              stroke="var(--mascot-denim)" strokeWidth={17} strokeLinecap="round" fill="none"
            />
          ))}
          <path
            d="M 98 244 C 98 220 122 210 150 210 C 178 210 202 220 202 244 L 202 300 L 98 300 Z"
            fill="var(--mascot-denim)" stroke={LINE} strokeWidth={STROKE} strokeLinejoin="round"
          />
          {/* Brass buckles where the straps meet the bib. */}
          {([-1, 1] as const).map((side) => (
            <g key={side}>
              <rect
                x={150 + side * 46 - 8} y={214} width={16} height={13} rx={3}
                fill="var(--mascot-brass)" stroke={LINE} strokeWidth={3}
              />
              <circle cx={150 + side * 46} cy={220.5} r={2.6} fill={LINE} opacity={0.65} />
            </g>
          ))}
          {/* A patch pocket and a seam, so the denim is a garment and not a
              blue shape. */}
          <path
            d="M 130 250 L 170 250 L 170 274 L 150 284 L 130 274 Z"
            fill="var(--mascot-denim-dark)" stroke={LINE} strokeWidth={3} strokeLinejoin="round"
          />
          <path
            d="M 132 256 L 168 256"
            stroke="var(--mascot-brass)" strokeWidth={2.4} strokeLinecap="round" opacity={0.75}
          />

          {/* Neckerchief, over the collarbone. */}
          <path
            d="M 100 184 C 118 206 182 206 200 184 C 196 204 178 220 150 222 C 122 220 104 204 100 184 Z"
            fill="var(--mascot-scarf)" stroke={LINE} strokeWidth={STROKE} strokeLinejoin="round"
          />
          <path
            d="M 128 208 C 140 216 160 216 172 208 C 166 218 158 222 150 222 C 142 222 134 218 128 208 Z"
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
          <ellipse
            cx={MUZZLE.cx} cy={MUZZLE.cy} rx={MUZZLE.rx} ry={MUZZLE.ry}
            fill="var(--mascot-muzzle)" stroke={LINE} strokeWidth={STROKE}
          />

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
                    fill="var(--mascot-iris)" style={{ transition: `all ${EASE}` }}
                  />
                  <circle
                    cx={cx + face.look[0]} cy={EYE.y + face.look[1]} r={ry * 0.38}
                    fill="var(--mascot-pupil)" style={{ transition: `all ${EASE}` }}
                  />
                  {/* Two highlights: a big one for life, a small opposite one
                      so the eye reads as a sphere rather than a sticker. */}
                  <circle
                    cx={cx + face.look[0] - ry * 0.22} cy={EYE.y + face.look[1] - ry * 0.3}
                    r={ry * 0.2} fill="#ffffff" style={{ transition: `all ${EASE}` }}
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
                    fill="var(--mascot-fur)" style={{ transition: `height ${EASE}` }}
                  />
                  <rect
                    x={cx - rx - 2} y={EYE.y + ry - ry * 2 * face.lidBottom}
                    width={rx * 2 + 4} height={Math.max(0.001, ry * 2 * face.lidBottom) + 1}
                    fill="var(--mascot-fur-mid)" style={{ transition: `all ${EASE}` }}
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
            // For his right eye (side -1, cx 122) the end NEAREST the face's
            // centre is cx + 24, not cx - 24. Getting this backwards silently
            // inverted every expression: stern wore sheepish's brows and vice
            // versa, which is why the faces read as almost-right and wrong.
            const innerX = cx - side * 16;
            const outerX = cx + side * 26;
            const innerY = BROW_Y + lift + face.browInner;
            const outerY = BROW_Y + lift + face.browOuter;

            return (
              <path
                key={side}
                d={`M ${outerX} ${outerY} Q ${cx} ${(innerY + outerY) / 2 - 7} ${innerX} ${innerY}`}
                stroke="var(--mascot-fur-dark)" strokeWidth={6.5} strokeLinecap="round" fill="none"
                style={{ transition: `d ${EASE}` }}
              />
            );
          })}

          {/* ------------------------------------------- nose and mouth -- */}
          <path
            d="M 150 124 C 166 124 172 133 168 141 C 164 149 150 152 150 152 C 150 152 136 149 132 141 C 128 133 134 124 150 124 Z"
            fill="var(--mascot-nose)" stroke={LINE} strokeWidth={STROKE} strokeLinejoin="round"
          />
          <path d="M 150 152 L 150 172" stroke={LINE} strokeWidth={4} strokeLinecap="round" />
          <Mouth shape={face.mouth} />

          {/* The anger mark, on his forehead. It lives inside the head group
              so it travels with a head tilt. */}
          {face.prop === "huff" && (
            <g
              style={{
                transformOrigin: "198px 92px",
                animation: "rusty-vex 1.4s ease-in-out infinite",
              }}
            >
              {[0, 60, 120].map((angle) => (
                <path
                  key={angle}
                  d="M 187 92 L 209 92"
                  stroke="var(--mascot-scarf)" strokeWidth={5} strokeLinecap="round"
                  transform={`rotate(${angle} 198 92)`}
                />
              ))}
            </g>
          )}
        </g>

        {/* ------------------------------------------------------ props -- */}
        {(face.prop === "question" || face.prop === "exclaim") && <Glyph kind={face.prop} />}

        {face.prop === "steam" &&
          [0, 1, 2].map((i) => (
            <circle
              key={i}
              cx={246 + i * 13} cy={70 - i * 21} r={7 + i * 3}
              fill="var(--mascot-steam)" stroke={LINE} strokeWidth={2.5}
              style={{
                // Anchored to itself: an SVG element's default transform-origin
                // resolves against the viewBox, which threw the outer puff clear
                // of the drawing when `puff` scaled it up.
                transformOrigin: `${246 + i * 13}px ${70 - i * 21}px`,
                animation: `puff 2.6s ease-in-out ${i * 0.34}s infinite`,
              }}
            />
          ))}

        {face.prop === "spark" &&
          ([-1, 1] as const).map((side) => (
            <path
              key={side}
              d={`M ${150 + side * 100} 42 l 5 14 14 5 -14 5 -5 14 -5 -14 -14 -5 14 -5 Z`}
              fill="var(--mascot-brass)" stroke={LINE} strokeWidth={2.5} strokeLinejoin="round"
              style={{
                transformOrigin: `${150 + side * 100}px 61px`,
                animation: `twinkle-spark 1.5s ease-in-out ${side > 0 ? 0.45 : 0}s infinite`,
              }}
            />
          ))}

        {face.prop === "pin" && (
          <g style={{ transformOrigin: "258px 62px", animation: "sway 3.8s ease-in-out infinite" }}>
            <path
              d="M 258 32 C 271 32 279 42 279 53 C 279 66 264 78 258 86 C 252 78 237 66 237 53 C 237 42 245 32 258 32 Z"
              fill="var(--mascot-scarf)" stroke={LINE} strokeWidth={3} strokeLinejoin="round"
            />
            <circle cx={258} cy={53} r={7.5} fill="var(--mascot-shirt)" stroke={LINE} strokeWidth={3} />
          </g>
        )}

        {face.prop === "sweat" && (
          <path
            d="M 234 54 C 243 69 243 78 234 80 C 225 78 225 69 234 54 Z"
            fill="var(--mascot-sweat)" stroke={LINE} strokeWidth={2.5} strokeLinejoin="round"
            style={{ animation: "bead 1.9s ease-in-out infinite" }}
          />
        )}

        {/* An irritated huff out of both nostrils — the cartoon shorthand for a
            character holding his temper, which is exactly the register wanted
            when he is declining something rather than losing his mind. */}
        {face.prop === "huff" &&
          ([-1, 1] as const).map((side) =>
            [0, 1].map((i) => (
              <ellipse
                key={`${side}-${i}`}
                cx={150 + side * (26 + i * 18)} cy={152 + i * 12}
                rx={7 + i * 3} ry={5.5 + i * 2.5}
                fill="var(--mascot-steam)" stroke={LINE} strokeWidth={2.5}
                style={{
                  // Anchored on the nostril it leaves, so the puff grows away
                  // from the snout instead of scaling about the viewBox centre.
                  transformOrigin: `${150 + side * 16}px 148px`,
                  animation: `rusty-huff 1.8s ease-out ${i * 0.3}s infinite`,
                }}
              />
            )),
          )}

      </g>
    </svg>
  );
}
