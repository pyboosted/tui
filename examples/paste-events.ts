#!/usr/bin/env bun

/**
 * Visual demo of paste events and clipboard interaction
 */

import { clipboard, input, Terminal } from '../src/index.ts';
import type { PasteEvent } from '../src/input/types.ts';
import type { Attributes } from '../src/types.ts';

interface EventEntry {
  count: number;
  type: 'paste' | 'copy' | 'cut';
  content: string;
  size: number;
  timestamp: number;
}

class PasteEventVisualizer {
  private term: Terminal;
  private events: EventEntry[] = [];
  private maxEvents = 10;
  private eventCount = 0;
  private statusMessage = '';
  private headerRows = process.platform === 'darwin' ? 12 : 11;
  private footerRows = 3;
  private copiedText = '';
  private selectedText = '';

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

  private getEventColor(type: string): Attributes {
    switch (type) {
      case 'paste':
        return { fg: '#00ff00', bold: true }; // Green
      case 'copy':
        return { fg: '#00ffff', bold: true }; // Cyan
      case 'cut':
        return { fg: '#ffff00', bold: true }; // Yellow
      default:
        return { fg: '#808080' }; // Gray
    }
  }

  private formatContent(content: string): string {
    // Replace special characters for display
    const formatted = content
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');

    // Truncate if too long (max 36 chars + "...")
    if (formatted.length > 36) {
      return `${formatted.substring(0, 36)}...`;
    }
    return formatted;
  }

  private formatRawSequence(content: string): string {
    // Show the bracketed paste markers
    if (content.includes('\n')) {
      return 'ESC[200~...ESC[201~';
    }

    // For short content, show actual bytes
    let formatted = 'ESC[200~';
    for (let i = 0; i < Math.min(content.length, 5); i++) {
      const code = content.charCodeAt(i);
      if (code >= 32 && code < 127) {
        formatted += content[i];
      } else {
        formatted += `\\x${code.toString(16).padStart(2, '0')}`;
      }
    }
    if (content.length > 5) {
      formatted += '...';
    }
    formatted += 'ESC[201~';
    return formatted;
  }

  addPasteEvent(event: PasteEvent) {
    this.eventCount++;

    const entry: EventEntry = {
      count: this.eventCount,
      type: 'paste',
      content: event.content,
      size: event.content.length,
      timestamp: Date.now(),
    };

    this.events.unshift(entry); // Add to beginning

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }
  }

  addCopyEvent(text: string) {
    this.eventCount++;
    this.copiedText = text;

    const entry: EventEntry = {
      count: this.eventCount,
      type: 'copy',
      content: text,
      size: text.length,
      timestamp: Date.now(),
    };

    this.events.unshift(entry);

    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }
  }

  addCutEvent(text: string) {
    this.eventCount++;
    this.copiedText = text;

    const entry: EventEntry = {
      count: this.eventCount,
      type: 'cut',
      content: text,
      size: text.length,
      timestamp: Date.now(),
    };

    this.events.unshift(entry);

    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }
  }

  setStatus(message: string) {
    this.statusMessage = message;
  }

  setSelectedText(text: string) {
    this.selectedText = text;
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Comprehensive render function for paste events demo
  render() {
    this.term.clear();

    // Header with dynamic width
    const headerWidth = Math.min(80, this.term.cols - 4);
    const title = 'Paste Event Visualizer';
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
      'Copy: Ctrl+C  Paste: Ctrl+V  Cut: Ctrl+X  Exit: Ctrl+Q',
      { fg: '#808080' }
    );
    if (process.platform === 'darwin') {
      this.term.putText(5, 2, '(Cmd+keys may be intercepted by terminal)', {
        fg: '#606060',
        italic: true,
      });
    }

    // Event type legend
    const legendRow = process.platform === 'darwin' ? 7 : 6;
    this.term.putText(legendRow, 2, 'Event Types: ', { fg: '#ffffff' });
    this.term.putText(legendRow, 15, 'Paste', { fg: '#00ff00', bold: true });
    this.term.putText(legendRow, 22, 'Copy', { fg: '#00ffff', bold: true });
    this.term.putText(legendRow, 28, 'Cut', { fg: '#ffff00', bold: true });

    // Table header
    const tableStartRow = legendRow + 2;
    this.term.putText(
      tableStartRow,
      2,
      '┌──────┬──────────┬──────┬─────────────────────────────────────────┬────────────────────┐',
      { fg: '#606060' }
    );
    this.term.putText(tableStartRow + 1, 2, '│', { fg: '#606060' });
    this.term.putText(tableStartRow + 1, 5, '#', { fg: '#a0a0a0', bold: true });
    this.term.putText(tableStartRow + 1, 9, '│', { fg: '#606060' });
    this.term.putText(tableStartRow + 1, 11, 'Event', {
      fg: '#a0a0a0',
      bold: true,
    });
    this.term.putText(tableStartRow + 1, 20, '│', { fg: '#606060' });
    this.term.putText(tableStartRow + 1, 22, 'Size', {
      fg: '#a0a0a0',
      bold: true,
    });
    this.term.putText(tableStartRow + 1, 27, '│', { fg: '#606060' });
    this.term.putText(tableStartRow + 1, 29, 'Content', {
      fg: '#a0a0a0',
      bold: true,
    });
    this.term.putText(tableStartRow + 1, 69, '│', { fg: '#606060' });
    this.term.putText(tableStartRow + 1, 71, 'Raw Sequence', {
      fg: '#a0a0a0',
      bold: true,
    });
    this.term.putText(tableStartRow + 1, 90, '│', { fg: '#606060' });
    this.term.putText(
      tableStartRow + 2,
      2,
      '├──────┼──────────┼──────┼─────────────────────────────────────────┼────────────────────┤',
      { fg: '#606060' }
    );

    // Event rows
    let row = tableStartRow + 3;
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
      this.term.putText(row, 20, '│', { fg: '#606060' });
      this.term.putText(row, 27, '│', { fg: '#606060' });
      this.term.putText(row, 69, '│', { fg: '#606060' });
      this.term.putText(row, 90, '│', { fg: '#606060' });

      if (event) {
        const age = now - event.timestamp;
        const opacity = Math.max(0.3, 1 - age / 10_000); // Fade over 10 seconds
        const dimmed = opacity < 0.7;
        const isNewest = i === 0;

        // Only highlight the very first event in our list if it's new
        // The condition ensures we only highlight index 0 (most recent event)
        // We explicitly check i === 0 to prevent any other rows from being highlighted
        const shouldHighlight = i === 0 && age < 300 && isNewest; // Reduced to 300ms for quicker fade
        const rowBg = shouldHighlight ? '#303030' : undefined;

        // Don't pre-fill background - we'll apply it when writing content

        // Event number (fill the cell: positions 3-8, 6 chars total)
        const countStr = event.count.toString().padStart(5);
        // First clear the cell with background - only if we should highlight
        if (shouldHighlight && rowBg) {
          this.term.putText(row, 3, '      ', { bg: rowBg });
        }
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

        // Event type (fill cell: positions 10-19, 10 chars)
        if (shouldHighlight && rowBg) {
          this.term.putText(row, 10, '          ', { bg: rowBg });
        }
        const typeStr = event.type.padEnd(9);
        const eventColor = this.getEventColor(event.type);
        this.term.putText(row, 11, typeStr, {
          ...eventColor,
          dim: dimmed && !isNewest,
          bold: isNewest || eventColor.bold,
          bg: rowBg,
        });

        // Size (fill cell: positions 21-26, 6 chars)
        if (shouldHighlight && rowBg) {
          this.term.putText(row, 21, '      ', { bg: rowBg });
        }
        const sizeStr = event.size.toString().padStart(5);
        this.term.putText(row, 21, sizeStr, {
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

        // Content (fill cell: positions 28-68, 41 chars)
        if (shouldHighlight && rowBg) {
          this.term.putText(
            row,
            28,
            '                                         ',
            { bg: rowBg }
          );
        }
        const contentStr = this.formatContent(event.content)
          .padEnd(39)
          .substring(0, 39);
        this.term.putText(row, 29, contentStr, {
          fg: (() => {
            if (isNewest) {
              return '#ffffff';
            }
            if (dimmed) {
              return '#606060';
            }
            return '#e0e0e0';
          })(),
          bg: rowBg,
        });

        // Raw sequence (fill cell: positions 70-89, 20 chars)
        if (shouldHighlight && rowBg) {
          this.term.putText(row, 70, '                    ', { bg: rowBg });
        }
        if (event.type === 'paste') {
          const rawStr = this.formatRawSequence(event.content)
            .padEnd(18)
            .substring(0, 18);
          this.term.putText(row, 71, rawStr, {
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
          const modKey = process.platform === 'darwin' ? 'Cmd' : 'Ctrl';
          const actionStr = (
            event.type === 'copy' ? `${modKey}+C` : `${modKey}+X`
          )
            .padEnd(18)
            .substring(0, 18);
          this.term.putText(row, 71, actionStr, {
            fg: (() => {
              if (isNewest) {
                return '#ffff00';
              }
              if (dimmed) {
                return '#404040';
              }
              return '#808060';
            })(),
            bg: rowBg,
          });
        }
      } else {
        // Clear empty row content
        this.term.putText(row, 4, ' '.repeat(5), {});
        this.term.putText(row, 11, ' '.repeat(9), {});
        this.term.putText(row, 21, ' '.repeat(5), {});
        this.term.putText(row, 29, ' '.repeat(39), {});
        this.term.putText(row, 71, ' '.repeat(18), {});
      }

      row++;
    }

    // Table bottom
    this.term.putText(
      row,
      2,
      '└──────┴──────────┴──────┴─────────────────────────────────────────┴────────────────────┘',
      { fg: '#606060' }
    );

    // Footer - positioned at bottom of screen
    const footerRow = this.term.rows - 2;

    // Status message
    if (this.statusMessage) {
      this.term.putText(footerRow - 1, 2, ' '.repeat(80), {}); // Clear line
      this.term.putText(footerRow - 1, 2, this.statusMessage, {
        fg: '#ffff00',
      });
    }

    // Stats
    this.term.putText(footerRow, 2, ' '.repeat(80), {}); // Clear line
    let statsMsg = `Total events: ${this.eventCount}`;
    if (this.copiedText) {
      statsMsg += ` | Clipboard: "${this.formatContent(this.copiedText).substring(0, 20)}"`;
    }
    if (this.selectedText) {
      statsMsg += ` | Selected: "${this.formatContent(this.selectedText).substring(0, 20)}"`;
    }
    this.term.putText(footerRow, 2, statsMsg, { fg: '#606060' });

    this.term.render();
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Comprehensive demo function showing paste functionality
async function main() {
  const term = Terminal.open();
  const visualizer = new PasteEventVisualizer(term);
  let stream: input.InputEventStream | null = null;

  // Demo text buffer with initial content
  let textBuffer = 'Hello, World! This is demo text.';
  let selectionStart = -1;
  let selectionEnd = -1;

  try {
    // Clear screen and hide cursor
    term.clearScreen();
    term.hideCursor();

    // Configure input with bracketed paste mode
    await input.configureInput(term, {
      mouse: true,
      mouseProtocol: 'sgr',
      kittyKeyboard: true,
      bracketedPaste: true, // Enable bracketed paste mode
      focusEvents: false,
    });

    // Initial render with buffer status
    visualizer.setStatus(`Buffer: "${textBuffer}"`);
    visualizer.render();

    // Create event stream
    stream = input.createEventStream();

    // Track clipboard read requests
    let waitingForClipboard = false;
    let clipboardTimeout: NodeJS.Timeout | null = null;

    // Handle events
    for await (const event of stream) {
      if (event.type === 'clipboard' && waitingForClipboard) {
        // Received clipboard content
        waitingForClipboard = false;
        if (clipboardTimeout) {
          clearTimeout(clipboardTimeout);
          clipboardTimeout = null;
        }

        // Replace buffer with clipboard content
        textBuffer = event.content;
        selectionStart = selectionEnd = -1;
        visualizer.setSelectedText('');

        // Add as paste event
        visualizer.addPasteEvent({ type: 'paste', content: event.content });
        visualizer.setStatus(
          `Pasted ${event.content.length} characters from clipboard`
        );
        visualizer.render();
      } else if (event.type === 'paste') {
        // Replace buffer text with pasted content
        textBuffer = event.content;
        selectionStart = selectionEnd = -1;
        visualizer.setSelectedText('');

        visualizer.addPasteEvent(event);
        visualizer.setStatus(
          `Buffer replaced with ${event.content.length} characters: "${textBuffer.substring(0, 50)}${textBuffer.length > 50 ? '...' : ''}"`
        );
        visualizer.render();
      } else if (event.type === 'key') {
        // Note: When Kitty keyboard protocol is enabled, both press and release
        // events are sent. We only process press events to avoid duplicates.
        if (event.kind === 'release') {
          continue;
        }

        const isCtrl = event.modifiers.ctrl;
        const isMeta = event.modifiers.meta;
        const isMacOS = process.platform === 'darwin';
        const isModified = isMacOS ? isMeta : isCtrl;
        const key =
          typeof event.code === 'string' ? event.code : event.code.char;

        // Handle copy/cut/paste operations
        // Check both lowercase and uppercase to handle different terminal behaviors
        if (
          (isModified && (key === 'c' || key === 'C')) ||
          (isCtrl && (key === 'c' || key === 'C'))
        ) {
          // Copy to system clipboard (Cmd+C on Mac, Ctrl+C elsewhere)
          const text =
            selectionStart >= 0 && selectionEnd > selectionStart
              ? textBuffer.substring(selectionStart, selectionEnd)
              : textBuffer;

          // Copy to system clipboard using OSC 52
          clipboard.copyToClipboard(text);

          visualizer.addCopyEvent(text);
          visualizer.setStatus('Text copied to system clipboard');

          visualizer.render();
        } else if (
          (isModified && (key === 'x' || key === 'X')) ||
          (isCtrl && (key === 'x' || key === 'X'))
        ) {
          // Cut to system clipboard (Cmd+X on Mac, Ctrl+X elsewhere)
          const text =
            selectionStart >= 0 && selectionEnd > selectionStart
              ? textBuffer.substring(selectionStart, selectionEnd)
              : textBuffer;

          // Copy to system clipboard using OSC 52
          clipboard.copyToClipboard(text);

          visualizer.addCutEvent(text);
          visualizer.setStatus('Text cut to system clipboard');

          if (selectionStart >= 0 && selectionEnd > selectionStart) {
            textBuffer =
              textBuffer.substring(0, selectionStart) +
              textBuffer.substring(selectionEnd);
            selectionStart = selectionEnd = -1;
          } else {
            textBuffer = '';
          }
          visualizer.render();
        } else if (
          (isModified && (key === 'v' || key === 'V')) ||
          (isCtrl && (key === 'v' || key === 'V'))
        ) {
          // Try to read from clipboard using system commands
          visualizer.setStatus('Reading from clipboard...');
          visualizer.render();

          try {
            const clipboardText = await clipboard.readFromClipboard();

            if (clipboardText !== null) {
              // Successfully read from clipboard
              textBuffer = clipboardText;
              selectionStart = selectionEnd = -1;
              visualizer.setSelectedText('');

              // Add as paste event
              visualizer.addPasteEvent({
                type: 'paste',
                content: clipboardText,
              });
              visualizer.setStatus(
                `Pasted ${clipboardText.length} characters from clipboard`
              );
              visualizer.render();
            } else {
              // Clipboard read failed - try OSC 52 as fallback
              waitingForClipboard = true;
              // TODO: clipboard.requestClipboard() - not implemented yet

              // Set a timeout in case the terminal doesn't support OSC 52 either
              clipboardTimeout = setTimeout(() => {
                if (waitingForClipboard) {
                  waitingForClipboard = false;
                  visualizer.setStatus(
                    "Could not read clipboard - paste manually with your terminal's paste"
                  );
                  visualizer.render();
                }
              }, 200);

              visualizer.setStatus('Trying OSC 52 clipboard read...');
              visualizer.render();
            }
          } catch (_error) {
            visualizer.setStatus('Clipboard read error - paste manually');
            visualizer.render();
          }
        } else if (isCtrl && key === 'q') {
          // Exit on Ctrl+Q
          visualizer.setStatus('Exiting...');
          visualizer.render();
          break;
        } else if (key === 'Backspace') {
          // Delete last character from buffer
          if (textBuffer.length > 0) {
            textBuffer = textBuffer.slice(0, -1);
            selectionStart = selectionEnd = -1;
            visualizer.setSelectedText('');
            visualizer.setStatus(
              `Buffer: "${textBuffer.substring(0, 50)}${textBuffer.length > 50 ? '...' : ''}"`
            );
            visualizer.render();
          }
        } else if (!isCtrl && typeof key === 'string' && key.length === 1) {
          // Type text (simulation)
          textBuffer += key;
          selectionStart = selectionEnd = -1;
          visualizer.setSelectedText('');
          visualizer.setStatus(
            `Buffer: "${textBuffer.substring(0, 50)}${textBuffer.length > 50 ? '...' : ''}"`
          );
          visualizer.render();
        }
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
