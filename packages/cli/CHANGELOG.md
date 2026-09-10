# @whiskeyjack-net/icon-stack

## 0.3.0

### Minor Changes

- 0a9204d: Full antialiasing in the browser, and an SVG favicon that carries the favicon settings.

  - **Every browser canvas is CPU-backed** (`willReadFrequently: true`). Chrome's default 2D context is GPU-accelerated and rasterizes paths, clips and SVG images with 4-sample multisampling, so every edge got five coverage levels: SVG sources and baked corners exported from the web app had staircase edges the Node pipeline never had. Measured on a real logo: 5 alpha levels on a default context, 242 on a CPU one; 11 levels on the edges of a shipped PWA icon, 256 after.
  - **`favicon.svg` is composed, not passed through.** The source SVG is nested whole inside a square 1024 viewBox with the same plate, corner and zoom the `.ico` bakes, the contain/cover fit, and the opt-in dark-mode inversion the `svgDarkMode` setting always promised and never did. `composeSvgFavicon` is exported from the core.

- 8285db9: Sharper small icons, and size tables brought up to current platform documentation.

  - The browser resamples with pica's default `mks2013` kernel instead of the legacy Lanczos3 preset, which pica now treats as deprecated. Measured 15–40% crisper at 16–44px.
  - Android adaptive layers, legacy mipmaps, the monochrome layer, PWA maskable icons and Windows Store tiles resize the artwork through the resampler before compositing. They used to draw the full-size source onto the small canvas in one step, which aliased every edge.
  - The Android monochrome layer sits in the same safe zone as the foreground instead of full-bleed, and `useMonochrome` defaults on.
  - `.icns` no longer writes an `icp6` entry; Apple's `iconutil` reads that OSType as 48×48 and resampled the 64px image stored there. The 64px render lives in `ic12`, as Apple's tools have it.
  - `.ico` frames under 256px are stored as uncompressed 32-bit DIBs, with the 256 frame as PNG, per Microsoft's guidance. `decodeIco` returns both frame kinds.
  - Windows `.ico` gains 20, 40 and 96; the tray `.ico` gains 40 and 64, matching Microsoft's DPI table.
  - Windows Store ships Microsoft's required target-size set (16–256, fourteen sizes) in all three variants: plain, `_altform-unplated` and `_altform-lightunplated`. A `lightUnplatedSourceChoice` picks the light-taskbar artwork.
  - Tray icons: Windows gets a light and a dark `.ico` plus one PNG per size for each, so a Tauri or Electron app can hand Windows the DPI-matched image. Dark variants everywhere are white silhouettes of the artwork's alpha rather than RGB inversions.
  - Legacy iOS ships as `ios/AppIcon.appiconset` with a `Contents.json` and light, dark and tinted 1024px images: the dark icon on a transparent background and the tinted one in grayscale, as Xcode asks. `IosConfig` no longer carries `bgFillDark`.
  - Apple `.icon`: a mono layer is now hidden in the default and dark appearances and shown only in tinted. With a mono layer and no light variant it used to keep its default opacity, so light mode drew the mono layer on top of the foreground. The layer shown in the tinted appearance carries Icon Composer's `fill: automatic`, so the system tints its shape rather than luminance-mapping it.
  - Linux passes an SVG source through as `linux/icon.svg`.
  - Sources may be JPEG or WebP as well as PNG or SVG. The browser backend honours the SVG raster size the core asks for.
