// iPhone screens that get an iOS launch image (portrait only: the app is not
// meant to start in landscape). Shared by scripts/render-icons.mjs, which draws
// them, and app/layout.tsx, which links them. iOS shows the image only when
// the media query matches the device exactly, so each size needs its own.
// [css width, css height, pixel ratio]
const DEVICES = [
  [440, 956, 3], // 16/17 Pro Max
  [420, 912, 3], // Air
  [402, 874, 3], // 16/17 Pro, 17
  [430, 932, 3], // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [390, 844, 3], // 12/13/14, 16e
  [360, 780, 3], // 12/13 mini
  [414, 896, 3], // XS Max, 11 Pro Max
  [414, 896, 2], // XR, 11
  [375, 812, 3], // X, XS, 11 Pro
  [375, 667, 2], // SE, 8
];

export const SPLASH_SCREENS = DEVICES.map(([w, h, dpr]) => ({
  width: w * dpr,
  height: h * dpr,
  file: `/splash/${w * dpr}x${h * dpr}.png`,
  media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
}));
