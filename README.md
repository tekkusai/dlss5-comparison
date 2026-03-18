# DLSS 5 Tonemapping Slider

Interactive tool that separates DLSS 5's lighting improvements from its tonemapping. Slide between Native, Lighting Only, and full DLSS 5.

**[Live Demo](https://tekkusai.github.io/dlss5-comparison/)**

## How it works

DLSS 5 does two things: improved per-frame relighting (good) and aggressive tonemapping (controversial). This tool isolates the lighting by applying [/u/Veedrac's merge technique](https://www.reddit.com/r/hardware/comments/1rvwube/dlss_5_fixing_it_in_post/):

- HSV saturation transfer from the native image
- LCh lightness blend at 50%
- Darken Only blend at 50%

The slider then lets you dial the tonemapping back in from 0% to 100%.

## Features

- Single slider: Native → Lighting Only → Full DLSS 5
- Split comparison (toggle with Compare button or C key)
- Scroll to zoom, drag to pan, double-click to reset
- Pinch-to-zoom on touch devices
- Gallery with instant switching (cached merges + IndexedDB persistence)
- Background preloading

## Credits

Tool by [tekkusai](https://tekkus.ai) · Merge edits by [/u/Veedrac](https://www.reddit.com/user/Veedrac) · Comparison images sourced from [Digital Foundry](https://www.digitalfoundry.net/)
