#!/usr/bin/env bun

/**
 * Visual demo of mouse events using terminal drawing
 */

import { input, Terminal } from '../src/index.ts';
import type { MouseEvent } from '../src/input/types.ts';
import type { Attributes, Color } from '../src/types.ts';

interface EventEntry {
  count: number;
  button: string;
  position: string;
  modifiers: string;
  kind: string;
  raw: string;
  timestamp: number;
}

class MouseEventVisualizer {
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

  private formatButton(event: MouseEvent): string {
    if (event.button === null) {
      return 'None';
    }
    if (typeof event.button === 'number') {
      const names = ['', 'Left', 'Right', 'Middle'];
      return names[event.button] || `Button${event.button}`;
    }
    return event.button;
  }

  private formatPosition(event: MouseEvent): string {
    return `${event.x},${event.y}`;
  }

  private formatModifiers(event: MouseEvent): string {
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

  private getEventColor(kind: string): Attributes {
    switch (kind) {
      case 'down':
        return { fg: '#00ff00', bold: true }; // Green
      case 'up':
        return { fg: '#ff6060', bold: true }; // Red
      case 'drag':
        return { fg: '#ffff00', bold: true }; // Yellow
      case 'move':
        return { fg: '#00ffff' }; // Cyan
      case 'scroll':
        return { fg: '#ff00ff', bold: true }; // Magenta
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

  addEvent(event: MouseEvent) {
    this.eventCount++;

    const entry: EventEntry = {
      count: this.eventCount,
      button: this.formatButton(event),
      position: this.formatPosition(event),
      modifiers: this.formatModifiers(event),
      kind: event.kind,
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

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Comprehensive render function for mouse events demo
  render() {
    this.term.clear();

    // Header with dynamic width
    const headerWidth = Math.min(80, this.term.cols - 4);
    const title = 'Mouse Event Visualizer';
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
    this.term.putText(
      4,
      2,
      'Move, click, drag, and scroll to see events. Ctrl+C to exit.',
      { fg: '#808080' }
    );

    // Event type legend
    this.term.putText(6, 2, 'Event Types: ', { fg: '#ffffff' });
    this.term.putText(6, 15, 'Down', { fg: '#00ff00', bold: true });
    this.term.putText(6, 21, 'Up', { fg: '#ff6060', bold: true });
    this.term.putText(6, 25, 'Drag', { fg: '#ffff00', bold: true });
    this.term.putText(6, 31, 'Move', { fg: '#00ffff' });
    this.term.putText(6, 37, 'Scroll', { fg: '#ff00ff', bold: true });

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
    this.term.putText(9, 11, 'Button', { fg: '#a0a0a0', bold: true });
    this.term.putText(9, 24, '│', { fg: '#606060' });
    this.term.putText(9, 26, 'Position', { fg: '#a0a0a0', bold: true });
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

        // Button (column starts at 10, width 14)
        const buttonStr = event.button.substring(0, 13).padEnd(13);
        const buttonColor = (() => {
          if (event.kind === 'scroll') {
            return { fg: '#ff00ff' as Color, bold: true };
          }
          if (event.button === 'None') {
            return { fg: '#808080' as Color };
          }
          return this.getEventColor(event.kind);
        })();
        this.term.putText(row, 11, buttonStr, {
          ...buttonColor,
          dim: dimmed && !isNewest,
          bold: isNewest || buttonColor.bold,
          bg: rowBg,
        });

        // Position (column starts at 25, width 18)
        const posStr = event.position.padEnd(17);
        this.term.putText(row, 26, posStr, {
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
          bold: isNewest || this.getEventColor(event.kind).bold,
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

        // Add modifiers indicator if present
        if (event.modifiers !== 'None') {
          const modIndicator = ` [${event.modifiers}]`;
          this.term.putText(row, 26 + event.position.length, modIndicator, {
            fg: '#ffff00',
            dim: dimmed && !isNewest,
            bg: rowBg,
          });
        }
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
  const visualizer = new MouseEventVisualizer(term);
  let stream: input.InputEventStream | null = null;

  try {
    // Clear screen and hide cursor
    term.clearScreen();
    term.hideCursor();

    // Configure input with mouse support
    await input.configureInput(term, {
      mouse: true,
      mouseProtocol: 'sgr', // Use SGR protocol for better support
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
      if (event.type === 'mouse') {
        visualizer.addEvent(event);

        // Update status for special events
        if (event.kind === 'down' && event.button === 1) {
          visualizer.setStatus('Left button pressed - try dragging!');
        } else if (event.kind === 'up') {
          visualizer.setStatus('');
        } else if (event.kind === 'scroll') {
          visualizer.setStatus(`Scrolled ${event.button}`);
        }

        visualizer.render();
      } else if (
        event.type === 'key' &&
        event.modifiers.ctrl &&
        typeof event.code === 'object' &&
        event.code.char === 'c'
      ) {
        // Check for exit
        visualizer.setStatus('Exiting...');
        visualizer.render();
        break;
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
