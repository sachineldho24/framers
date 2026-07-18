## Footage map and measurement basis

The recording contains **three distinct websites**:

| Site |       Footage range | Working label            |
| ---- | ------------------: | ------------------------ |
| A    | **0:00.00–0:25.95** | Pearl-tea journey        |
| B    | **0:25.95–0:43.64** | Luxury cliff-house       |
| C    | **0:43.64–0:59.82** | EV manufacturing journey |

The capture is **1280 × 648**, an unusually wide **1.98:1 desktop viewport**. No mobile viewport appears in the footage.

Composition percentages below are projected screen-area estimates, generally accurate to about **±5–10 percentage points** because many subjects have soft vegetation, transparent glass, fog, or depth-of-field edges. “Subject fill” refers to the principal environment/object, not the persistent navigation UI.

---

# Site A — pearl-tea journey

## 1. Scene inventory

There are **six narrative sections**, with roughly eight distinguishable camera setups.

| # |   Approx. range | Scene label                      | World model                  |
| - | --------------: | -------------------------------- | ---------------------------- |
| 1 | 0:00.00–0:04.35 | Hills/farm → drying tables       | A floating farm diorama      |
| 2 | 0:04.35–0:07.78 | Pearl kitchen/factory            | Separate factory diorama     |
| 3 | 0:07.78–0:12.08 | Shop exterior → cutaway interior | Separate storefront diorama  |
| 4 | 0:12.08–0:16.84 | Delivery town → rider route      | Separate town island         |
| 5 | 0:16.84–0:20.88 | Community plaza → diners         | Separate market/plaza island |
| 6 | 0:20.88–0:25.95 | Finished drink → macro product   | Isolated product stage       |

These are **self-contained islands**, not one metrically coherent connected world. The implementation hides that fact by pulling back from one island and immediately diving into or revealing another.

## 2. Composition

### Scene 1 — farm

* Initial island is centered slightly right, with its visual center around **55–60% of viewport width**.
* The island occupies approximately **45% of the viewport** in the opening hold, growing to **70–80%** during the push toward the drying tables.
* Cream background/negative space begins around **45–50%**, dropping to about **20–25%** at maximum proximity.
* Copy is in the **lower-left**, separate from the island rather than over important geometry.
* Copy lane is approximately **16–19% of viewport width**. The entire copy block uses roughly **10–14% of viewport height**.
* Headline size is around **3–4% of viewport height per line**.

### Scene 2 — pearl kitchen

* Factory island begins almost centered, then shifts slightly right as the camera approaches.
* The environment fills approximately **50–55%** at the reveal and **80–90%** in the worker close-up.
* Copy remains in a protected left lane, around **16–18% wide**, partly over a pale fog/gradient.
* At the close-up, the factory workers and tanks consume almost the whole frame; usable negative space falls below **15%**.

### Scene 3 — shop

* Exterior storefront is centered to center-right.
* Wide storefront occupies roughly **45–55% of the viewport**, leaving **30–40% pale negative space**, primarily on the left.
* Once the façade becomes a cutaway, the shop interior expands to approximately **70–80%** of the viewport.
* Copy is lower-left and approximately **17–20% wide**.
* The building is deliberately kept clear of the leftmost fifth of the screen until the camera enters it.

### Scene 4 — delivery

* The complete town island occupies roughly **60–70%** of the screen, centered.
* During the rider-following shot, the environment fills **80–90%**, but the rider itself is only about **4–7% of viewport area**.
* The route is positioned along the centerline or slightly right of center, with the copy still anchored left.
* Negative space is not truly empty in the route shot; it is instead low-detail vegetation and blurred buildings.

### Scene 5 — community plaza

* Wide plaza island occupies approximately **55–65%** of the viewport and is nearly centered.
* The push toward the diners increases the environment fill to **85–95%**.
* Human figures collectively occupy around **25–35%** in the closest shot.
* Copy remains lower-left, around **16–19% wide**, initially over cream space and later over a pale foreground blur.
* The close-up uses foreground flowers and the fountain as soft framing masks.

### Scene 6 — hero drink

* At reveal, the cup is centered slightly right and occupies only **20–30% of viewport area**.
* This leaves approximately **55–65% deliberate cream negative space**, with decorative berries and leaves filling another 10–15%.
* The camera then pushes the cup to **70–90% fill**, ending on a near-macro lid/top view.
* Copy remains lower-left, approximately **17–20% wide**, and never crosses the central cup silhouette.
* This is the strongest conventional product-ad composition in the site: isolated hero object, fixed copy lane, progressive macro reveal.

### Desktop versus mobile

Only desktop is shown. The compositions are heavily dependent on the nearly 2:1 frame and a persistent left copy lane. There is no evidence in the footage of how the floating islands or wide copy/subject separation are reframed on mobile.

## 3. Camera motion per scene

| Scene    | Motion                                                                                               | Magnitude                                                    |
| -------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Farm     | Diagonal Z-axis push-in from island overview to drying tables, with slight lateral drift             | **Aggressive**, approximately 2.5–3× apparent scale increase |
| Kitchen  | Push into the center of the factory, ending on workers and vessels                                   | **Aggressive**, approximately 2× scale increase              |
| Shop     | Mild push on exterior, then a stronger spatial penetration/cutaway into the interior                 | **Moderate → aggressive**                                    |
| Delivery | Pull out to town overview, then dive toward and follow the rider                                     | **Aggressive**, with strong depth change                     |
| Plaza    | Pull-back/reframe to a new island, then push into the diners; slight pull-back before product reveal | **Moderate to aggressive**                                   |
| Cup      | Vertical reveal, push-in, slight orbit/tilt, then macro dive toward cup top                          | **Very aggressive**, approximately 3–4× scale change         |

There are no static scenes during active scrolling. The apparently static moments are user-scroll holds rather than autonomous pauses.

## 4. Transitions

The internal transitions use almost no conventional opacity blending.

|   Approx. timestamp | From → to                     | Classification                               | Technical reading                                                                                                                                                                                                  |
| ------------------: | ----------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **0:04.25–0:04.45** | Farm tables → factory island  | **Spatial dive — reverse/pull-back variant** | Camera rapidly pulls away from the farm; the next island is revealed in the same pale space. No visible opacity blend. Mostly seamless, though the scale reset is perceptible.                                     |
| **0:07.28–0:07.84** | Factory → shop                | **Spatial dive**                             | A giant cup/roof-like object, miniature structure, foliage and foreground customers progressively mask the factory while the storefront is revealed. This is the site’s best seam.                                 |
| **0:10.20–0:10.75** | Shop exterior → shop interior | **Spatial dive**                             | Camera advances into the façade while the exterior shell becomes a cutaway. It is not a normal door traversal; geometry is effectively removed around the camera. Seamless in motion, visibly “magical” spatially. |
| **0:11.96–0:12.12** | Shop interior → delivery town | **Spatial dive — reverse/pull-back variant** | The shop contracts into one building inside a larger town island. No fade. Very clean because the same building remains the visual anchor.                                                                         |
| **0:16.70–0:16.90** | Delivery town → plaza         | **Spatial dive — pull-back then re-entry**   | The town recedes, slides away, and the camera settles into the plaza island. Smooth, but the island substitution is noticeable.                                                                                    |
| **0:20.78–0:21.00** | Plaza → hero cup              | **Spatial dive / foreground reveal**         | The cup rises from the lower foreground as the plaza falls behind it and becomes hidden. No double exposure. Very seamless.                                                                                        |
|         **0:25.95** | Site A → Site B               | **Hard cut**                                 | Full visual and stylistic reset. Clearly breaks flow because this is the boundary between websites.                                                                                                                |

**Dominant transition type:** spatial dives and reverse spatial pull-backs.

There are **no clear speed-matched crossfades** inside Site A. The continuity comes from foreground occlusion, shared anchors and continuous camera acceleration rather than alpha blending.

## 5. Art direction

Dominant palette:

* Warm cream: **#F4E8D8**
* Pale peach/beige: **#E4CBB8**
* Lavender: **#9A78B8**
* Dark purple: **#6F4F8F**
* Sage green: **#89966D**
* Cocoa brown: **#5B3F2F**

Lighting is high-key and diffuse, similar to a large softbox. Shadows are soft but there is pronounced ambient occlusion beneath buildings, trees and characters.

Rendering style is:

* Stylized miniature/clay render
* Three-quarter isometric-like camera angles
* Rounded, matte geometry
* Simplified facial and clothing detail
* Strong model-diorama scale cues
* Shallow-to-medium depth of field
* Mild tilt-shift impression, especially in wide island shots
* Soft foreground vegetation used as transition masks

Textures are low-frequency and tactile rather than photoreal: painted plaster, matte plastic, clay vegetation and slightly rough wood.

## 6. Scroll feel

* The video is clearly **scrubbed by scroll**, not autonomously playing. The final cup frame remains motionless for more than two seconds when scrolling stops.

* During active movement, frames appear to **lag the raw scroll target slightly**, consistent with a damped interpolation such as:

  `currentFrame += (targetFrame - currentFrame) × smoothing`

* The footage does not expose wheel or touch input, so the exact latency cannot be measured.

* Short visual plateaus of approximately **0.2–0.5 seconds** appear between scroll bursts.

* There is **no hard snapping to scenes**. Copy and chapter indicators change around thresholds, but camera movement continues through them.

* Of the three sites, this one feels the most deliberately eased: motion accelerates into dives and settles gently into island-wide compositions.

---

# Site B — luxury cliff-house

## 1. Scene inventory

There are **six principal sections**, plus one additional cut inside the arrival sequence.

| # |   Approx. range | Scene label                                   |
| - | --------------: | --------------------------------------------- |
| 1 | 0:25.95–0:31.68 | Exterior arrival → entry corridor → courtyard |
| 2 | 0:31.68–0:33.94 | Great room / “view walks in”                  |
| 3 | 0:33.94–0:35.74 | Kitchen and dining island                     |
| 4 | 0:35.74–0:38.18 | Bedroom → balcony                             |
| 5 | 0:38.18–0:40.26 | Indoor pool / private resort                  |
| 6 | 0:40.26–0:43.64 | Exterior lounge → infinity pool and horizon   |

Conceptually, this is **one connected architectural property**. Technically, it is not a single connected camera path. It is a sequence of independently composed ArchViz shots joined with composition- and velocity-matched hard cuts.

## 2. Composition

The visual is full-bleed in every scene. “Negative space” is usually a dark wall, glass panel or low-detail gradient reserved for copy rather than an empty background.

### Scene 1 — exterior arrival

* Architecture fills **90–100%** of the viewport.
* The main entrance is nearly centered, generally around **50–56% of viewport width**.
* The central doorway/opening occupies about **15–25% of the frame**, creating a strong tunnel target.
* Text sits in the **lower-left**, over a dark gradient or shadowed paving.
* Reserved copy lane is approximately **19–23% wide**.
* The headline occupies about **4–5% of viewport height per line**; entire copy stack is about **18–22% high**.

### Scene 2 — great room

* The room is full-bleed and fills effectively **100%** of the viewport.
* Main vanishing point is close to the horizontal center.
* Horizon and windows occupy the central/right **35–45%**.
* Furniture is concentrated in the lower middle third.
* A darkened left edge, roughly **18–22% of viewport width**, protects the overlaid copy.
* There is less than **5–10% true empty space**.

### Scene 3 — kitchen

* Kitchen island runs from lower center toward the center-right and occupies **25–35% of viewport area**.
* The complete architectural environment remains full-bleed.
* Visual weight is slightly right-heavy: wood cabinetry and island on the right, dark copy lane on the left.
* The outdoor horizon is held near the center, which helps hide the preceding cut.
* Copy uses approximately **20% of the viewport width**.

### Scene 4 — bedroom

* Bed and seating occupy the left/center **25–35%**.
* Balcony opening and mountain view occupy the right **35–45%**.
* Vertical wall or door geometry around **35–45% of viewport width** creates a natural wipe line.
* Copy remains lower-left in a darkened area.
* Subject/environment fill is still **100%**, but the room’s dominant objects occupy around **55–65%**.

### Scene 5 — indoor pool

* Pool creates a long diagonal/central perspective through the lower **20–30%** of the image.
* Glass wall dominates the left half; lounge furniture sits right.
* The environment fills the viewport edge to edge.
* Copy lane is the dark lower-left **18–22%**.
* Strong horizontal rails and window mullions are used to match the cuts before and after it.

### Scene 6 — exterior lounge/infinity pool

* House mass is on the right and occupies approximately **25–35%**.
* Infinity pool, mountain silhouette and sky occupy **60–70%**.
* The copy block is lower-left, over sky/mountain and a black gradient.
* The horizon remains near the vertical middle.
* The frame is more open than previous scenes, but there is still very little literal empty space.

### Desktop versus mobile

No mobile version is visible. These shots are all composed for a wide cinema-like frame. The fixed left overlay and long horizontal architecture would require substantial reframing or alternate video renders for portrait mobile; the footage does not show how that is handled.

## 3. Camera motion per scene

| Scene           | Motion                                                                                        | Magnitude              |
| --------------- | --------------------------------------------------------------------------------------------- | ---------------------- |
| Arrival         | Straight push toward entrance, forward passage through corridor, then continued central dolly | **Aggressive**         |
| Great room      | Forward dolly with a small rightward drift                                                    | **Moderate**           |
| Kitchen         | Lateral truck to the right plus slight forward movement along island                          | **Moderate**           |
| Bedroom         | Rightward truck and push toward balcony                                                       | **Moderate**           |
| Pool            | Lateral glide along the pool’s length                                                         | **Moderate**           |
| Exterior lounge | Lateral/orbiting move toward infinity edge and horizon                                        | **Subtle to moderate** |

Camera speed is intentionally similar on both sides of every cut. The spatial positions jump, but screen-space motion direction usually does not.

## 4. Transitions

Frame inspection at approximately 20 ms intervals shows no sustained alpha overlap. These are **hard cuts**, not speed-matched crossfades.

| Approx. timestamp | From → to                                                   | Classification | Seam quality                                                                                                                    |
| ----------------: | ----------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
|       **0:29.46** | Entry corridor → courtyard/living façade                    | **Hard cut**   | Centered doorway and forward velocity match, but room scale jumps visibly.                                                      |
|       **0:31.68** | Close living-room approach → reset to wider great-room view | **Hard cut**   | Noticeable spatial reset. Matching ceiling and horizon keep it from feeling jarring.                                            |
|       **0:33.94** | Great room → kitchen                                        | **Hard cut**   | Rightward/forward motion continues, and cabinetry occupies the same screen region. Moderately seamless.                         |
|       **0:35.74** | Kitchen → bedroom                                           | **Hard cut**   | Dark vertical wall is matched across the cut. The environment changes instantly, but the wipe-like wall hides part of the jump. |
|       **0:38.18** | Bedroom/balcony → indoor pool                               | **Hard cut**   | Strong vertical frame and horizontal perspective lines are matched. Still identifiable as a cut.                                |
|       **0:40.26** | Indoor pool → exterior lounge                               | **Hard cut**   | Window mullion, sunlight and left-to-right glide are aligned. Best of this site’s room-to-room cuts.                            |
|       **0:43.64** | Site B → Site C                                             | **Hard cut**   | Complete site change.                                                                                                           |

**Dominant transition type:** hard cuts disguised as match cuts.

The key technique is not opacity. It is:

1. Maintain the same camera travel direction.
2. Match a vertical architectural line near the cut.
3. Keep horizon height nearly fixed.
4. Preserve similar light direction and color temperature.
5. Cut while part of the frame is dark or geometrically simple.

## 5. Art direction

Dominant palette:

* Near-black brown: **#19120D**
* Espresso wood: **#332317**
* Medium walnut: **#6D513E**
* Warm taupe: **#AE927B**
* Pale stone: **#D6BFA9**
* Warm off-white: **#EBE5DE**
* Sunset amber accent: approximately **#D88A42**

Rendering style is premium photoreal **architectural visualization**:

* Golden-hour exterior light
* Warm practical interior lights
* High dynamic range
* Polished stone and glass
* Detailed wood grain
* Physically plausible reflections
* Mostly deep focus
* No meaningful tilt-shift
* Limited depth-of-field blur
* Strong exposure gradients added behind copy

The interior/exterior temperature match is deliberately controlled so that every room remains in the same warm bronze family.

## 6. Scroll feel

* Motion is input-driven and stops completely at the end of the property sequence.
* Compared with Site A, camera speed feels more **constant and linear** inside each shot.
* There is probably mild frame-target smoothing, but less visibly elastic easing.
* There is no section snapping. The shot simply crosses a frame boundary and hard-cuts to the next MP4 shot.
* Because the camera velocity remains consistent across cuts, the movement can feel continuous even though the geography is not.
* This site is likely the easiest to reproduce with one edited master MP4: render separate shots, match their terminal and initial velocity, then concatenate with single-frame cuts.

---

# Site C — EV manufacturing journey

## 1. Scene inventory

There are **six narrative chapters** and five major visual handoffs.

| # |                 Approx. range | Scene label                                   | World model                                   |
| - | ----------------------------: | --------------------------------------------- | --------------------------------------------- |
| 1 |  0:43.64–approximately 0:45.8 | Renewable energy field / “before it is a car” | Exterior industrial landscape                 |
| 2 |   approximately 0:45.8–0:47.1 | Factory approach → battery-cell testing       | Physically linked through factory entrance    |
| 3 |   approximately 0:47.1–0:48.1 | Cell line → aerodynamic/finished-car reveal   | Linked through an interior doorway            |
| 4 |   approximately 0:48.1–0:51.1 | Finished car → robotic body assembly          | Editorially linked through car-body occlusion |
| 5 |  approximately 0:51.1–0:53.15 | Factory exit → proving ground                 | Physically linked through hangar opening      |
| 6 | approximately 0:53.15–0:59.82 | Side tracking → rear road chase               | Same vehicle and road environment             |

This is the closest to **one continuous connected journey**. Some spaces are probably separate renders, but doors, hangar openings and the vehicle itself create plausible spatial connections.

## 2. Composition

### Scene 1 — renewable field

* Full-bleed landscape; total environment fill is effectively **100%**.
* Road begins at the lower center and points to a centered factory building.
* Main turbine sits around **55–65% of viewport width** and occupies roughly **10–15% of frame area**.
* The road and vanishing-point structure occupy about **15–20%**.
* Copy is lower-left within a dark teal gradient, approximately **20–23% wide**.
* The principal subject is not a single object; the entire energy landscape is the subject.

### Scene 2 — cell line

* Conveyor line runs from the bottom center/right toward the upper center.
* Machinery fills approximately **75–90%** of the viewport.
* Repeating cells cover around **20–30%** of the image.
* Copy remains lower-left, using a dark teal overlay around **21–24% wide**.
* Perspective is intentionally central so the exterior road can transition into the conveyor line.

### Scene 3 — car/aero reveal

* The car initially appears small inside the distant doorway, around **4–6% of frame area**.
* It grows to approximately **25–35%** on the turntable.
* During the close lateral pass it reaches **60–70% of the viewport**, primarily center-right.
* Leftmost **20–25%** remains protected for copy.
* Negative space is the clean factory wall and floor rather than an empty background.

### Scene 4 — robotic assembly

* Body shell and robots occupy approximately **65–85%**.
* Main vehicle shell sits center to center-right.
* Robot arms enter from upper left and upper right, creating a tunnel around the body.
* Copy remains fixed in the lower-left **20–23%**.
* Metallic geometry and sparks increase local detail, but the left overlay suppresses it behind the text.

### Scene 5 — proving ground

* At the hangar exit, the dark factory wall occupies roughly **25–35%** of the left side.
* Exterior road and mountains occupy the remaining **65–75%**.
* The car begins very small, around **3–5%**, then grows to approximately **20–30%** during the approach.
* Copy sits over the dark interior side, producing very high legibility without a separate column.

### Scene 6 — road performance

* During the close side pass, the car reaches **55–70% of viewport area** and extends beyond the frame edges.
* During the rear chase, it drops to around **5–8%**, centered slightly left or near center.
* Road and sky fill the entire image.
* Copy remains lower-left at approximately **20–22% width**.
* The final chase composition has extremely large environmental scale: roughly **90% road/sky/landscape**, **5–8% vehicle**, with the remainder UI.

### Desktop versus mobile

No mobile view is shown. The site relies on wide roads, horizontal vehicle profiles and a persistent left copy lane. A portrait implementation would need alternate framing or a different video crop; none appears in the recording.

## 3. Camera motion per scene

| Scene            | Motion                                                                               | Magnitude                                     |
| ---------------- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| Renewable field  | Forward drive down the center road                                                   | **Moderate → aggressive**                     |
| Cell testing     | Direct forward dive through factory door and along conveyor                          | **Aggressive**                                |
| Aero/car reveal  | Continued push through interior door, then lateral truck/orbit around car            | **Aggressive**                                |
| Assembly         | Camera passes behind/over foreground vehicle geometry, then glides across robot line | **Aggressive**                                |
| Proving ground   | Forward threshold pass out of hangar, then lateral tracking toward approaching car   | **Aggressive**                                |
| Road performance | Car approaches camera, camera matches side speed, then swings into a rear chase      | **Very aggressive at handoff, then moderate** |

The camera repeatedly uses centered vanishing points followed by lateral automotive tracking. This provides strong directional continuity even as the environment changes.

## 4. Transitions

|                 Approx. timestamp | From → to                                            | Classification                                 | Technical reading                                                                                                                                                                         |
| --------------------------------: | ---------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|               **0:46.56–0:46.60** | Renewable/factory exterior → cell factory interior   | **Threshold pass**                             | Camera moves through a visible rectangular factory entrance. Doorframe remains visible at the edges while the interior takes over. Extremely seamless.                                    |
|               **0:47.88–0:48.00** | Cell conveyor → car turntable                        | **Threshold pass**                             | The finished car is visible through the next doorway before the camera crosses it. Same centered vanishing point and forward velocity. Extremely seamless.                                |
|               **0:49.00–0:49.04** | Finished car close-up → body assembly line           | **Spatial dive**                               | The foreground vehicle body/roof fills the lower frame and hides the switch to the assembly shell behind it. No opacity blend. Very seamless.                                             |
|               **0:51.72–0:52.04** | Robotic assembly → exterior proving ground           | **Threshold pass**                             | Hangar doors/opening reveal the road progressively. Camera exits through the real opening rather than cutting to a clean exterior frame. Extremely seamless.                              |
| **Approximately 0:53.10–0:53.40** | Proving-ground approach → side-tracking road chapter | **No edited seam; continuous spatial handoff** | The chapter/copy changes while the car passes close to camera. Nearest structural equivalent is a spatial-dive/foreground-occlusion handoff, but there is no visible opacity cut or jump. |
|                       **0:43.64** | Site B → Site C                                      | **Hard cut**                                   | Website boundary.                                                                                                                                                                         |

**Dominant transition type:** threshold passes, supported by foreground spatial dives.

There are no visible speed-matched crossfades. The scene replacements happen behind real geometry or while crossing a doorway.

## 5. Art direction

Dominant palette:

* Deep teal: **#172F2B**
* Dark green-gray: **#364944**
* Steel blue-gray: **#6D8384**
* Pale industrial gray: **#9AACAA**
* Off-white metal: **#D8DAD4**
* Warm sun/sand: **#CBB998**
* Lime UI accent: approximately **#B8E43C**

Rendering style is cinematic automotive/industrial CGI:

* Teal-and-warm-sun color separation
* Cool fluorescent factory lighting
* Volumetric exterior sunlight
* Controlled lens flare during vehicle pass
* Metallic and glass reflections
* Moderate motion blur in the road scene
* Crisp product surfaces
* Medium depth of field
* No tilt-shift
* More physically realistic texture detail than Site A, but still polished beyond documentary footage

The fixed teal vignette on the left is both an art-direction device and a stable text-safe region.

## 6. Scroll feel

* The motion is frame-scrubbed and stops when the scroll stops.
* Of the three sites, it appears to have the **tightest apparent relationship between scroll and frame progression**.
* There is likely still a small interpolation layer; acceleration into the doorway dives is smooth rather than quantized.
* No scene snapping is visible.
* Chapter text changes can occur while one continuous shot is still moving, especially around the proving-ground/road handoff.
* The major transitions have enough pre-roll and post-roll that even a moderately damped frame mapping will not strand the camera halfway through an opening.

---

# Comparison

| Site              | Subject framing                                                                                                                       | Scene model                                        | Dominant transition                              | Palette                                                  | Overall immersion                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **A — pearl tea** | Center/right floating subjects, typically **45–85% fill**, with a dedicated cream left copy lane; hero cup ranges from **20% to 90%** | Separate miniature islands/dioramas                | **Spatial dives and reverse pull-back reveals**  | Cream, peach, lavender, sage, cocoa                      | High and playful; transitions feel magical, but island/scale substitutions expose the constructed nature of the world |
| **B — house**     | Full-bleed architecture, effectively **90–100% environment fill**; copy over darkened left **18–23%**                                 | One conceptual property, but separate edited shots | **Hard match cuts**                              | Espresso, walnut, taupe, pale stone, sunset amber        | Medium-high; constant velocity helps, but spatial resets remain visible                                               |
| **C — EV**        | Full-bleed environment, focal vehicle/machinery varies from **5% to 85%**; stable dark teal left copy lane                            | Mostly connected process journey                   | **Threshold passes plus occluded spatial dives** | Deep teal, steel gray, pale metal, warm sun, lime accent | Highest; geometry, velocity and vanishing point stay continuous through nearly every environment change               |

# Which transitions are most seamless?

**Site C is the most seamless overall.**

The reason is reproducible and compositional:

1. **Incoming scenes are visible before the transition.**
   At both factory-door seams, the viewer can already see the next room through the opening.

2. **The transition geometry occupies the same screen position.**
   Doors are centered or slightly right of center; the road, conveyor and room share nearly the same vanishing point.

3. **Camera direction and screen-space speed do not change.**
   The camera is moving forward before, during and after the doorway.

4. **The cut or scene replacement occurs under occlusion.**
   Doorframes or the car body cover a substantial part of the viewport when the underlying world changes.

5. **The copy remains in a fixed 20–23% left lane.**
   Text does not have to animate across the seam, so the eye stays anchored while the environment changes.

To reproduce that structure:

* Put the outgoing and incoming portal at the same **50–60% horizontal position**.
* Keep horizon/vanishing-point height within roughly **2–3% of viewport height** across the seam.
* Match forward or lateral screen-space velocity on both sides.
* Let a doorway, wall, vehicle or other foreground object cover at least **40–60% of the frame** at the replacement point.
* Replace the scene under that occlusion.
* Do not use opacity unless there is no usable geometry; neither Site A nor Site C depends on visible crossfading.

The **single strongest individual transition** is arguably Site A’s factory-to-shop seam around **0:07.28–0:07.84**, because the giant cup, roof form, foliage and customers provide several consecutive occlusion layers. But Site C is more consistently seamless from section to section because its threshold geometry is physically plausible rather than a miniature-world transformation.
