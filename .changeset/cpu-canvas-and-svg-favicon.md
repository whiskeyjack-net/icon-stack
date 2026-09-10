---
"@whiskeyjack-net/icon-stack-core": minor
"@whiskeyjack-net/icon-stack": minor
---

Full antialiasing in the browser, and an SVG favicon that carries the favicon settings.

- **Every browser canvas is CPU-backed** (`willReadFrequently: true`). Chrome's default 2D context is GPU-accelerated and rasterizes paths, clips and SVG images with 4-sample multisampling, so every edge got five coverage levels: SVG sources and baked corners exported from the web app had staircase edges the Node pipeline never had. Measured on a real logo: 5 alpha levels on a default context, 242 on a CPU one; 11 levels on the edges of a shipped PWA icon, 256 after.
- **`favicon.svg` is composed, not passed through.** The source SVG is nested whole inside a square 1024 viewBox with the same plate, corner and zoom the `.ico` bakes, the contain/cover fit, and the opt-in dark-mode inversion the `svgDarkMode` setting always promised and never did. `composeSvgFavicon` is exported from the core.
