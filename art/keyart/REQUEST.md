# Key art request: Deepdelve title screen

This folder is for the game's key art: one scene, delivered in two framings
(portrait and landscape), which will sit behind the title screen and, darkened,
behind the prologue. This file is the brief. **If you are the agent making the
images, write your output into this folder only, and change nothing else in
the repository.**

## What to deliver

| File | Size (px) | Aspect | Used when |
|---|---|---|---|
| `portrait.png` | 1024 × 1536 (or larger, same aspect) | 2:3 | phone held upright |
| `landscape.png` | 1536 × 1024 (or larger, same aspect) | 3:2 | phone held sideways, tablets, desktop |

- PNG, sRGB, no transparency, no text of any kind in the image.
- Variations are welcome: name them `portrait-v2.png`, `landscape-v2.png` and so on.
  The plain names are the ones you would pick.
- Add `SOURCES.md` beside them, saying which tool and model made each file,
  the date, the exact prompt used for each (including any changes to the prompts
  below), and a link to the tool's terms of use for generated images.

Both files show **the same scene** (same hero, same arch, same Heart, same light),
framed differently. Generate them from the same prompt, adding the framing
block for each.

## The prompt

Use the main prompt, then add the framing block for the file being made.

### Main prompt

```
Key art for a dark-fantasy dungeon-crawler video game called Deepdelve. No text, no logo, no lettering, no watermark anywhere in the image.

Scene: a lone adventurer seen from behind, small in the frame, standing at the top of a vast stone stair that descends deep into the heart of a mountain. The hero wears a dark hooded travelling cloak with a ragged hem and a longsword strapped diagonally across the back, and holds a burning torch out to the right, its warm light falling on the nearest steps. The stair is ancient dwarven stonework, worn, chipped and broken at the edges, with low crumbling side walls, and it narrows with distance as it falls away through a colossal carved stone archway. Faint golden runes glow along the arch's inner curve, and a heavy keystone sits at its peak.

Far below, beyond the arch, at the foot of the stair, floats the Heart of the Mountain: a large faceted crystal burning white-gold at its core, fading to orange and deep red at its edges. It sits above a pool of molten light. Its glow is the main light of the whole image: it rims the hero's silhouette with red-gold light, lights the inner faces of the arch, and sends soft shafts of light rising up through dust and haze.

Around it: an enormous cavern. Sheer cliff walls close in on both sides toward the Heart, with narrow ledges and paths cut into them, and a few tiny distant torches on the ledges where others went down before. Jagged stalactites hang along the top edge, and dark boulders frame the bottom corners. Embers and glowing dust motes drift upward.

Mood: awe, dread and temptation; the moment before the first step down. Epic scale: the hero is tiny against the depth.

Lighting and colour: very dark overall, deep blue-black and violet shadows in the cavern, set against a single intense warm light source (white-gold, amber, ember-orange, blood-red). Strong rim lighting, volumetric light shafts, atmospheric haze that deepens with distance. High contrast, but the shadows keep detail.

Style: painterly digital illustration in the manner of high-end fantasy game key art and book covers: rich texture, confident brushwork, cinematic composition, crisp detail at the focal point and softer toward the edges. Not photographic, not cartoonish, no anime style.

Avoid: any text or letters, a modern look, bright daylight, saturated cyan or green, a cluttered foreground, the hero's face visible, multiple characters, monsters, a symmetrical poster layout, borders or frames.
```

### Framing: `portrait.png`

```
Vertical image, 1024×1536. Composition: the Heart and the arch sit in the upper-middle of the frame, centred horizontally, about 30–40% down from the top. The hero stands just left of centre, feet about 60–65% down. The bottom 35% of the image will be covered by the game's title and buttons, so keep it simple and dark there: the lower steps fading into shadow, nothing important. The top 10% is a dark ceiling of stalactites.
```

### Framing: `landscape.png`

```
Wide horizontal image, 1536×1024. Composition: everything important sits in the LEFT 55% of the frame. The arch and the Heart are at about 35% from the left edge and 40% from the top; the hero stands just left of the stair's centre line, feet about 75% down. The right 45% of the image will be covered by menu buttons, so let it be dark cavern wall and cliff with soft detail and nothing important. Keep the top and bottom 15% free of essentials, as they may be cropped.
```

### Optional: to match the in-game pixel art

If asked for a pixel-art version as well, add this line to the main prompt
and save the results as `portrait-pixel.png` and `landscape-pixel.png`:

```
Rendered as highly detailed, painterly pixel art at about 480 pixels tall, with a limited palette and ordered dithering in the shadows.
```

## Why the framing matters

The title screen lays its own text and buttons over the picture:

- **Upright phone:** the picture fills the top two-thirds of the screen. The
  game's name, its tagline and the buttons cover roughly the bottom third of the
  picture, and a dismissible news card can cover the top 15%. The scene has to
  read in the band between: the Heart, the arch and the hero.
- **Sideways phone:** the picture fills the whole screen. The game's name sits on
  the left over the middle; the buttons fill the right half. The scene reads in
  the left half, and the right half is atmosphere.
- The picture is scaled to cover the screen, so on very wide or very tall
  screens its edges are cropped: keep what matters away from them.

## Checklist before handing it over

- [ ] No text, letters, runes that read as words, signatures or watermarks.
- [ ] The Heart is the brightest thing in the image, and the light comes from it.
- [ ] The hero is seen from behind, small, holding a torch, with a sword on the back.
- [ ] Portrait: nothing important in the bottom 35%.
- [ ] Landscape: nothing important in the right 45%.
- [ ] Both files show the same scene and light.
- [ ] `SOURCES.md` written, including the terms of use for the images.

## What happens next (not for the image agent)

Once the images are here, they are compressed to WebP (about 200–300 KB each),
added to the offline cache in `sw.js`, and set behind the title for each
orientation, with a slow push-in and drift, the embers and torch flicker over
them, and the opening's fade and music swell; a darkened copy goes behind the
prologue. The originals stay in this folder as the source.
