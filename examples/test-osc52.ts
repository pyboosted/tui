#!/usr/bin/env bun

/**
 * Test OSC 52 clipboard support in your terminal
 */

import { clipboard } from '../src/index.ts';

async function testClipboard() {
  const testTexts = [
    'Hello, World!',
    'Multi\nLine\nText',
    'Special chars: 🎉 © ™ • →',
    'Tabs\tand\tspaces',
    `Long text: ${new Array(100).fill('x').join('')}`,
  ];

  for (let i = 0; i < testTexts.length; i++) {
    const text = testTexts[i];
    const _display = text.length > 50 ? `${text.substring(0, 47)}...` : text;
    clipboard.copyToClipboard(text);

    if (i < testTexts.length - 1) {
      // Wait for Enter key
      await new Promise<void>((resolve) => {
        process.stdin.once('data', () => {
          resolve();
        });
      });
    }
  }
}

// Check if we can detect clipboard support
function checkTerminal() {
  const term = process.env.TERM || '';
  const termProgram = process.env.TERM_PROGRAM || '';

  if (termProgram === 'iTerm.app') {
    // iTerm2 supports OSC52 by default
  } else if (termProgram === 'Apple_Terminal') {
    // Terminal.app has limited OSC52 support
  } else if (term.includes('kitty')) {
    // Kitty supports OSC52
  } else if (term.includes('alacritty')) {
    // Alacritty supports OSC52
  } else if (process.env.TMUX) {
    // tmux requires special configuration
  }
}

// Main function
async function main() {
  checkTerminal();

  // Set stdin to raw mode for Enter key detection
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  await testClipboard();

  // Restore stdin
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }

  process.exit(0);
}

// Run the test
main().catch((_error) => {
  process.exit(1);
});
