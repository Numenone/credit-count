/**
 * The scene band that closes the page.
 *
 * Inline SVG, themed entirely from the same CSS variables as the rest of the
 * app: switching to dark does not swap an image, it restyles this one. That is
 * what makes the city windows turn on — `--scene-window` flips from dark glass
 * to lamp amber and the transition does the rest.
 *
 * It is a server component. Every position here is computed at module scope
 * from a fixed seed, so the markup is byte-identical on the server and the
 * client and nothing needs to hydrate.
 */

const W = 1600;
const H = 232;
// Headroom above the origin. The viewBox starts here, not at 0, so there is sky
// above the tallest building for the clouds, sun and stars to occupy.
const TOP = -70;
// The ground line is the bottom edge of the viewBox, so the buildings and the
// track baseline butt straight up against the footer with no dead band.
const GROUND = H;

/* ------------------------------------------------------------- determinism -- */

/** Mulberry32 — small, fast, and identical on both sides of the render. */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ track -- */

/**
 * The ride profile as anchor points: station, lift hill, first drop, then
 * airtime hills easing back down to the brakes.
 *
 * Anchors rather than a hand-written path so the support columns can be placed
 * at known heights — a support drawn to a guessed y is the kind of detail that
 * reads as wrong without anyone being able to say why.
 */
const ANCHORS: [number, number][] = [
  // Station and the flat out-run
  [-60, 228],
  [60, 228],
  [140, 226],
  // Lift hill — plotted densely and near-linearly so the spline cannot round it
  // into a sine wave. A coaster with no straight climb does not read as one.
  [200, 204],
  [250, 172],
  [300, 140],
  [350, 108],
  [400, 76],
  [440, 54],
  [472, 44],
  [500, 47],
  // First drop
  [528, 64],
  [556, 96],
  [582, 130],
  [606, 162],
  [628, 187],
  [652, 199],
  // Airtime hill
  [692, 186],
  [732, 154],
  [772, 118],
  [808, 96],
  [840, 89],
  [872, 98],
  [902, 122],
  [934, 154],
  [962, 178],
  [994, 194],
  [1024, 197],
  // Second hill
  [1058, 179],
  [1092, 147],
  [1130, 111],
  [1162, 91],
  [1192, 85],
  [1224, 93],
  [1256, 112],
  [1290, 144],
  [1322, 169],
  [1354, 188],
  [1388, 199],
  // Brake run back to the station
  [1444, 211],
  [1502, 220],
  [1562, 226],
  [1660, 228],
];

/** Catmull-Rom through the anchors, emitted as cubic beziers. */
function smoothPath(points: [number, number][], tension = 0.9) {
  const p = points;
  let d = `M ${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p[i + 1];
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

const TRACK = smoothPath(ANCHORS);

/* --------------------------------------------------------------- skyline -- */

interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  windows: { x: number; y: number; delay: number }[];
}

function skyline(seed: number, count: number, baseY: number, minH: number, maxH: number) {
  const rand = seeded(seed);
  const buildings: Building[] = [];
  let x = -40;

  while (x < W + 40 && buildings.length < count) {
    const w = 34 + Math.round(rand() * 46);
    const h = minH + Math.round(rand() * (maxH - minH));
    const y = baseY - h;
    const windows: Building["windows"] = [];

    // A grid of windows, most of them lit at night — a fully lit block reads as
    // a texture, so roughly a third stay dark.
    for (let wy = y + 9; wy < baseY - 8; wy += 12) {
      for (let wx = x + 7; wx < x + w - 8; wx += 11) {
        if (rand() > 0.34) {
          windows.push({ x: wx, y: wy, delay: Math.round(rand() * 900) });
        }
      }
    }

    buildings.push({ x, y, w, h, windows });
    x += w + 6 + Math.round(rand() * 16);
  }

  return buildings;
}

const FAR_CITY = skyline(9021, 26, GROUND, 54, 112);
const NEAR_CITY = skyline(4417, 20, GROUND, 38, 86);

const STARS = Array.from({ length: 46 }, (_, i) => {
  const rand = seeded(7000 + i * 31);
  return {
    x: Math.round(rand() * W),
    y: Math.round(TOP + 12 + rand() * (150 - TOP - 12)),
    r: 0.7 + rand() * 1.1,
    delay: Math.round(rand() * 3400),
  };
});

/**
 * Wing positions, animated as the path itself.
 *
 * The first attempt scaled the wings vertically with CSS. On an SVG element
 * `transform-origin: center` resolves against the *viewBox*, not the element, so
 * the squash was anchored 150 units away and dragged each bird up and down
 * instead of flapping it. Animating the `d` attribute has no origin to get wrong.
 */
const WING_UP = "M -14 0 q 7 -9 14 0 q 7 -9 14 0";
const WING_FLAT = "M -14 0 q 7 -2 14 0 q 7 -2 14 0";
const WING_DOWN = "M -14 0 q 7 5 14 0 q 7 5 14 0";
const WING_CYCLE = [WING_UP, WING_FLAT, WING_DOWN, WING_FLAT, WING_UP].join(";");

const BIRDS = [
  { y: 52, scale: 1, duration: 26, delay: 0, flap: 0.54 },
  { y: 74, scale: 0.78, duration: 32, delay: -9, flap: 0.66 },
  { y: 38, scale: 0.62, duration: 38, delay: -18, flap: 0.46 },
  { y: 92, scale: 0.9, duration: 29, delay: -24, flap: 0.6 },
];

/**
 * Clouds cross the full band and start off-screen.
 *
 * Positive delays, not negative ones: a negative delay would seek the animation
 * forward and drop a cloud into the middle of the sky on first paint. These wait
 * their turn and drift in, so the scene arrives quiet and fills up slowly.
 *
 * CLOUD_CEILING is the highest a cloud's centre may sit. It is derived from the
 * shape rather than guessed: the topmost point of the puff sits CLOUD_RISE above
 * the centre, so keeping the centre below TOP + CLOUD_RISE + margin guarantees no
 * cloud is ever born clipped by the top of the box.
 */
const CLOUD_RISE = 13; // highest ellipse: cy -13, ry 13 → 26 above the group origin
const CLOUD_CEILING = TOP + CLOUD_RISE * 2 + 12;

const CLOUDS = (
  [
    { y: 4, scale: 1, direction: "right", duration: 118, delay: 7 },
    { y: 40, scale: 0.72, direction: "left", duration: 152, delay: 26 },
    { y: -14, scale: 0.86, direction: "right", duration: 134, delay: 58 },
  ] as const
).map((cloud) => ({
  ...cloud,
  // A cloud authored too high is clamped rather than silently clipped.
  y: Math.max(cloud.y, CLOUD_CEILING + CLOUD_RISE * cloud.scale),
}));

/* -------------------------------------------------------------- component -- */

/**
 * The train itself, drawn around its own origin so a motion path can carry it.
 *
 * The group is raised so the wheels rest ON the rail rather than straddling it:
 * wheel centres land at y -3 with a 2.2 radius, putting their underside just
 * above the line the motion path follows.
 */
function Train() {
  return (
    <g transform="translate(-26 -15)">
      {[0, 19, 38].map((offset) => (
        <g key={offset}>
          {/* Every car is --brand, the same token the logo mark uses, so the
              train reads as the site's own colour rather than a near-miss. */}
          <rect x={offset} y={0} width={16} height={11} rx={3.5} fill="var(--brand)" />
          <circle cx={offset + 4.5} cy={12} r={2.2} fill="var(--scene-track)" />
          <circle cx={offset + 11.5} cy={12} r={2.2} fill="var(--scene-track)" />
          {/* Riders. */}
          <circle cx={offset + 5.5} cy={-2.5} r={2.4} fill="var(--scene-track)" />
          <circle cx={offset + 11} cy={-2.5} r={2.4} fill="var(--scene-track)" />
        </g>
      ))}
      {/* Headlight at the FRONT. The path runs left to right, so the leading
          car is the right-hand one; this used to sit behind the train. */}
      <circle className="scene-moon" cx={58} cy={5.5} r={9} fill="url(#glow)" />
    </g>
  );
}

export function CoasterScene() {
  return (
    <div aria-hidden className="pointer-events-none w-full overflow-hidden">
      <svg
        className="scene"
        viewBox={`0 ${TOP} ${W} ${H - TOP}`}
        preserveAspectRatio="xMidYMax slice"
        role="presentation"
        focusable="false"
      >
        <defs>
          <radialGradient id="glow">
            <stop offset="0%" stopColor="var(--scene-window)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--scene-window)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* No sky plate. Everything here sits directly on the page background,
            so the band reads as an illustration on the page rather than as a
            window cut into it. */}

        {/* Stars — invisible by day because their alpha token is 0. */}
        <g>
          {STARS.map((star, i) => (
            <circle
              key={i}
              className="scene-star"
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill="#fdf6e3"
              style={{ animationDelay: `${star.delay}ms` }}
            />
          ))}
        </g>

        <circle className="scene-sun" cx={1310} cy={-4} r={26} fill="#f6c65c" />
        <g className="scene-moon">
          <circle cx={1310} cy={-4} r={22} fill="#e8ecf5" />
          {/* The crescent is cut with a disc painted in the page background, so
              it stays a crescent whatever the page is sitting on. */}
          <circle cx={1300} cy={-11} r={19} fill="var(--canvas)" className="scene-fill" />
        </g>

        {/* Clouds drift across in both directions and stay out of the way of
            the sun and moon. They are present in both themes — a night sky with
            no cloud at all looks like a missing layer. */}
        <g>
          {CLOUDS.map((cloud, i) => (
            <g
              key={i}
              className="scene-cloud"
              style={{
                animationName: cloud.direction === "right" ? "drift-right" : "drift-left",
                animationDuration: `${cloud.duration}s`,
                animationDelay: `${cloud.delay}s`,
              }}
            >
              <g
                transform={`translate(0 ${cloud.y}) scale(${cloud.scale})`}
                opacity={0.85}
                className="scene-fill"
                fill="var(--scene-cloud)"
              >
                <ellipse cx={0} cy={6} rx={44} ry={15} />
                <ellipse cx={30} cy={0} rx={29} ry={13} />
                <ellipse cx={-30} cy={2} rx={25} ry={11} />
              </g>
            </g>
          ))}
        </g>

        {/* Far skyline */}
        <g>
          {FAR_CITY.map((b, i) => (
            <g key={`far-${i}`}>
              <rect
                className="scene-fill"
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill="var(--scene-city-far)"
              />
              {b.windows.map((win, j) => (
                <rect
                  key={j}
                  className="scene-window"
                  x={win.x}
                  y={win.y}
                  width={3.5}
                  height={5}
                  style={{ transitionDelay: `${win.delay}ms` }}
                />
              ))}
            </g>
          ))}
        </g>

        {/* Near skyline */}
        <g>
          {NEAR_CITY.map((b, i) => (
            <g key={`near-${i}`}>
              <rect
                className="scene-fill"
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill="var(--scene-city-near)"
              />
              {b.windows.map((win, j) => (
                <rect
                  key={j}
                  className="scene-window"
                  x={win.x}
                  y={win.y}
                  width={4}
                  height={5.5}
                  style={{ transitionDelay: `${win.delay}ms` }}
                />
              ))}
            </g>
          ))}
        </g>

        {/* Birds pass behind the ride, in front of the city. */}
        <g>
          {BIRDS.map((bird, i) => (
            <g
              key={i}
              className="scene-bird"
              style={{ animationDuration: `${bird.duration}s`, animationDelay: `${bird.delay}s` }}
            >
              <g transform={`translate(0 ${bird.y}) scale(${bird.scale})`}>
                <path
                  className="scene-fill"
                  d={WING_UP}
                  fill="none"
                  stroke="var(--scene-bird)"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                >
                  <animate
                    attributeName="d"
                    values={WING_CYCLE}
                    dur={`${bird.flap}s`}
                    repeatCount="indefinite"
                  />
                </path>
              </g>
            </g>
          ))}
        </g>

        {/* Supports, drawn to the anchor heights the track is built from. */}
        <g stroke="var(--scene-support)" strokeWidth={3} strokeLinecap="round" className="scene-fill">
          {ANCHORS.filter((_, i) => i % 3 === 1)
            .filter(([, y]) => y < GROUND - 26)
            .map(([x, y], i) => (
              <g key={i}>
                <line x1={x} y1={y + 5} x2={x} y2={GROUND} />
                <line x1={x} y1={y + 5} x2={x - 15} y2={GROUND} strokeWidth={1.5} opacity={0.7} />
                <line x1={x} y1={y + 5} x2={x + 15} y2={GROUND} strokeWidth={1.5} opacity={0.7} />
                <line
                  x1={x - 8}
                  y1={(y + GROUND) / 2}
                  x2={x + 8}
                  y2={(y + GROUND) / 2}
                  strokeWidth={1.2}
                  opacity={0.55}
                />
              </g>
            ))}
        </g>

        {/* Station: a small platform so the flat run at each end has a reason. */}
        <g className="scene-fill">
          <rect x={-10} y={214} width={150} height={5} rx={2} fill="var(--scene-support)" />
          <rect x={1518} y={214} width={150} height={5} rx={2} fill="var(--scene-support)" />
        </g>

        {/* Track: one thick rail, one thin highlight, and the cross ties. */}
        <path
          id="cc-track"
          d={TRACK}
          fill="none"
          stroke="var(--scene-track)"
          strokeWidth={5}
          strokeLinecap="round"
          className="scene-fill"
        />
        <path
          d={TRACK}
          fill="none"
          stroke="var(--scene-support)"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeDasharray="2 9"
          className="scene-fill"
          opacity={0.9}
        />

        {/*
          The train rides the track with SVG's own motion path rather than CSS
          `offset-path`.

          CSS motion paths resolve against the element's box, not the SVG user
          space, which parked the train off-screen — and `transform-box` did not
          rescue it reliably. `<animateMotion><mpath>` takes the path in user
          units by definition and points at the exact same <path> element the
          track is drawn from, so the two cannot drift apart.
        */}
        <g className="scene-train">
          <Train />
          <animateMotion dur="25s" repeatCount="indefinite" rotate="auto" calcMode="linear">
            <mpath href="#cc-track" />
          </animateMotion>
        </g>

        {/*
          Reduced-motion fallback. SMIL cannot be stopped from CSS, so the moving
          train is hidden and this parked one is shown instead — the scene keeps
          its subject without anything on screen actually moving.
        */}
        <g className="scene-train-static" transform="translate(96 226)">
          <Train />
        </g>
      </svg>
    </div>
  );
}
