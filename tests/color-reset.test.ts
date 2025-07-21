import { describe, expect, it } from 'bun:test';
import { Terminal } from '../src/terminal.ts';

describe('Color Reset', () => {
  it('should reset background color when transitioning from colored to non-colored cells', () => {
    const term = Terminal.open();

    // Mock write to capture output
    let output = '';
    term.write = (data: string) => {
      output += data;
    };

    // Draw both cells in one render to test color transition
    term.putChar(0, 0, 'X', { bg: '#ff0000' });
    term.putChar(0, 1, 'Y', {});
    term.render();
    expect(output).toContain('\x1b[49m');

    term.close();
  });

  it('should not bleed color across rows when moving colored content', () => {
    const term = Terminal.open();

    // Mock write to capture output
    let output = '';
    term.write = (data: string) => {
      output += data;
    };

    // Initial render - box at position (5, 5)
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        term.putChar(5 + y, 5 + x, ' ', { bg: '#0000ff' });
      }
    }
    term.render();

    // Clear output and clear the old position
    output = '';
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        term.putChar(5 + y, 5 + x, ' ', {});
      }
    }

    // Draw box at new position (5, 10)
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        term.putChar(5 + y, 10 + x, ' ', { bg: '#0000ff' });
      }
    }
    term.render();

    // Check that background reset sequences are present
    expect(output).toContain('\x1b[49m');

    term.close();
  });
});
