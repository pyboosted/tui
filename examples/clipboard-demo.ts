#!/usr/bin/env bun

/**
 * Simple clipboard demo showing OSC 52 clipboard operations
 */

import { clipboard, input, Terminal } from '../src/index.ts';

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Demo function showing comprehensive clipboard functionality
async function main() {
  const term = Terminal.open();
  let stream: input.InputEventStream | null = null;

  // Text buffer
  let buffer = 'Hello from TUI! 🎉';
  let _clipboardContent = '';

  const isMacOS = process.platform === 'darwin';
  const _modKey = isMacOS ? 'Cmd' : 'Ctrl';

  try {
    // Configure input
    await input.configureInput(term, {
      mouse: false,
      kittyKeyboard: true,
      bracketedPaste: true,
      focusEvents: false,
    });

    // Create event stream
    stream = input.createEventStream();

    // Handle events
    for await (const event of stream) {
      if (event.type === 'paste') {
        // Handle paste event
        buffer = event.content;
      } else if (
        event.type === 'key' &&
        (!event.kind || event.kind === 'press')
      ) {
        const isCtrl = event.modifiers.ctrl;
        const isMeta = event.modifiers.meta;
        const isModified = isMacOS ? isMeta : isCtrl;
        const key =
          typeof event.code === 'string' ? event.code : event.code.char;

        if (isModified && key === 'c') {
          // Copy to clipboard
          clipboard.copyToClipboard(buffer);
          _clipboardContent = buffer;
        } else if (isModified && key === 'x') {
          // Cut to clipboard
          clipboard.copyToClipboard(buffer);
          _clipboardContent = buffer;
          buffer = '';
        } else if (isModified && key === 'v') {
          // Paste handled by paste event
        } else if (isModified && key === 'a') {
          // Select all (just copy for this demo)
          clipboard.copyToClipboard(buffer);
          _clipboardContent = buffer;
        } else if (isCtrl && key === 'q') {
          break;
        } else if (event.code === 'Backspace') {
          // Delete from buffer
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
          }
        } else if (
          typeof key === 'string' &&
          key.length === 1 &&
          !isCtrl &&
          !isMeta
        ) {
          // Type text
          buffer += key;
        }
      }
    }
  } catch (_error) {
    // Exit gracefully
  } finally {
    if (stream) {
      stream.close();
    }

    await input.resetTerminal(term);
    term.close();
    process.exit(0);
  }
}

main().catch((_error) => {
  process.exit(1);
});
