/**
 * Appearance preferences that must be applied before the page paints.
 *
 * This module is deliberately NOT "use client". These strings are rendered into
 * the HTML by the root layout, which is a server component, and a value imported
 * from a client module is not a value there — it is a client reference. Exporting
 * `themeScript` from theme-toggle.tsx meant the layout inlined a stub that threw
 * "Attempted to call themeScript() from the server", so the attribute was never
 * set and every full page load fell back to the OS theme while the toggle
 * happily reported the stored one.
 */

export const THEME_KEY = "cc-theme";
export const MOTION_KEY = "cc-motion";

/** Applies the stored theme before first paint, so there is no flash. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

/** Applies the stored motion preference before anything has a chance to animate. */
export const motionScript = `(function(){try{if(localStorage.getItem("${MOTION_KEY}")==="reduced"){document.documentElement.setAttribute("data-motion","reduced");}}catch(e){}})();`;
