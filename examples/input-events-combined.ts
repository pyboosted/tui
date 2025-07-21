#!/usr/bin/env bun

/**
 * Combined keyboard and mouse events demo
 */

import { input, Terminal } from '../src/index.ts';
import type { KeyEvent, MouseEvent } from '../src/input/types.ts';
import type { Color } from '../src/types.ts';

interface EventEntry {
  type: 'key' | 'mouse';
  timestamp: number;
  display: string;
  color: Color;
}

class CombinedEventVisualizer {
  private term: Terminal;
  private keyEvents: EventEntry[] = [];
  private mouseEvents: EventEntry[] = [];
  private maxEvents = 10;
  private keyEventCount = 0;
  private mouseEventCount = 0;
  private headerRows = 8;
  private footerRows = 3;

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
      Math.floor((this.term.rows - this.headerRows - this.footerRows) / 2) - 1
    );
  }

  addKeyEvent(event: KeyEvent) {
    this.keyEventCount++;

    const key =
      typeof event.code === 'string' ? event.code : event.code.char || '?';

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
    const modStr = mods.length > 0 ? `${mods.join('+')}+` : '';

    const kindStr = event.kind || 'immediate';
    const color = (() => {
      if (kindStr === 'press') {
        return '#00ff00';
      }
      if (kindStr === 'repeat') {
        return '#ffff00';
      }
      if (kindStr === 'release') {
        return '#ff6060';
      }
      return '#808080';
    })();

    this.keyEvents.unshift({
      type: 'key',
      timestamp: Date.now(),
      display: `${modStr}${key} (${kindStr})`,
      color,
    });

    if (this.keyEvents.length > this.maxEvents) {
      this.keyEvents = this.keyEvents.slice(0, this.maxEvents);
    }
  }

  addMouseEvent(event: MouseEvent) {
    this.mouseEventCount++;

    let button = 'None';
    if (event.button !== null) {
      if (typeof event.button === 'number') {
        button =
          ['', 'Left', 'Right', 'Middle'][event.button] || `B${event.button}`;
      } else {
        button = event.button;
      }
    }

    const color = (() => {
      if (event.kind === 'down') {
        return '#00ff00';
      }
      if (event.kind === 'up') {
        return '#ff6060';
      }
      if (event.kind === 'drag') {
        return '#ffff00';
      }
      if (event.kind === 'move') {
        return '#00ffff';
      }
      if (event.kind === 'scroll') {
        return '#ff00ff';
      }
      return '#808080';
    })();

    this.mouseEvents.unshift({
      type: 'mouse',
      timestamp: Date.now(),
      display: `${event.kind} ${button} @ (${event.x},${event.y})`,
      color,
    });

    if (this.mouseEvents.length > this.maxEvents) {
      this.mouseEvents = this.mouseEvents.slice(0, this.maxEvents);
    }
  }

  render() {
    this.term.clear();

    // Header
    const headerWidth = Math.min(80, this.term.cols - 4);
    const title = 'Keyboard & Mouse Events';
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
    this.term.putText(4, 2, 'Press keys and use mouse. Ctrl+C to exit.', {
      fg: '#808080',
    });

    // Calculate split position
    const splitCol = Math.floor(this.term.cols / 2);

    // Keyboard section header
    this.term.putText(6, 2, 'Keyboard Events', { fg: '#00ff00', bold: true });
    this.term.putText(6, 20, `(${this.keyEventCount} total)`, {
      fg: '#606060',
    });

    // Mouse section header
    this.term.putText(6, splitCol + 2, 'Mouse Events', {
      fg: '#00ffff',
      bold: true,
    });
    this.term.putText(6, splitCol + 17, `(${this.mouseEventCount} total)`, {
      fg: '#606060',
    });

    // Divider
    const dividerStart = 7;
    const dividerEnd = this.term.rows - this.footerRows;
    for (let row = dividerStart; row < dividerEnd; row++) {
      this.term.putText(row, splitCol, '│', { fg: '#404040' });
    }

    // Render events
    const eventStart = 8;
    const now = Date.now();

    // Keyboard events (left side)
    for (let i = 0; i < this.maxEvents; i++) {
      const row = eventStart + i;
      if (row >= dividerEnd - 1) {
        break;
      }

      const event = this.keyEvents[i];
      if (event) {
        const age = now - event.timestamp;
        const opacity = Math.max(0.3, 1 - age / 10_000);
        const dimmed = opacity < 0.7;

        const display = event.display.substring(0, splitCol - 4);
        this.term.putText(row, 3, display, {
          fg: event.color,
          dim: dimmed,
          bold: !dimmed,
        });
      }
    }

    // Mouse events (right side)
    for (let i = 0; i < this.maxEvents; i++) {
      const row = eventStart + i;
      if (row >= dividerEnd - 1) {
        break;
      }

      const event = this.mouseEvents[i];
      if (event) {
        const age = now - event.timestamp;
        const opacity = Math.max(0.3, 1 - age / 10_000);
        const dimmed = opacity < 0.7;

        const display = event.display.substring(0, splitCol - 4);
        this.term.putText(row, splitCol + 3, display, {
          fg: event.color,
          dim: dimmed,
          bold: !dimmed,
        });
      }
    }

    // Footer
    const footerRow = this.term.rows - 2;
    this.term.putText(footerRow, 2, '─'.repeat(headerWidth - 2), {
      fg: '#404040',
    });

    this.term.render();
  }
}

async function main() {
  const term = Terminal.open();
  const visualizer = new CombinedEventVisualizer(term);
  let stream: input.InputEventStream | null = null;

  try {
    // Clear screen and hide cursor
    term.clearScreen();
    term.hideCursor();

    // Configure input with both keyboard and mouse
    await input.configureInput(term, {
      mouse: true,
      mouseProtocol: 'sgr',
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
        visualizer.addKeyEvent(event);

        // Check for exit
        if (
          event.modifiers.ctrl &&
          typeof event.code === 'object' &&
          event.code.char === 'c'
        ) {
          break;
        }

        visualizer.render();
      } else if (event.type === 'mouse') {
        visualizer.addMouseEvent(event);
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
