/**
 * Clipboard utilities for terminal applications
 *
 * This module provides cross-platform clipboard functionality using:
 * - OSC 52 escape sequences for writing (supported by most modern terminals)
 * - System commands for reading (more reliable across platforms)
 */

import { platform } from 'node:os';

/**
 * Copy text to system clipboard using OSC 52
 * @param text The text to copy
 * @param stdout The output stream (default: process.stdout)
 */
export function copyToClipboard(text: string, stdout = process.stdout): void {
  // Encode text as base64
  const base64 = Buffer.from(text).toString('base64');

  // OSC 52 sequence: ESC ] 52 ; c ; <base64> BEL
  // 'c' means clipboard (as opposed to primary selection)
  const sequence = `\x1b]52;c;${base64}\x07`;

  stdout.write(sequence);
}

/**
 * Clear the clipboard
 * @param stdout The output stream (default: process.stdout)
 */
export function clearClipboard(stdout = process.stdout): void {
  // OSC 52 with empty content clears the clipboard
  const sequence = '\x1b]52;c;\x07';
  stdout.write(sequence);
}

/**
 * Get the platform-specific command for reading from clipboard
 */
function getClipboardReadCommand(): string[] | null {
  const plat = platform();

  switch (plat) {
    case 'darwin':
      // macOS
      return ['pbpaste'];
    case 'linux':
      // Linux - try xclip first, then xsel
      // We'll check which one is available when we spawn
      return ['xclip', '-selection', 'clipboard', '-o'];
    case 'win32':
      // Windows
      return ['powershell', '-command', 'Get-Clipboard'];
    default:
      return null;
  }
}

/**
 * Read from system clipboard using platform-specific commands
 * @returns Promise that resolves with clipboard content or null if not supported
 */
export async function readFromClipboard(): Promise<string | null> {
  const command = getClipboardReadCommand();

  if (!command) {
    return null;
  }

  try {
    const proc = Bun.spawn(command, {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    // Read stdout using Bun.readableStreamToText
    const text = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      // If xclip failed on Linux, try xsel as fallback
      if (platform() === 'linux' && command[0] === 'xclip') {
        const fallbackProc = Bun.spawn(['xsel', '-ob'], {
          stdout: 'pipe',
          stderr: 'pipe',
        });

        const fallbackText = await new Response(fallbackProc.stdout).text();
        const fallbackExitCode = await fallbackProc.exited;

        if (fallbackExitCode === 0) {
          return fallbackText.trimEnd();
        }
      }

      return null;
    }

    // Remove trailing newline that some clipboard commands add
    return text.trimEnd();
  } catch (_error) {
    // Command not found or other error
    return null;
  }
}

/**
 * Check if clipboard reading is supported on this platform
 */
export async function isClipboardReadSupported(): Promise<boolean> {
  const command = getClipboardReadCommand();

  if (!command) {
    return false;
  }

  try {
    // Try to run the command with a simple test
    const proc = Bun.spawn([...command.slice(0, 1), '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await proc.exited;
    return true;
  } catch {
    // If checking version failed, try the actual command
    const result = await readFromClipboard();
    return result !== null;
  }
}
