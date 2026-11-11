# Image analysis: Freedom (fan build, no wings)

Reference: `ref/sheet.webp`, a 1536×1024 model-sheet photo of one painted plastic kit. Top row: front, left side,
right side, back, 3/4 front, 3/4 back, all at the same scale on a neutral grey sweep. Bottom row: close-ups of head,
chest, shoulder armour, backpack, hand, foot, side skirt with rail cannon, knee, hip, forearm, lower leg, ankle.
Crops used here: `ref/front.png` (x0–330), `ref/side.png` (x470–670), `ref/back.png` (x715–975),
`ref/three-quarter.png` (x975–1235). Each crop is upscaled ×3. Measurements were taken on the front crop with a
30 px grid: fin tip y≈35, sole y≈1460, so **79 px = 1 m** at a total height of 18.03 m. "h" below is metres above
the sole; x is lateral from the centreline; +x is the suit's own left.

## Layer 1: identification

- Work type: a humanoid bipedal mecha (mobile suit), standing in an A-pose. Hard-surface armour plates over a
  mechanical inner frame.
- Classification: articulated machine figure. `primaryDomain`: **hybrid**. It has humanoid anatomy (head, torso,
  two arms, two legs, head-unit proportions), but every surface is hard-surface plating, with no skin, cloth or hair.
- Confidence: 0.97.

## Layer 2: form and silhouette

- Bilateral symmetry about the sagittal plane.
- Front silhouette: an elongated hexagon. The widest point is the shoulders (8.6 m at h 15.1–14.6). The width
  narrows to 2.7 m at the hips (h 11.5), widens again to 6.4 m at the feet (A-pose splay), and the head
  (1.72 m) is the narrowest part above the shoulders.
- Overall height 18.03 m to the fin tip. Shoulder span / height = 0.477.
- Shape language: geometric. Planar facets with chamfered edges, panels are mostly hexagonal or trapezoid in
  outline, and limbs are tapered lofted prisms rather than cylinders.

## Layer 3: macro → meso → micro (measured)

| macro | h top → bottom | width (front) | depth (side) | meso |
|---|---|---|---|---|
| head | 17.55 (camera) / 17.25 (helmet) → 15.45 (chin) | 1.72 | ≈2.5 | helmet shell, forehead camera housing, red crest V, V-visor, amber eyes, mouthpiece, red chin, cheek guards with 3–4 slits, temple pods, occiput |
| V-fin | tips 17.9 (long, x ±1.8), 18.03 (short inner, x ±0.45) | 3.6 span | thin | 2 long blades at ~33° above horizontal, 2 short inner near-vertical blades |
| neck | 15.6 → 15.25 | 0.8 | — | gunmetal, mostly shadowed between the collar towers |
| chest | 15.6 (towers) / 15.3 (centre) → 13.6 | 3.55 | 3.2 (prow 2.5 ahead of shoulder line) | 2 navy pec blocks each with a 1.08×0.89 framed vent (x ±1.14, centre h 14.2); navy collar plate; red band (h 14.6–14.4); dark navy centre column; navy collar towers (x ±1.32) with gunmetal caps |
| lower chest | 13.7 → 12.75 | 2.5 → 1.1 | — | 2 bright-blue panels slanting inward; red hatch block at the V tip (12.75–12.2) |
| waist | 12.2 → 11.7 | 2.3 | — | red cockpit block (front), white side plates, gunmetal belt |
| shoulder armour | 16.0 → 13.9 | 2.3 each, outer edges at x ±4.3 | ≈1.75 | large hexagonal white block tilted ~15° down-outward, red chevron at the upper outer corner, blue marker on the outer face, panel slots and bolts |
| upper arm | 14.3 → 12.6 (elbow) | 1.15 | 1.1 | white tapered plate shell, gunmetal elbow block |
| forearm | 12.5 → 10.4 | 1.45 at the cuff | 1.3 | white shell widening to a deep cuff |
| hand | 10.4 → 8.1 | 1.15 | 0.6 | gunmetal palm, 4 three-segment fingers, open and relaxed |
| front skirts | 11.9 → 9.1 (outer point) | 1.6 each | 0.3 | pointed plates either side of a gunmetal/dark centre block (bottom 8.6) |
| side skirts | 11.8 → 9.5 | — | 1.7 | carry the rail-cannon hinge (gunmetal boss) |
| rear skirt | 11.8 → 9.0 | 2.8 | — | two panels with a dark centre slot |
| rail cannons | hinge h 11.4 at x ±2.0 → red tip h 5.0 at x ±3.9 | 0.6 | 0.9 | grey rail body 7.3 m long, about 15° outward from vertical, trailing ~16° back in side view; red muzzle cap |
| thigh | 9.3 → 8.3 (visible below the skirts) | 1.6 | 1.9 | white shell with a dark recess on the outer face |
| knee guard | 8.5 → 5.1 | 1.8 | 1.9 | a large rounded cap, slotted front, gunmetal drums at the sides |
| shin | 5.1 → 3.0 | 1.45 at its narrowest | 1.8 | tapers below the knee, then flares into the ankle guard |
| ankle guard | 3.0 → 1.65 | 2.5 | 3.3 | faceted collar in a front and a rear flap |
| foot | 1.5 → 0 | 2.4 (toe splayed ~12° outward) | 4.8 | red toe wedge and red heel, white instep with a dark slot |
| backpack | 15.8 → 12.1 | 2.6 | 1.2 | navy box, 2 hex-mounted thruster ports at x ±1.45, a framed slatted centre vent, gunmetal lower band |

## Layer 4: spatial relationships

- `<head, attached-to, neck>` by a socket. The chin sits 0.15 m above the chest's centre collar. The collar towers
  flank the jaw at x ±1.32 without touching it.
- `<pec blocks, flank, centre column>`. Each pec front face yaws about 20° outward. The column is recessed between
  the pecs, and the red band is the most forward point.
- `<shoulder armour, embedded-around, shoulder joint>`. The armour is offset outward and its top tilts down toward
  the outer edge.
- `<rail cannon, hinged-to, side skirt boss>`. It hangs free beside the thigh, clear of the leg by about 0.3 m.
- `<knee guard, overlaps, shin top>`. The guard is wider than the thigh above it and the shin below it.
- `<ankle guard, overlaps, foot>`. The guard collar sits on the foot top. The red toe and heel touch the floor.

## Layer 5: materials (PBR)

- **White armour:** albedo light neutral grey ≈ #d8d9dc, dielectric, roughness ≈ 0.45 (satin lacquer), clear-coat
  highlights, fine engraved panel lines in a darker grey, dark hex bolt heads.
- **Navy:** #2b335c, satin. **Bright blue:** #2e54b6, satin. **Red:** #c3232c, satin. **Yellow fin:** #e2b21f,
  satin to gloss.
- **Gunmetal frame:** #5a5e66, metalness ≈ 0.6, roughness 0.5.
- **Eyes:** emissive amber #ffc23a.
- **Lenses:** dark blue glass.
- **Light weathering:** edge scuffs and grey grime in the panel lines.

## Layer 6: colour and finish

- The palette is dominated by white/light grey (about 70% of the visible area).
- Blue appears only on the chest, the backpack and the shoulder markers.
- Red appears on the crest, chin, chest band, hatch and waist blocks, shoulder chevrons, cannon tips and feet.
- Finish is satin throughout, with no high gloss except the lenses.

## Layer 7: identity-defining features

1. The four-blade V-fin and the red crest V.
2. A tall shield-shaped head with a V visor and amber eyes.
3. The chest: two separated framed vents, the red band between them, and the bright-blue lower V.
4. The large hexagonal shoulder armour with red chevrons, tilted down-outward.
5. The long grey rail cannons hanging at the hips, splayed outward.
6. The big rounded knee guards over slim shins, flaring into faceted ankle guards.
7. The red feet: toe wedge and heel.
8. The A-pose stance: legs splayed so the feet are 6.4 m apart, arms out about 19°, hands open.
9. Dense panel lines and bolts on every white plate.

## Layer 8: uncertainty

- The interior frame is occluded. Only the gunmetal glimpses at the joints are visible.
- The thigh is mostly hidden by the skirts. Its exact upper shape is uncertain.
- The backpack's top surface is hidden in every view (low confidence).
- This is a single photo set of one kit, so the dimensions above carry about ±0.1 m reading error. The side and
  front views disagree by about 0.3 m on the chest prow height.
