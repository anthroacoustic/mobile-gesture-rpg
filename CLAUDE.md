# CLAUDE.md — mobile-gesture-rpg

This file describes the codebase, conventions, and development workflows for AI
assistants working in this repository.

---

## Project overview

A mobile-first gesture-based RPG battle demo built with vanilla JavaScript,
p5.js (graphics), and Tone.js (procedural audio). The player fights two
enemies in a two-round encounter using swipe, tap, and hold gestures.
No server, no build step — open `index.html` in a browser to play.

---

## Running the game

Open `index.html` directly in a browser (any modern desktop or mobile browser).
No npm install, no bundler, no server required.

For desktop testing, mouse events mirror touch events (drag = swipe,
click = tap). On mobile, use actual touch gestures.

---

## Tech stack

| Dependency | Version | Loaded via |
|---|---|---|
| p5.js | 1.9.3 | CDN (cdnjs) |
| Tone.js | 14.7.77 | CDN (cdnjs) |

Everything else is plain ES6 with no transpilation.

---

## Repository structure

```
index.html          — entry point; loads all CDN + JS files in order
js/
  gestures.js       — GestureRecognizer: classifies raw touch events
  player.js         — Player class: HP/MP/stats, damage, healing
  enemy.js          — Enemy class: two visual styles (wraith, phantom)
  ui.js             — UI class: all p5.js rendering helpers
  sound.js          — SoundEngine: procedural FM/Metal/Membrane SFX
  game.js           — Game class: state machine + encounter configs
  sketch.js         — p5.js entry point; routes events to Game
```

Script load order in `index.html` matters — `sketch.js` must be last
(it instantiates `Game`, which depends on all other classes).

---

## Architecture

### State machine (game.js)

`Game` is a finite state machine driven by `STATES` constants:

```
PLAYER_CHOICE
  → GESTURE_ATTACK   (swipe 3-4 directional arrows)
  → GESTURE_MAGIC    (hold to charge, release in target ring)
  → (defend skips to ENEMY_ATTACK)
  → RESOLVE_PLAYER   (80-frame pause)
  → ENEMY_ATTACK     (wind-up + tap-to-block bubbles)
  → RESOLVE_ENEMY    (apply damage, 80-frame pause)
  → PLAYER_CHOICE    (or ENCOUNTER_CLEAR / VICTORY / DEFEAT)

ENCOUNTER_CLEAR      (200-frame celebration, then advance encounter)
VICTORY / DEFEAT     (tap to restart via _init())
```

State transitions always go through `_enterState(next)`, which calls
the corresponding `_setup*()` method. Per-state working data lives in
`this.gesturePhase`, `this.resolvePhase`, or `this.enemyPhase` —
these are plain objects reset on each `_setup*()` call.

### Touch pipeline

```
sketch.js (p5 events)
  touchStarted / touchMoved / touchEnded
  mousePressed / mouseDragged / mouseReleased   ← desktop fallback
    │
    ├─ GestureRecognizer.onTouchStart/Move/End  ← physics classification
    └─ Game.onTouchStart / onTouchMove / onGesture
```

All p5 touch handlers return `false` to call `preventDefault()` and
prevent browser scroll/zoom interference.

iOS Safari clears `touches[]` on `touchend`; `game.lastTouchX/Y` cache
the last known position so `onTouchEnd` has a valid coordinate.

### Gesture types

`GestureRecognizer` emits one of four shapes:

```js
{ type: 'swipe', direction: 'up'|'down'|'left'|'right', speed }
{ type: 'tap',   x, y }
{ type: 'hold',  duration }
{ type: 'none' }
```

Thresholds are constructor constants (`SWIPE_THRESHOLD`, `TAP_MAX_MOVEMENT`,
etc.) — adjust them there if gesture feel needs tuning.

### Encounter configuration

Two encounters are defined in `ENCOUNTERS` (game.js top-level):

```js
ENCOUNTERS[0]  Round 1  Void Wraith  (easier)
ENCOUNTERS[1]  Round 2  Arc Phantom  (harder)
```

Each entry drives timing difficulty via `arrowCount`, `arrowTimeout`,
`tapTimeout`, `bubbleSpeed`, and `bubbleAccel`. Add a third entry to
extend the game.

### Audio (sound.js)

`SoundEngine` creates three Tone.js voices after the first user gesture
(browser autoplay policy). Call `sound.unlock()` on the first tap;
all methods silently no-op before that. The `_magicCharging` flag
prevents overlapping FM holds — call `sound.magicAbort()` if leaving
the magic state without completing a cast.

---

## Code conventions

### Naming

- `PascalCase` for classes (`Game`, `Player`, `SoundEngine`)
- `camelCase` for variables, methods, properties
- `UPPER_SNAKE_CASE` for module-level constants (`STATES`, `MAGIC_COST`, `MAGIC_DURATION`, `ENCOUNTERS`)
- `_` prefix for private/internal methods (`_enterState`, `_setupGestureAttack`, `_buildSynths`)
- `_` prefix also on state-private fields that shouldn't be used externally (`_resolved`, `_sparks`)

### Class patterns

- Layout values in `UI` are `get` accessors so they re-read `p.width`/`p.height`
  on every call and adapt automatically to window resizes
- `get C()` on `UI` returns the colour palette object; reference colours as
  `this.ui.C.pink`, `this.ui.C.bg`, etc.
- Per-state working data is always reset to a fresh object in `_setup*()`
  — never carry stale fields across states

### Rendering loop

`game.update()` runs logic (timers, physics, state transitions);
`game.draw()` calls UI helpers in the correct order for the current state.
Both are called every frame from `p.draw()` in `sketch.js`.
`enemy.update()` runs every frame regardless of state (bob/aura animations).

### Magic numbers

Timing constants belong at the top of `game.js` (`MAGIC_COST`, `MAGIC_DURATION`)
or inside `ENCOUNTERS[]`. Physics constants in `GestureRecognizer` are named
constructor properties. Avoid scattering raw frame counts through logic methods.

### Colour palette

All UI colours live in `UI.get C()`. Use these constants instead of
inline RGB values. Current palette:

| Key | RGB | Usage |
|---|---|---|
| `bg` | 13, 27, 42 | Canvas background |
| `pink` | 247, 168, 192 | Enemy HP bar (full) |
| `pinkDark` | 244, 104, 138 | Enemy HP bar (low), player damage numbers |
| `blue` | 126, 207, 238 | Player attack damage numbers |
| `blueLight` | 200, 238, 255 | Status messages, block prompt |
| `textLight` | 220, 235, 255 | General UI text |
| `white` | 255, 255, 255 | Highlights |

---

## Adding a new enemy

1. Add a new entry to `ENCOUNTERS` in `game.js`:
   ```js
   {
     label:        'Round N',
     enemyName:    'Name',
     createEnemy:  () => new Enemy('Name', hp, atk, [strikeMin, strikeMax], 'wraith'|'phantom'),
     arrowCount:   N,
     arrowTimeout: N,   // frames per arrow (~60fps; 90 ≈ 1.5s)
     tapTimeout:   N,   // frames per block bubble
     bubbleSpeed:  N,   // initial px/frame
     bubbleAccel:  N,   // px/frame² acceleration
   }
   ```
2. No other changes needed — the encounter progression loop reads from `ENCOUNTERS`.
3. To add a third visual style, add a new draw branch to `enemy.js`.

---

## Adding a new game state

1. Add a key to `STATES` (game.js).
2. Add a `case` to `_enterState()`, `update()`, and `draw()`.
3. Implement `_setupX()`, `_updateX()`, `_drawX()`.
4. Add gesture handling in `onGesture()` if the state needs input.

---

## Branches

| Branch | Purpose |
|---|---|
| `claude/mobile-gesture-rpg-game-YczxS` | Game implementation |
| `claude/add-claude-documentation-JYyDj` | Documentation |

Develop on the branch that matches your task. All commits go to the
appropriate feature branch; never push directly to `main`/`master`.

---

## No build, test, or lint tooling

There is no `package.json`, no npm scripts, no test suite, and no linter
configured. The project runs as-is in the browser. If adding tooling:

- A linter (ESLint) would need to be configured for browser globals
  (`p5`, `Tone`, and the class names loaded by `index.html`)
- Tests would require mocking the p5.js canvas API
