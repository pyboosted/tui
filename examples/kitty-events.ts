#!/usr/bin/env bun

/**
 * Visual demo of Kitty keyboard events using terminal drawing
 */

import { input, Terminal } from '../src/index.ts';
import type { KeyEvent } from '../src/input/types.ts';
import type { Attributes } from '../src/types.ts';

interface EventEntry {
  count: number;
  key: string;
  modifiers: string;
  kind: string;
  raw: string;
  timestamp: number;
}

class KeyboardEventVisualizer {
  private term: Terminal;
  private events: EventEntry[] = [];
  private maxEvents = 20;
  private eventCount = 0;
  private statusMessage = '';
  private headerRows = 11; // Rows used by header and table header
  private footerRows = 3; // Rows used by footer

  constructor(term: Terminal) {
    this.term = term;
    this.updateMaxEvents();

    // Listen for resize events
    term.on('resize', () => {
      this.updateMaxEvents();
      this.render();
    });
  }

  private updateMaxEvents() {
    // Calculate max events based on terminal height
    this.maxEvents = Math.max(
      1,
      this.term.rows - this.headerRows - this.footerRows - 1
    );
  }

  private formatKey(event: KeyEvent): string {
    if (typeof event.code === 'string') {
      return event.code;
    }
    const char = event.code.char || '?';
    // Handle unknown sequences (they start with "Unknown:")
    if (char.startsWith('Unknown:')) {
      return char;
    }
    return char;
  }

  private formatModifiers(event: KeyEvent): string {
    const mods: string[] = [];
    if (event.modifiers.ctrl) {
      mods.push('Ctrl');
    }
    if (event.modifiers.alt) {
      mods.push('Alt');
    }
    if (event.modifiers.shift) {
      mods.push('Shift');
    }
    if (event.modifiers.meta) {
      mods.push('Meta');
    }
    return mods.join('+') || 'None';
  }

  private getEventColor(kind?: string): Attributes {
    switch (kind) {
      case 'press':
        return { fg: '#00ff00', bold: true }; // Green
      case 'repeat':
        return { fg: '#ffff00', bold: true }; // Yellow
      case 'release':
        return { fg: '#ff6060', bold: true }; // Red
      default:
        return { fg: '#808080' }; // Gray
    }
  }

  private formatRawSequence(raw: string): string {
    // Convert raw bytes to readable format
    let formatted = '';
    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      const code = raw.charCodeAt(i);

      if (code === 0x1b) {
        formatted += 'ESC';
      } else if (code < 0x20 || code === 0x7f) {
        // Control characters
        formatted += `^${String.fromCharCode((code + 0x40) & 0x7f)}`;
      } else if (code < 0x7f) {
        // Printable ASCII
        formatted += char;
      } else {
        // High bytes
        formatted += `\\x${code.toString(16).padStart(2, '0')}`;
      }
    }

    // Truncate if too long
    if (formatted.length > 20) {
      return `${formatted.substring(0, 17)}...`;
    }
    return formatted;
  }

  addEvent(event: KeyEvent) {
    this.eventCount++;

    const entry: EventEntry = {
      count: this.eventCount,
      key: this.formatKey(event),
      modifiers: this.formatModifiers(event),
      kind: event.kind || 'immediate',
      raw: this.formatRawSequence(event.raw),
      timestamp: Date.now(),
    };

    this.events.unshift(entry); // Add to beginning

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }
  }

  setStatus(message: string) {
    this.statusMessage = message;
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Comprehensive render function for Kitty keyboard protocol demo
  render() {
    this.term.clear();

    // Header with dynamic width
    const headerWidth = Math.min(80, this.term.cols - 4);
    const title = 'Kitty Keyboard Event Visualizer';
    const titlePadding = Math.max(
      0,
      Math.floor((headerWidth - title.length - 2) / 2)
    );

    this.term.putText(0, 2, `╔${'═'.repeat(headerWidth - 2)}╗`, {
      fg: '#4080ff',
    });
    this.term.putText(1, 2, '║', { fg: '#4080ff' });
    this.term.putText(1, 3 + titlePadding, title, {
      fg: '#ffffff',
      bold: true,
    });
    this.term.putText(1, 2 + headerWidth - 1, '║', { fg: '#4080ff' });
    this.term.putText(2, 2, `╚${'═'.repeat(headerWidth - 2)}╝`, {
      fg: '#4080ff',
    });

    // Instructions
    this.term.putText(4, 2, 'Press keys to see events. Ctrl+C to exit.', {
      fg: '#808080',
    });

    // Event type legend
    this.term.putText(6, 2, 'Event Types: ', { fg: '#ffffff' });
    this.term.putText(6, 15, 'Press', { fg: '#00ff00', bold: true });
    this.term.putText(6, 22, 'Repeat', { fg: '#ffff00', bold: true });
    this.term.putText(6, 30, 'Release', { fg: '#ff6060', bold: true });

    // Table header
    this.term.putText(
      8,
      2,
      '┌──────┬──────────────┬──────────────────┬─────────────┬──────────────────────┐',
      { fg: '#606060' }
    );
    this.term.putText(9, 2, '│', { fg: '#606060' });
    this.term.putText(9, 5, '#', { fg: '#a0a0a0', bold: true });
    this.term.putText(9, 9, '│', { fg: '#606060' });
    this.term.putText(9, 11, 'Key', { fg: '#a0a0a0', bold: true });
    this.term.putText(9, 24, '│', { fg: '#606060' });
    this.term.putText(9, 26, 'Modifiers', { fg: '#a0a0a0', bold: true });
    this.term.putText(9, 43, '│', { fg: '#606060' });
    this.term.putText(9, 45, 'Event', { fg: '#a0a0a0', bold: true });
    this.term.putText(9, 57, '│', { fg: '#606060' });
    this.term.putText(9, 59, 'Esc Sequence', { fg: '#a0a0a0', bold: true });
    this.term.putText(9, 80, '│', { fg: '#606060' });
    this.term.putText(
      10,
      2,
      '├──────┼──────────────┼──────────────────┼─────────────┼──────────────────────┤',
      { fg: '#606060' }
    );

    // Event rows
    let row = 11;
    const now = Date.now();
    const maxRow = this.term.rows - this.footerRows - 1;

    // Fill all available rows
    for (let i = 0; i < this.maxEvents; i++) {
      if (row > maxRow) {
        break;
      }

      const event = this.events[i];

      // Row borders (draw for all rows, even empty ones)
      this.term.putText(row, 2, '│', { fg: '#606060' });
      this.term.putText(row, 9, '│', { fg: '#606060' });
      this.term.putText(row, 24, '│', { fg: '#606060' });
      this.term.putText(row, 43, '│', { fg: '#606060' });
      this.term.putText(row, 57, '│', { fg: '#606060' });
      this.term.putText(row, 80, '│', { fg: '#606060' });

      if (event) {
        const age = now - event.timestamp;
        const opacity = Math.max(0.3, 1 - age / 10_000); // Fade over 10 seconds
        const dimmed = opacity < 0.7;
        const isNewest = i === 0;

        // Highlight newest row - but preserve the cell content
        const rowBg = isNewest && age < 500 ? '#303030' : undefined;

        // Fill background for gaps between columns if highlighting
        if (rowBg) {
          // Fill gaps between columns
          this.term.putText(row, 3, ' ', { bg: rowBg });
          for (let c = 4; c < 9; c++) {
            this.term.putChar(row, c, ' ', { bg: rowBg });
          }
          this.term.putText(row, 10, ' ', { bg: rowBg });
          for (let c = 11; c < 24; c++) {
            this.term.putChar(row, c, ' ', { bg: rowBg });
          }
          this.term.putText(row, 25, ' ', { bg: rowBg });
          for (let c = 26; c < 43; c++) {
            this.term.putChar(row, c, ' ', { bg: rowBg });
          }
          this.term.putText(row, 44, ' ', { bg: rowBg });
          for (let c = 45; c < 57; c++) {
            this.term.putChar(row, c, ' ', { bg: rowBg });
          }
          this.term.putText(row, 58, ' ', { bg: rowBg });
          for (let c = 59; c < 80; c++) {
            this.term.putChar(row, c, ' ', { bg: rowBg });
          }
        }

        // Event number (column starts at 3, width 6)
        const countStr = event.count.toString().padStart(5);
        this.term.putText(row, 4, countStr, {
          fg: (() => {
            if (isNewest) {
              return '#ffffff';
            }
            if (dimmed) {
              return '#606060';
            }
            return '#a0a0a0';
          })(),
          bold: isNewest,
          bg: rowBg,
        });

        // Key (column starts at 10, width 14)
        let displayKey = event.key;
        // Shorten "Unknown:" prefix to "?" for display
        if (displayKey.startsWith('Unknown:')) {
          displayKey = `?${displayKey.substring(8)}`;
        }
        const keyStr = displayKey.substring(0, 13).padEnd(13);
        const keyColor = this.getEventColor(event.kind);
        this.term.putText(row, 11, keyStr, {
          ...keyColor,
          dim: dimmed && !isNewest,
          bold: isNewest || keyColor.bold,
          bg: rowBg,
        });

        // Modifiers (column starts at 25, width 18)
        const modStr = event.modifiers.substring(0, 17).padEnd(17);
        this.term.putText(row, 26, modStr, {
          fg: (() => {
            if (isNewest) {
              return '#ffffff';
            }
            if (dimmed) {
              return '#606060';
            }
            return '#e0e0e0';
          })(),
          bold: isNewest,
          bg: rowBg,
        });

        // Event kind (column starts at 44, width 13)
        const kindStr = event.kind.padEnd(12);
        this.term.putText(row, 45, kindStr, {
          ...this.getEventColor(event.kind),
          dim: dimmed && !isNewest,
          bold: isNewest || keyColor.bold,
          bg: rowBg,
        });

        // Escape sequence (column starts at 58, width 22)
        const escStr = event.raw.padEnd(21);
        this.term.putText(row, 59, escStr, {
          fg: (() => {
            if (isNewest) {
              return '#a0a0ff';
            }
            if (dimmed) {
              return '#404040';
            }
            return '#606080';
          })(),
          bold: isNewest,
          bg: rowBg,
        });
      } else {
        // Clear empty row content
        this.term.putText(row, 4, ' '.repeat(5), {});
        this.term.putText(row, 11, ' '.repeat(13), {});
        this.term.putText(row, 26, ' '.repeat(17), {});
        this.term.putText(row, 45, ' '.repeat(12), {});
        this.term.putText(row, 59, ' '.repeat(21), {});
      }

      row++;
    }

    // Table bottom
    this.term.putText(
      row,
      2,
      '└──────┴──────────────┴──────────────────┴─────────────┴──────────────────────┘',
      { fg: '#606060' }
    );

    // Footer - positioned at bottom of screen
    const footerRow = this.term.rows - 2;

    // Status message
    if (this.statusMessage) {
      this.term.putText(footerRow - 1, 2, ' '.repeat(60), {}); // Clear line
      this.term.putText(footerRow - 1, 2, this.statusMessage, {
        fg: '#ffff00',
      });
    }

    // Stats
    this.term.putText(footerRow, 2, ' '.repeat(60), {}); // Clear line
    this.term.putText(footerRow, 2, `Total events: ${this.eventCount}`, {
      fg: '#606060',
    });

    this.term.render();
  }
}

async function main() {
  const term = Terminal.open();
  const visualizer = new KeyboardEventVisualizer(term);
  let stream: input.InputEventStream | null = null;

  try {
    // Clear screen and hide cursor
    term.clearScreen();
    term.hideCursor();

    // Configure input with Kitty protocol
    await input.configureInput(term, {
      mouse: false,
      kittyKeyboard: true,
      bracketedPaste: false,
      focusEvents: false,
    });

    // Initial render
    visualizer.render();

    // Create event stream
    stream = input.createEventStream();

    // Handle events
    for await (const event of stream) {
      if (event.type === 'key') {
        visualizer.addEvent(event);

        // Check for exit
        if (
          event.modifiers.ctrl &&
          typeof event.code === 'object' &&
          event.code.char === 'c'
        ) {
          visualizer.setStatus('Exiting...');
          visualizer.render();
          break;
        }

        // Check for special keys
        if (event.code === 'Escape') {
          visualizer.setStatus('ESC pressed - Press Ctrl+C to exit');
        } else if (typeof event.code === 'object' && event.code.char === ' ') {
          visualizer.setStatus('Space pressed');
        } else {
          visualizer.setStatus('');
        }

        visualizer.render();
      }
    }
  } catch (_error) {
    // Exit gracefully
  } finally {
    // Cleanup
    if (stream) {
      stream.close();
    }
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
