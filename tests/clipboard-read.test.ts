import { describe, expect, test } from 'bun:test';
import {
  isClipboardReadSupported,
  readFromClipboard,
} from '../src/utils/clipboard.ts';

describe('Clipboard Reading', () => {
  test('isClipboardReadSupported should return true on macOS', async () => {
    if (process.platform === 'darwin') {
      const supported = await isClipboardReadSupported();
      expect(supported).toBe(true);
    }
  });

  test('readFromClipboard should work on macOS', async () => {
    if (process.platform === 'darwin') {
      // First, copy something to clipboard
      const testText = `Test clipboard content ${Date.now()}`;
      const proc = Bun.spawn(['pbcopy'], {
        stdin: 'pipe',
      });
      proc.stdin.write(testText);
      proc.stdin.end();
      await proc.exited;

      // Now read it back
      const content = await readFromClipboard();
      expect(content).toBe(testText);
    }
  });

  test('readFromClipboard should handle empty clipboard', async () => {
    if (process.platform === 'darwin') {
      // Clear clipboard
      const proc = Bun.spawn(['pbcopy'], {
        stdin: 'pipe',
      });
      proc.stdin.write('');
      proc.stdin.end();
      await proc.exited;

      // Read empty clipboard
      const content = await readFromClipboard();
      expect(content).toBe('');
    }
  });

  test('readFromClipboard should handle multi-line content', async () => {
    if (process.platform === 'darwin') {
      // Copy multi-line text
      const testText = 'Line 1\nLine 2\nLine 3';
      const proc = Bun.spawn(['pbcopy'], {
        stdin: 'pipe',
      });
      proc.stdin.write(testText);
      proc.stdin.end();
      await proc.exited;

      // Read it back
      const content = await readFromClipboard();
      expect(content).toBe(testText);
    }
  });

  test('readFromClipboard should handle unicode content', async () => {
    if (process.platform === 'darwin') {
      // Copy unicode text
      const testText = 'Hello 👋 World 🌍 Unicode ✨';
      const proc = Bun.spawn(['pbcopy'], {
        stdin: 'pipe',
      });
      proc.stdin.write(testText);
      proc.stdin.end();
      await proc.exited;

      // Read it back
      const content = await readFromClipboard();
      expect(content).toBe(testText);
    }
  });
});
