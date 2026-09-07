# IP icon candidate generation report

- Generator: built-in `image_gen`
- Model metadata: GPT Image 2.0 where exposed by the generated file metadata; one worker's tool result did not expose the lower-level model name
- Constraint delivery: main-prompt constraints
- Output: six independent, single-pass, unedited 1254 x 1254 PNG files
- Packaging: not run, per user request

## Candidate map

| Label | Direction | Product connection | Corner | Background | Character colors | File |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Markdown paper spirit | document editing | lower-left | eucalyptus teal | parchment cream + deep indigo | `A1-markdown-paper-left.png` |
| A2 | Markdown paper spirit | document editing | lower-right | periwinkle lavender | coral orange + midnight navy | `A2-markdown-paper-right.png` |
| B1 | fountain-pen-nib robot | visual authoring | lower-left | cornflower blue `#7694C5` | coral orange `#F06F5B` + ink navy `#142B4A` | `B1-pen-robot-left.png` |
| B2 | fountain-pen-nib robot | visual authoring | lower-right | sage green `#89A993` | butter yellow `#F2C85B` + deep teal `#123F43` | `B2-pen-robot-right.png` |
| C1 | slash-command ghost | fast command editing | lower-left | periwinkle blue `#7D88C9` | ivory `#FFF0C7` + plum `#4A285A` | `C1-slash-ghost-left.png` |
| C2 | slash-command ghost | fast command editing | lower-right | apricot coral `#D98E79` | midnight teal `#123E4A` + mint cream `#CFE8CF` | `C2-slash-ghost-right.png` |

## Exact prompts

## B1 Markdown-emblem refinement

- File: `B1-markdown-emblem.png`
- Edit target: `B1-pen-robot-left.png`
- Change: added one large deep-teal `M↓` emblem to the lower chest; preserved the existing palette and composition

```text
Edit the supplied image as the only target. Preserve the existing cute rounded pen-nib robot, its exact upright corner-emergence composition, crop, proportions, broad yellow body, deep teal visor, two eyes, muted sage background, full square canvas, simple surfaces, and subtle dimensional treatment.
Add exactly one large, simple Markdown emblem to the broad lower chest: the exact symbol “M↓”, with a heavy rounded geometric M directly joined visually to one broad blunt downward arrow. Render the emblem only in the same existing deep teal color used by the visor. Make it a single compact broad mark, large enough to remain recognizable at 32 × 32, but clearly subordinate to the face. Do not add a badge, container, outline, label, extra text, or any new color.
Constraints: change only by adding the chest emblem. Keep one character only. Use no watermark, border, frame, scenery, extra subject, fragile line, sharp tip, tiny decoration, new lighting, new texture, external shadow, or fourth semantic color. Keep the background solid and uniform.
```

### A1

```text
Create one complete full-bleed 1:1 square image.
Background: fill the entire square with solid gently muted eucalyptus teal. Keep this solid eucalyptus teal visible in every open area and in the corners not occupied by the character; the lower-left emergence corner must be occupied by the character.
Subject: place one extremely simplified, cute, endearing personified Markdown paper-sheet spirit on the background, reduced to one soft rounded continuous paper-page silhouette with one defining feature: a single oversized blunt rounded folded forehead corner. The fold is an abstract visual form only, with no symbols or writing.
Complexity: use only 4–7 large basic shapes and at most two broad internal color regions. Use two simple deep-indigo eyes and one tiny deep-indigo mouth. Remove every nonessential line, outline, anatomical detail, texture, decoration, page rule, symbol, and writing. Keep the character readable at 32 × 32.
Color behavior: use exactly three semantic colors in the complete image: warm parchment cream and deep indigo for the character, plus the eucalyptus teal background. Make the broad page body warm parchment cream and the single broad folded-forehead region deep indigo; reuse deep indigo for the facial marks. Keep the character, facial marks, and background clearly separated.
Composition: keep the character upright and emerging from the lower-left, filling about 85–95% of the square so it remains visually dominant. Let the bottom and left edges crop the broad rounded body slightly. Preserve the full rounded forehead fold. Never center or bottom-center the character.
Style: make simplification, cuteness, and lovable baby-like appeal the strongest qualities. Use a large head-like page body, soft cheeks, compact proportions, thick rounded contours, and an ultra-clean graphic treatment. Prefer one clear shape over several explanatory details. Add an extremely, extremely subtle, almost imperceptible sense of depth through a barely-there neo-skeuomorphic treatment.
Finish: show only the character on the full-canvas background, with clean surfaces and normal square outer corners.
Constraints: Use no text, Markdown symbols, letters, code, or watermark. Add no borders, frames, cards, or presentation masks. Include one character only, with no extra subjects or scenery. Use no fragile lines, sharp tips, unnecessary outlines, tiny details, or decorative marks. Add no photorealistic material, dramatic bevel, glossy hotspot, deep occlusion, extrusion, strong three-dimensional rendering, or external cast shadow. Keep the background solid and uniform, with no texture, vignette, or lighting variation.
```

### A2

```text
Create one complete full-bleed 1:1 square image.
Background: fill the entire square with solid gently muted periwinkle lavender. Keep this solid periwinkle lavender visible in every open area and in the corners not occupied by the character; the lower-right emergence corner must be occupied by the character.
Subject: place one extremely simplified, cute, endearing personified Markdown paper-sheet spirit on the background, reduced to one plump soft rounded continuous paper-page silhouette with one defining feature: a broad blunt rounded forehead fold that reads like a soft turned page corner. The fold is an abstract visual form only, with no symbols or writing.
Complexity: use only 4–7 large basic shapes and at most two broad internal color regions. Use two simple midnight-navy eyes and one tiny midnight-navy mouth. Remove every nonessential line, outline, anatomical detail, texture, decoration, page rule, symbol, and writing. Keep the character readable at 32 × 32.
Color behavior: use exactly three semantic colors in the complete image: warm coral-orange and midnight navy for the character, plus the periwinkle-lavender background. Make the broad page body warm coral-orange and the single broad forehead-fold region midnight navy; reuse midnight navy for the facial marks. Keep the character, facial marks, and background clearly separated.
Composition: keep the character upright and emerging from the lower-right, filling about 85–95% of the square so it remains visually dominant. Let the bottom and right edges crop the broad rounded body slightly. Preserve the full rounded forehead fold. Never center or bottom-center the character.
Style: make simplification, cuteness, and lovable baby-like appeal the strongest qualities. Use a slightly wider page silhouette, soft cheeks, compact proportions, thick rounded contours, and an ultra-clean graphic treatment. Prefer one clear shape over several explanatory details. Add an extremely, extremely subtle, almost imperceptible sense of depth through a barely-there neo-skeuomorphic treatment.
Finish: show only the character on the full-canvas background, with clean surfaces and normal square outer corners.
Constraints: Use no text, Markdown symbols, letters, code, or watermark. Add no borders, frames, cards, or presentation masks. Include one character only, with no extra subjects or scenery. Use no fragile lines, sharp tips, unnecessary outlines, tiny details, or decorative marks. Add no photorealistic material, dramatic bevel, glossy hotspot, deep occlusion, extrusion, strong three-dimensional rendering, or external cast shadow. Keep the background solid and uniform, with no texture, vignette, or lighting variation.
```

### B1

```text
Create one complete full-bleed 1:1 square image, approximately 1536 × 1536.
Background: fill the entire square with solid gently muted cornflower blue (#7694C5). Keep this blue visible in every open area and in the corners not occupied by the character; the lower-left emergence corner must be occupied by the character.
Subject: place one extremely simplified, cute, endearing fountain-pen-nib robot character on the background, reduced to one soft rounded continuous silhouette and one defining feature: an oversized broad pen-nib body with a visibly blunt rounded tip and a wide two-eye visor. The pen-nib silhouette must feel friendly, compact, and unmistakable without any thin slit or pointed end.
Complexity: use only 4–7 large basic shapes and at most two broad internal color regions. Use exactly two simple eyes inside the visor and no mouth. Remove every nonessential line, outline, anatomical detail, texture, and decoration. Keep the character readable at 32 × 32.
Color behavior: use exactly three semantic colors in the complete image: coral orange (#F06F5B) as the dominant robot body, deep ink navy (#142B4A) as one continuous visor region and reused for both eyes, plus the cornflower-blue background. Do not introduce white, black, or any fourth semantic color. Keep the robot, facial marks, and background clearly separated.
Composition: keep the character upright and emerging from the lower-left, filling about 85–95% of the square so it remains visually dominant. Cropping at the bottom and left side is welcome when it strengthens the corner emergence. Preserve both eyes. Never center or bottom-center the character.
Style: make simplification, cuteness, and lovable baby-like appeal the strongest qualities. Use a large soft head-like nib form, compact proportions, thick rounded contours, and an ultra-clean graphic treatment. Prefer one clear shape over several explanatory details. Add an extremely, extremely subtle, almost imperceptible sense of depth through a barely-there neo-skeuomorphic treatment.
Finish: show only the character on the full-canvas background, with clean surfaces and normal square outer corners.
Constraints: Use no text or watermark. Add no borders, frames, cards, or presentation masks. Include one character only, with no extra subjects or scenery. Use no fragile lines, sharp tips, unnecessary outlines, tiny details, or decorative marks. Add no photorealistic material, dramatic bevel, glossy hotspot, deep occlusion, extrusion, strong three-dimensional rendering, or external cast shadow. Keep the background solid and uniform, with no texture, vignette, or lighting variation.
```

### B2

```text
Create one complete full-bleed 1:1 square image, approximately 1536 × 1536.
Background: fill the entire square with solid gently muted sage green (#89A993). Keep this green visible in every open area and in the corners not occupied by the character; the lower-right emergence corner must be occupied by the character.
Subject: place one extremely simplified, cute, endearing fountain-pen-nib robot character on the background, reduced to one soft rounded continuous silhouette and one defining feature: a squat bell-shaped pen-nib body with a very broad domed crown, a visibly blunt rounded lower tip, and a wide two-eye visor. The silhouette must feel sturdy and cuddly, with no thin slit or pointed end.
Complexity: use only 4–7 large basic shapes and at most two broad internal color regions. Use exactly two simple eyes inside the visor and no mouth. Remove every nonessential line, outline, anatomical detail, texture, and decoration. Keep the character readable at 32 × 32.
Color behavior: use exactly three semantic colors in the complete image: warm butter yellow (#F2C85B) as the dominant robot body, deep teal (#123F43) as one continuous visor region and reused for both eyes, plus the sage-green background. Do not introduce white, black, or any fourth semantic color. Keep the robot, facial marks, and background clearly separated.
Composition: keep the character upright and emerging from the lower-right, filling about 85–95% of the square so it remains visually dominant. Cropping at the bottom and right side is welcome when it strengthens the corner emergence. Preserve both eyes. Never center or bottom-center the character.
Style: make simplification, cuteness, and lovable baby-like appeal the strongest qualities. Use a broad soft head-like nib form, compact proportions, thick rounded contours, and an ultra-clean graphic treatment. Prefer one clear shape over several explanatory details. Add an extremely, extremely subtle, almost imperceptible sense of depth through a barely-there neo-skeuomorphic treatment.
Finish: show only the character on the full-canvas background, with clean surfaces and normal square outer corners.
Constraints: Use no text or watermark. Add no borders, frames, cards, or presentation masks. Include one character only, with no extra subjects or scenery. Use no fragile lines, sharp tips, unnecessary outlines, tiny details, or decorative marks. Add no photorealistic material, dramatic bevel, glossy hotspot, deep occlusion, extrusion, strong three-dimensional rendering, or external cast shadow. Keep the background solid and uniform, with no texture, vignette, or lighting variation.
```

### C1

```text
Create one complete full-bleed 1:1 square image.
Background: fill the entire square with solid gently muted periwinkle blue (#7D88C9). Keep periwinkle blue visible in every open area and in the corners not occupied by the character; the assigned emergence corner must be occupied by the character.
Subject: place one extremely simplified, cute, endearing slash-command ghost IP character on the background, reduced to one soft rounded continuous chubby ghost silhouette and one defining feature: a single broad blunt diagonal slash region across its front, suggesting fast command editing without using any text or symbol outline.
Complexity: use only 4–7 large basic shapes and at most two broad internal color regions. Use two simple eyes and add one tiny mouth only when it helps the expression. Remove every nonessential line, outline, anatomical detail, texture, and decoration. Keep the character readable at 32 × 32.
Color behavior: use exactly three semantic colors in the complete image: exactly two IP base colors—warm ivory (#FFF0C7) for the main ghost mass and deep plum (#4A285A) for the broad slash region and facial marks—plus the periwinkle blue background. Organize both IP colors into broad purposeful masses, and reuse deep plum for the eyes. Keep the IP, facial marks, and background clearly separated.
Composition: keep the character upright and emerging from the assigned lower-left, filling about 85–95% of the square so it remains visually dominant. Cropping at the bottom or left side is welcome when it strengthens the corner emergence. Preserve both rounded side-arms within the visible composition. Never center or bottom-center the character.
Style: make simplification, cuteness, and lovable baby-like appeal the strongest qualities. Use a very broad domed head, compact heavy body, softly scalloped blunt base, large soft forms, thick rounded contours, and an ultra-clean graphic treatment. Prefer one clear shape over several explanatory details. Add an extremely, extremely subtle, almost imperceptible sense of depth through a barely-there neo-skeuomorphic treatment.
Finish: show only the character on the full-canvas background, with clean surfaces and normal square outer corners.
Constraints: Use no text or watermark. Add no borders, frames, cards, or presentation masks. Include one character only, with no extra subjects or scenery. Use no fragile lines, sharp tips, unnecessary outlines, tiny details, or decorative marks. Add no photorealistic material, dramatic bevel, glossy hotspot, deep occlusion, extrusion, strong three-dimensional rendering, or external cast shadow. Keep the background solid and uniform, with no texture, vignette, or lighting variation.
```

### C2

```text
Create one complete full-bleed 1:1 square image.
Background: fill the entire square with solid gently muted apricot coral (#D98E79). Keep apricot coral visible in every open area and in the corners not occupied by the character; the assigned emergence corner must be occupied by the character.
Subject: place one extremely simplified, cute, endearing slash-command ghost IP character on the background, reduced to one soft rounded continuous chubby ghost silhouette and one defining feature: a single very wide blunt diagonal slash region across its front, suggesting quick command editing without using any text or symbol outline.
Complexity: use only 4–7 large basic shapes and at most two broad internal color regions. Use two simple eyes and add one tiny mouth only when it helps the expression. Remove every nonessential line, outline, anatomical detail, texture, and decoration. Keep the character readable at 32 × 32.
Color behavior: use exactly three semantic colors in the complete image: exactly two IP base colors—deep midnight teal (#123E4A) for the main ghost mass and soft mint cream (#CFE8CF) for the broad slash region and facial marks—plus the apricot coral background. Organize both IP colors into broad purposeful masses, and reuse soft mint cream for the eyes. Keep the IP, facial marks, and background clearly separated.
Composition: keep the character upright and emerging from the assigned lower-right, filling about 85–95% of the square so it remains visually dominant. Cropping at the bottom or right side is welcome when it strengthens the corner emergence. Preserve both broad rounded side-arms within the visible composition. Never center or bottom-center the character.
Style: make simplification, cuteness, and lovable baby-like appeal the strongest qualities. Use a squarer pill-shaped dome, compact heavy body, one broad softly waved blunt base, large soft forms, thick rounded contours, and an ultra-clean graphic treatment. Prefer one clear shape over several explanatory details. Add an extremely, extremely subtle, almost imperceptible sense of depth through a barely-there neo-skeuomorphic treatment.
Finish: show only the character on the full-canvas background, with clean surfaces and normal square outer corners.
Constraints: Use no text or watermark. Add no borders, frames, cards, or presentation masks. Include one character only, with no extra subjects or scenery. Use no fragile lines, sharp tips, unnecessary outlines, tiny details, or decorative marks. Add no photorealistic material, dramatic bevel, glossy hotspot, deep occlusion, extrusion, strong three-dimensional rendering, or external cast shadow. Keep the background solid and uniform, with no texture, vignette, or lighting variation.
```
