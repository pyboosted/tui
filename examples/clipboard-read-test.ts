#!/usr/bin/env bun

/**
 * Test the new clipboard reading functionality using system commands
 */

import { input, Terminal } from '../src/index.ts';
import {
  isClipboardReadSupported,
  readFromClipboard,
} from '../src/utils/clipboard.ts';

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Demo function testing various clipboard scenarios
async function main() {
  const term = Terminal.open();

  try {
    // Clear screen and hide cursor
    term.clearScreen();
    term.hideCursor();

    // Check if clipboard reading is supported
    const supported = await isClipboardReadSupported();

    term.putText(0, 2, 'Clipboard Read Test', { fg: '#00ff00', bold: true });
    term.putText(2, 2, `Platform: ${process.platform}`, { fg: '#ffffff' });
    term.putText(
      3,
      2,
      `Clipboard read supported: ${supported ? 'Yes' : 'No'}`,
      {
        fg: supported ? '#00ff00' : '#ff0000',
      }
    );

    if (supported) {
      term.putText(5, 2, "Press 'r' to read from clipboard, 'q' to quit", {
        fg: '#808080',
      });
      term.render();

      // Configure input
      await input.configureInput(term, {
        kittyKeyboard: true,
      });

      // Create event stream
      const stream = input.createEventStream();

      // Handle events
      for await (const event of stream) {
        if (event.type === 'key') {
          if (event.kind === 'release') {
            continue;
          }

          const key =
            typeof event.code === 'string' ? event.code : event.code.char;

          if (key === 'r') {
            // Clear previous results
            term.putText(7, 2, ' '.repeat(term.cols - 4), {});
            term.putText(8, 2, ' '.repeat(term.cols - 4), {});
            term.putText(9, 2, ' '.repeat(term.cols - 4), {});

            term.putText(7, 2, 'Reading clipboard...', { fg: '#ffff00' });
            term.render();

            // Read from clipboard
            const startTime = Date.now();
            const content = await readFromClipboard();
            const elapsed = Date.now() - startTime;

            // Clear and show result
            term.putText(7, 2, ' '.repeat(term.cols - 4), {});

            if (content !== null) {
              term.putText(
                7,
                2,
                `Read ${content.length} characters in ${elapsed}ms:`,
                { fg: '#00ff00' }
              );

              // Show content (truncate if needed)
              const displayContent = content.substring(0, 100);
              const lines = displayContent.split('\n');
              let row = 8;

              for (const line of lines.slice(0, 5)) {
                term.putText(row, 2, line.substring(0, term.cols - 4), {
                  fg: '#ffffff',
                });
                row++;
                if (row > 12) {
                  break;
                }
              }

              if (content.length > 100 || lines.length > 5) {
                term.putText(row, 2, '...', { fg: '#808080' });
              }
            } else {
              term.putText(7, 2, 'Failed to read clipboard', { fg: '#ff0000' });
              term.putText(8, 2, 'Make sure you have copied some text first', {
                fg: '#ffff00',
              });
            }

            term.render();
          } else if (key === 'q') {
            break;
          }
        }
      }

      stream.close();
    } else {
      term.putText(5, 2, 'Clipboard reading not supported on this system', {
        fg: '#ff0000',
      });
      term.putText(6, 2, 'Linux users: Please install xclip or xsel', {
        fg: '#ffff00',
      });
      term.putText(8, 2, 'Press any key to exit...', { fg: '#808080' });
      term.render();

      // Wait for a key
      const stream = input.createEventStream();
      for await (const event of stream) {
        if (event.type === 'key') {
          break;
        }
      }
      stream.close();
    }
  } catch (_error) {
    // Exit gracefully
  } finally {
    // Cleanup
    term.showCursor();
    term.clearScreen();
    await input.resetTerminal(term);
    term.close();
    process.exit(0);
  }
}

main().catch((_error) => {
  process.exit(1);
});
