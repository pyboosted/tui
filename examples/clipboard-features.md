# Clipboard Features in paste-events.ts

The paste events demo now includes full system clipboard integration:

## Key Features

1. **Cross-platform Support**
   - On macOS: Both Ctrl+C and Cmd+C copy to clipboard
   - On Linux/Windows: Ctrl+C copies to clipboard
   - The buffer text is automatically copied to system clipboard

2. **Visual Feedback**
   - Status bar shows "Text copied to system clipboard"
   - Console output confirms what was copied
   - Event table shows copy/cut operations

3. **Operations Supported**
   - **Copy (Ctrl+C or Cmd+C)**: Copies buffer to system clipboard
   - **Cut (Ctrl+X or Cmd+X)**: Copies to clipboard and clears buffer
   - **Paste (Ctrl+V or Cmd+V)**: Pastes from system clipboard
   - **Select All (Ctrl+A or Cmd+A)**: Selects entire buffer for copy

4. **Buffer Management**
   - Initial buffer: "Hello, World! This is demo text."
   - Type to add text to buffer
   - Backspace to delete from buffer
   - Buffer content is what gets copied

## How It Works

1. When you press Ctrl+C (or Cmd+C):
   - The current buffer text is encoded in base64
   - An OSC 52 escape sequence is sent to the terminal
   - The terminal updates the system clipboard
   - You see "Text copied to system clipboard"

2. The copied text is now available:
   - In any application on your system
   - Can be pasted with standard paste shortcuts
   - Works across terminal sessions

## Testing

1. Run the demo: `./examples/paste-events.ts`
2. Press Ctrl+C to copy the buffer
3. Open any text editor
4. Press Cmd+V (Mac) or Ctrl+V to paste
5. You should see: "Hello, World! This is demo text."

## Terminal Requirements

Your terminal must support OSC 52 clipboard sequences. Most modern terminals do:
- iTerm2 ✓
- kitty ✓
- Alacritty ✓
- Terminal.app (needs preference enabled) ⚠️
- WezTerm ✓

If copying doesn't work, run `./examples/test-osc52.ts` to verify terminal support.