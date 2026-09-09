"use client";

import type { Emotion } from "@/lib/mascot-shared";

/**
 * Rusty, the engineer dog.
 *
 * Drawn lying on his front with his forearms over a ledge, so the artwork is
 * authored to sit at the BOTTOM of its container with the paws crossing the
 * container's own edge. The parent supplies the ledge; the paws just have to
 * overlap it, which is why the SVG deliberately overflows its box rather than
 * being clipped to it.
 *
 * Expression is data, not a pile of conditionals: each emotion is a row in
 * FACES, so adding one is adding a row rather than editing the drawing.
 */

interface Face {
  /** Eye shape. Drives both lids and pupils. */
  eyes: "open" | "wide" | "squint" | "soft" | "up" | "side" | "narrow";
  /** Brow angle in degrees. Negative is raised at the inner edge (worried). */
  brow: number;
  /** How high the brows sit. */
  browLift: number;
  /** Mouth shape. */
  mouth: "smile" | "grin" | "open" | "small" | "flat" | "wavy";
  /** Ear droop in degrees. Higher droops further. */
  ears: number;
  /** Tail wag speed in seconds. 0 = still. */
  wag: number;
  /** Optional accessory drawn beside the head. */
  prop?: "steam" | "map" | "spark" | "sweat";
  /** Head tilt in degrees. */
  tilt: number;
}

const FACES: Record<Emotion, Face> = {
  idle: { eyes: "soft", brow: 0, browLift: 0, mouth: "smile", ears: 8, wag: 3.2, tilt: 0 },
  thinking: { eyes: "up", brow: -6, browLift: -2, mouth: "small", ears: 14, wag: 0, prop: "steam", tilt: -6 },
  happy: { eyes: "open", brow: 0, browLift: 1, mouth: "smile", ears: 4, wag: 1.6, tilt: 0 },
  thrilled: { eyes: "wide", brow: 0, browLift: 4, mouth: "grin", ears: -6, wag: 0.7, prop: "spark", tilt: 3 },
  history: { eyes: "soft", brow: -3, browLift: 1, mouth: "small", ears: 10, wag: 2.6, prop: "steam", tilt: -3 },
  geography: { eyes: "side", brow: 0, browLift: 2, mouth: "small", ears: 6, wag: 2.2, prop: "map", tilt: 4 },
  surprised: { eyes: "wide", brow: 0, browLift: 6, mouth: "open", ears: -10, wag: 0, tilt: -2 },
  sheepish: { eyes: "squint", brow: -12, browLift: -1, mouth: "wavy", ears: 22, wag: 0, prop: "sweat", tilt: 8 },
  stern: { eyes: "narrow", brow: 14, browLift: -3, mouth: "flat", ears: 16, wag: 0, tilt: 0 },
};

export function Mascot({
  emotion = "idle",
  width = 190,
  className = "",
}: {
  emotion?: Emotion;
  width?: number;
  className?: string;
}) {
  const face = FACES[emotion] ?? FACES.happy;

  return (
    <svg
      className={className}
      width={width}
      height={width * 0.78}
      viewBox="0 0 240 188"
      fill="none"
      role="img"
      aria-label={`Rusty the engineer dog, looking ${emotion}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        <clipPath id="rusty-cap">
          <path d="M58 62 q62 -46 124 0 v6 h-124 Z" />
        </clipPath>
      </defs>

      {/* ------------------------------------------------------------ tail -- */}
      {face.wag > 0 && (
        <g style={{ transformOrigin: "196px 150px", animation: `wag ${face.wag}s ease-in-out infinite` }}>
          <path
            d="M192 152 q26 -10 30 -30"
            stroke="var(--mascot-fur-dark)"
            strokeWidth={11}
            strokeLinecap="round"
            fill="none"
          />
        </g>
      )}

      {/* ------------------------------------------------------------ ears -- */}
      {[-1, 1].map((side) => (
        <g
          key={side}
          style={{
            transformOrigin: `${120 + side * 52}px 66px`,
            transform: `rotate(${side * face.ears}deg)`,
            transition: "transform 420ms var(--ease-out)",
          }}
        >
          <path
            d={`M${120 + side * 50} 58 q${side * 26} 6 ${side * 20} 44 q${side * -8} 14 ${side * -22} 4 Z`}
            fill="var(--mascot-fur-dark)"
          />
        </g>
      ))}

      {/* ------------------------------------------------------------ head -- */}
      <g
        style={{
          transformOrigin: "120px 110px",
          transform: `rotate(${face.tilt}deg)`,
          transition: "transform 420ms var(--ease-out)",
        }}
      >
        <ellipse cx={120} cy={100} rx={62} ry={54} fill="var(--mascot-fur)" />

        {/* Cap: band, crown, peak. */}
        <path d="M58 62 q62 -46 124 0 v6 h-124 Z" fill="var(--brand)" />
        <g clipPath="url(#rusty-cap)">
          <path d="M120 8 v60" stroke="var(--mascot-cap-stripe)" strokeWidth={9} opacity={0.55} />
          <path d="M92 12 v58" stroke="var(--mascot-cap-stripe)" strokeWidth={7} opacity={0.35} />
          <path d="M150 12 v58" stroke="var(--mascot-cap-stripe)" strokeWidth={7} opacity={0.35} />
        </g>
        <rect x={52} y={60} width={136} height={13} rx={6.5} fill="var(--mascot-cap-band)" />
        <path d="M52 70 q-22 4 -20 14 q30 6 40 -6 Z" fill="var(--mascot-cap-band)" />

        {/* Brows */}
        {[-1, 1].map((side) => (
          <rect
            key={side}
            x={120 + side * 32 - 15}
            y={82 - face.browLift}
            width={30}
            height={5.5}
            rx={2.75}
            fill="var(--mascot-fur-dark)"
            style={{
              transformOrigin: `${120 + side * 32}px ${84 - face.browLift}px`,
              transform: `rotate(${side * face.brow}deg)`,
              transition: "transform 380ms var(--ease-out), y 380ms var(--ease-out)",
            }}
          />
        ))}

        {/* Eyes */}
        {[-1, 1].map((side) => {
          const cx = 120 + side * 26;
          const cy = 100;

          if (face.eyes === "squint" || face.eyes === "narrow") {
            return (
              <path
                key={side}
                d={
                  face.eyes === "squint"
                    ? `M${cx - 11} ${cy + 2} q11 -9 22 0`
                    : `M${cx - 11} ${cy - 1} q11 5 22 0`
                }
                stroke="var(--mascot-ink)"
                strokeWidth={4}
                strokeLinecap="round"
                fill="none"
              />
            );
          }

          const r = face.eyes === "wide" ? 12 : face.eyes === "soft" ? 9 : 10;
          const look =
            face.eyes === "up" ? { x: 0, y: -3 } : face.eyes === "side" ? { x: side * 2 + 3, y: 0 } : { x: 0, y: 0 };

          return (
            <g key={side}>
              <circle cx={cx} cy={cy} r={r} fill="#ffffff" />
              <circle cx={cx + look.x} cy={cy + look.y} r={r * 0.52} fill="var(--mascot-ink)" />
              <circle cx={cx + look.x + 2} cy={cy + look.y - 2.5} r={r * 0.18} fill="#ffffff" />
            </g>
          );
        })}

        {/* Muzzle, nose, mouth */}
        <ellipse cx={120} cy={126} rx={30} ry={20} fill="var(--mascot-muzzle)" />
        <ellipse cx={120} cy={116} rx={9} ry={7} fill="var(--mascot-ink)" />

        {face.mouth === "smile" && (
          <path d="M108 128 q12 11 24 0" stroke="var(--mascot-ink)" strokeWidth={3.4} strokeLinecap="round" fill="none" />
        )}
        {face.mouth === "grin" && (
          <>
            <path d="M104 126 q16 20 32 0 Z" fill="var(--mascot-ink)" />
            <path d="M110 134 q10 8 20 0" fill="var(--mascot-tongue)" />
          </>
        )}
        {face.mouth === "open" && <ellipse cx={120} cy={133} rx={9} ry={11} fill="var(--mascot-ink)" />}
        {face.mouth === "small" && (
          <path d="M113 130 q7 6 14 0" stroke="var(--mascot-ink)" strokeWidth={3.4} strokeLinecap="round" fill="none" />
        )}
        {face.mouth === "flat" && (
          <path d="M108 132 h24" stroke="var(--mascot-ink)" strokeWidth={3.4} strokeLinecap="round" />
        )}
        {face.mouth === "wavy" && (
          <path
            d="M108 131 q6 -5 12 0 q6 5 12 0"
            stroke="var(--mascot-ink)"
            strokeWidth={3.2}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </g>

      {/* ------------------------------------------------------------ props -- */}
      {face.prop === "steam" &&
        [0, 1, 2].map((i) => (
          <circle
            key={i}
            cx={196 + i * 9}
            cy={54 - i * 13}
            r={5 + i * 2.5}
            fill="var(--mascot-steam)"
            style={{ animation: `puff 2.4s ease-in-out ${i * 0.32}s infinite` }}
          />
        ))}

      {face.prop === "spark" &&
        [-1, 1].map((side) => (
          <path
            key={side}
            d={`M${120 + side * 84} 40 l4 11 11 4 -11 4 -4 11 -4 -11 -11 -4 11 -4 Z`}
            fill="var(--brand)"
            style={{ animation: `twinkle-spark 1.5s ease-in-out ${side > 0 ? 0.4 : 0}s infinite` }}
          />
        ))}

      {face.prop === "map" && (
        <g transform="translate(190 66) rotate(9)" style={{ animation: "sway 3.6s ease-in-out infinite" }}>
          <rect width={40} height={30} rx={3} fill="var(--mascot-steam)" stroke="var(--mascot-ink)" strokeWidth={2} />
          <path d="M6 20 q9 -13 16 -4 q6 8 13 -6" stroke="var(--brand)" strokeWidth={2.4} fill="none" />
          <circle cx={29} cy={9} r={3} fill="var(--brand)" />
        </g>
      )}

      {face.prop === "sweat" && (
        <path
          d="M186 66 q7 12 0 17 q-7 -5 0 -17 Z"
          fill="var(--mascot-sweat)"
          style={{ animation: "bead 1.9s ease-in-out infinite" }}
        />
      )}

      {/* ------------------------------------------------ arms on the ledge -- */}
      {/* Authored so the paws sit just below y=170 and overhang whatever the
          parent uses as its bottom edge. */}
      {[-1, 1].map((side) => (
        <g key={side}>
          <path
            d={`M${120 + side * 46} 140 q${side * 20} 18 ${side * 6} 36`}
            stroke="var(--mascot-fur)"
            strokeWidth={26}
            strokeLinecap="round"
            fill="none"
          />
        </g>
      ))}
      {/* Crossed forepaws */}
      <g>
        <rect x={78} y={162} width={52} height={24} rx={12} fill="var(--mascot-fur-dark)" />
        <rect x={110} y={168} width={54} height={24} rx={12} fill="var(--mascot-fur)" />
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M${124 + i * 13} 172 v11`}
            stroke="var(--mascot-fur-dark)"
            strokeWidth={2.4}
            strokeLinecap="round"
            opacity={0.55}
          />
        ))}
      </g>
    </svg>
  );
}
