# @hexie/tui Examples

This directory contains examples demonstrating various features of the @hexie/tui library.

## Running Examples

From the project root:

```bash
bun run packages/tui/examples/<example-name>.ts
```

## Available Examples

### Basic Usage
- `basic.ts` - Simple demo with borders and text
- `text-attributes.ts` - All text styling options
- `colors.ts` - 256-color and 24-bit color support

### Animation & Updates
- `animation.ts` - 60 FPS animations with synchronized updates
- `progress-bar.ts` - Various progress indicators and spinners

### Layout & UI
- `box-drawing.ts` - Unicode box drawing characters
- `layout.ts` - Complex dashboard layout
- `menu.ts` - Menu systems and dialogs (visual only)
- `charts.ts` - Simple data visualization

### Terminal Features
- `resize-test.ts` - Terminal resize handling demo
- `simple-resize.ts` - Minimal resize example
- `clear-test.ts` - Screen clearing demonstration

### Performance
- `benchmark.ts` - Performance testing and metrics

### Input Handling

#### Keyboard Events
- `kitty-events.ts` - Visual keyboard event table with full Kitty protocol support
- `test-function-keys.ts` - F1-F12 key testing with event types
- `test-modifiers-nav.ts` - Modifier combinations with navigation keys
- `test-escape-modifiers.ts` - Ctrl+Escape, Meta+Escape handling
- `test-all-quirks.ts` - Comprehensive terminal quirks test
- `keyboard-demo-complete.ts` - Full-featured keyboard demo

#### Mouse Events
- `mouse-events.ts` - Visual mouse event table with SGR protocol
- `test-mouse-features.ts` - All mouse capabilities test
- `test-mouse-protocols.ts` - X10 vs SGR protocol comparison
- `input-events-combined.ts` - Split-screen keyboard and mouse events

#### Paste & Clipboard
- `paste-events.ts` - Visual paste event demo with real clipboard operations
- `clipboard-demo.ts` - Simple demo of system clipboard integration using OSC 52
- `clipboard-read-test.ts` - Test clipboard reading functionality using system commands
- `test-osc52.ts` - Test if your terminal supports OSC 52 clipboard operations
- `test-bracketed-paste.ts` - Bracketed paste mode functionality
- `compare-paste-modes.ts` - Shows difference between paste modes ON/OFF
- `test-macos-paste.ts` - macOS-specific Cmd+V paste testing

## Important Notes

### Platform Differences

#### macOS
- Paste: Cmd+V (Meta+V in events)
- Copy: Cmd+C (Meta+C in events)
- Cut: Cmd+X (Meta+X in events)
- Select All: Cmd+A (Meta+A in events)

#### Linux/Windows
- Paste: Ctrl+V
- Copy: Ctrl+C
- Cut: Ctrl+X
- Select All: Ctrl+A

The input demos automatically detect the platform and show the correct shortcuts.

### Clipboard Support

The TUI library supports system clipboard operations through two methods:

#### Writing to Clipboard (OSC 52)
- **Supported terminals**: iTerm2, kitty, Alacritty, WezTerm, and most modern terminals
- **Terminal.app**: Requires enabling "Allow clipboard access" in preferences
- **tmux**: Requires `set -g set-clipboard on` in .tmux.conf
- **Security**: Some terminals may restrict clipboard access for security reasons

To test OSC 52 support in your terminal:
```bash
./examples/test-osc52.ts
```

#### Reading from Clipboard (System Commands)
- **macOS**: Uses built-in `pbpaste` command
- **Linux**: Requires `xclip` or `xsel` to be installed
- **Windows**: Uses PowerShell `Get-Clipboard`

To test clipboard reading:
```bash
./examples/clipboard-read-test.ts
```

### Resize Handling

When the terminal is resized:
1. The terminal automatically clears the screen
2. The diff engine is resized to match new dimensions
3. Your resize handler should redraw all content

Example pattern:
```typescript
term.on('resize', () => {
  // Just redraw - the terminal handles clearing
  drawUI();
});
```

### Clear vs Render

- `term.clear()` - Clears the diff engine buffers (content will be empty on next render)
- `term.render()` - Applies all changes to the terminal
- Always call `render()` after making changes

### Performance Tips

1. Use `syncUpdate: true` for animations to prevent tearing
2. Batch multiple operations before calling `render()`
3. The diff engine only updates changed cells
4. Avoid clearing and redrawing unchanged content