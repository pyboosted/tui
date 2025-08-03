Below is a concise, implementation-oriented spec you can drop into an issue tracker. It’s split into stages so you can land “easy wins” first.

---

# Spec: Scene Graph & Optimized Render Pipeline

## Goals
- Introduce a lightweight scene graph (`Renderable`) with z-ordering and dirty-region invalidation.
- Add an `OptimizedBuffer` that batches ANSI operations and minimizes terminal writes.
- Provide a small color model (`Color`) with helpers for truecolor/256-color output.
- Improve text measurement (grapheme width) and diffing performance.
- Establish a predictable input/event model (focus, capture/bubble).
- Keep current public APIs working or supply adapters.

## Non-Goals
- No rewrite of layout to flex/grid (can be a backlog).
- No docs/README overhaul in this change set.
- No examples index aggregator.

---

## Terminology & High-Level Design
- **Renderable:** Node with position, size, zIndex, visibility, and `renderSelf(OptimizedBuffer)`.
- **Renderer:** Orchestrates traversal, z-sort, invalidation, and flush to terminal.
- **OptimizedBuffer:** High-level drawing buffer that coalesces style runs and emits minimal ANSI.
- **Dirty Rects:** Rectangles marking areas requiring repaint; mapped to your existing cell/diff pipeline.

---

## Public API Changes

### 1) `Renderable` Interface (new)
```ts
interface Renderable {
  id: string;
  x: number; y: number; width: number; height: number;
  zIndex: number; visible: boolean;
  dirty: boolean;                   // set by caller to trigger repaint
  invalidateRect?(r: Rect): void;   // optional fine-grained invalidation
  renderSelf(buf: OptimizedBuffer): void;
}
```
**Notes**
- Positioning is absolute for v1. Relative/flow layout may come later.
- `invalidateRect` is advisory; the renderer may expand it to cell boundaries.

### 2) `Renderer` Class (new)
Responsibilities:
- Manage a collection of `Renderable`s.
- Maintain a dirty region set; support `markDirty(node|rect)`.
- Sort by `zIndex` per frame.
- Call `renderSelf` only for nodes intersecting dirty regions.
- Flush `OptimizedBuffer` to terminal; integrate with existing diff renderer.

Key methods:
```ts
add(node: Renderable): void
remove(id: string): void
markDirty(nodeOrRect: Renderable | Rect): void
render(): void
```

### 3) `OptimizedBuffer` (new)
Purpose: batch operations, reduce ANSI churn.
Core API:
```ts
moveTo(x: number, y: number): void
setAttrs(attrs: Attrs): void            // fg/bg/bold/italic/underline
write(text: string): void               // no newline implicit
fill(x: number, y: number, w: number, h: number, char: string): void
drawText(x: number, y: number, text: string, attrs?: Attrs): void
flush(): void                           // emits minimal ANSI to terminal
```
Implementation details:
- Maintain current cursor/attrs; coalesce consecutive same-attr writes.
- Optional line-run grouping: pack contiguous text into one write.
- Provide `toCells()` adapter so existing diff engine can consume the frame.

### 4) `Color` Utilities (new)
```ts
type RGBA = { r: number; g: number; b: number; a?: number }
toTrueColor(rgba: RGBA): AttrFgBg
toAnsi256(rgba: RGBA): number
parseColor(input: string | number): RGBA // '#rrggbb', '#rgb', 0xrrggbb
```
- Detect terminal capabilities once; prefer truecolor, fallback to 256, then 16.
- Caching for 256-palette quantization.

### 5) Event & Focus Model (new minimal)
- **Events:** `KeyEvent`, `MouseEvent`, `FocusEvent`.
- **Dispatch:** Renderer routes to the topmost hit `Renderable`; bubbling up via parent chain.
- **Focus:** Single focused node; `focus(nodeId)`, `blur()`.
- **Capture:** Optional `capture: boolean` to intercept before bubble.

### 6) Grapheme Width & String Ops
- Provide `measure(text: string): { cells: number }` handling:
  - Unicode grapheme clusters, combining marks, ZWJ sequences, emoji.
  - East Asian width (full/half), surrogate pairs.
- Add an LRU cache keyed by string or codepoint sequence.
- Hook into `OptimizedBuffer.drawText` and diff pipeline.

### 7) Diff Pipeline Enhancements
- Accept dirty rectangles from `Renderer` to limit diff scope.
- Optionally switch from full-frame to **rect-scoped diff** when dirty set is small.
- Pluggable strategy: `diffStrategy: 'full' | 'rect' | 'auto'`.

---

## Internal Modules & Files (suggested)
- `core/renderable.ts`
- `core/renderer.ts`
- `core/scene.ts` (optional: parent/child relations)
- `render/optimizedBuffer.ts`
- `render/attrs.ts` (bitflags for bold/italic/underline/inverse)
- `color/color.ts`
- `text/grapheme.ts` (pure implementation + cache)
- `text/width.ts`
- `diff/strategy.ts` (full/rect/auto)

---

## Performance Targets
- **ANSI reductions:** ≥30% fewer writes on typical UI updates (lists, cursor move).
- **Partial updates:** when ≤10% area is dirty, frame time ≤50% of full diff.
- **Throughput:** sustain 60 FPS on 120×40 with 5% area changing.
- **Grapheme width cache hit rate:** ≥90% in steady-state typing.

---

## Backward Compatibility & Migration
- Existing low-level draw API remains; `Renderer`/`Renderable` are additive.
- Provide adapter: existing widgets can wrap into a `Renderable` via a thin class using their current draw function.
- Flag-gate new diff strategies with defaults preserving current behavior.

---

## Telemetry & Debugging
- Add `TRACE_RENDER=1` env flag to log:
  - Dirty rects chosen, nodes rendered, ANSI write counts.
- Expose `getStats(): RenderStats` from `Renderer`:
  - `frames`, `nodesDrawn`, `dirtyArea`, `ansiWrites`, `flushTimeMs`.

---

## Testing Plan
**Unit**
- `optimizedBuffer`: coalescing, cursor moves, attr resets, flush minimality.
- `color`: hex parse, 256 mapping, truecolor fallback.
- `width`: grapheme clusters (emoji + ZWJ), combining marks, East Asian wide.
- `diff`: rect-scoped correctness vs full diff.

**Integration**
- Snapshot tests of multi-layer scenes (zIndex ordering, occlusion).
- Focus and event propagation (capture/bubble order).
- Capability fallback (truecolor → 256 → 16).

**Benchmarks (automated)**
- Render 120×40 grid with 1%, 5%, 10% dirty; record fps and ANSI bytes.
- Typing scenario: append chars to a single line; measure writes per key.

---

## Milestones

**Stage 1 (Easy Wins)**
- `Renderable`, `Renderer` (absolute positioning, zIndex).
- `OptimizedBuffer` with run coalescing and `flush()`.
- Dirty rects (node-level), `markDirty`.
- `Color` utilities + capability detection.
- Rect-scoped diff.

**Stage 2**
- Grapheme cluster width + caching; integrate into draw/diff.

**Stage 3**
- Event model (focus, capture/bubble), hit-testing for mouse.

---

## Acceptance Criteria
- A simple multi-node scene updates with correct z-ordering and no flicker.
- On a typing benchmark, ANSI write count drops vs current baseline.
- Dirty rect updates repaint only affected nodes.
- With terminal set to 256 colors, visuals remain consistent.
- Tests and benches pass in CI on Linux/macOS/Windows.

---

## Risks & Mitigations
- **Unicode correctness:** start with conservative algorithm + test corpus; cache aggressively.
- **Terminal quirks:** centralize capability detection and attr resets; provide feature flags.

---

## Open Questions
- Do we want parent/child transforms (local→global coords) in v1, or flat list only?
- Should `OptimizedBuffer` expose a “diff-ready” frame format to bypass conversion?
- Event propagation order when nodes overlap but share zIndex (stable order by creation time?).

