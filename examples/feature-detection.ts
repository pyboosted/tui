#!/usr/bin/env bun

/**
 * Demonstrates terminal feature detection and graceful degradation
 */

import { input, Terminal } from '../src/index.ts';
import type {
  DetectedCapabilities,
  InputEvent,
  InputMode,
} from '../src/input/index.ts';

// Helper to write lines in raw mode
function writeLine(text = '') {
  process.stdout.write(`${text}\r\n`);
}

function displayCapabilities(capabilities: DetectedCapabilities) {
  writeLine('=== Terminal Feature Detection Demo ===');
  writeLine();
  writeLine(`Terminal Type: ${capabilities.terminalType}`);
  writeLine(`Version: ${capabilities.version || 'unknown'}`);
  writeLine(`SSH Session: ${capabilities.isSSH ? 'Yes' : 'No'}`);
  writeLine(`Tmux: ${capabilities.isTmux ? 'Yes' : 'No'}`);
  writeLine(`TERM env: ${process.env.TERM || 'not set'}`);

  writeLine();
  writeLine('Feature Support:');
  for (const [feature, level] of Object.entries(capabilities.features)) {
    let icon: string;
    if (level === input.SupportLevel.Full) {
      icon = '✓';
    } else if (level === input.SupportLevel.Partial) {
      icon = '~';
    } else {
      icon = '✗';
    }
    writeLine(`  ${icon} ${feature}: ${level}`);
  }
}

function displayEnabledFeatures(inputMode: InputMode) {
  writeLine();
  writeLine('Enabled features:');
  let hasEnabledFeatures = false;
  for (const [feature, enabled] of Object.entries(
    inputMode.enabledFeatures || {}
  )) {
    if (enabled) {
      writeLine(`  ✓ ${feature}`);
      hasEnabledFeatures = true;
    }
  }

  if (!hasEnabledFeatures) {
    writeLine('  ⚠ No advanced features available');
    writeLine('  Basic input only (raw mode)');
  }
}

function formatEvent(event: InputEvent): string {
  if (event.type === 'key') {
    const code = typeof event.code === 'object' ? event.code.char : event.code;
    let eventText = `Key: ${code}`;

    // Build modifier string
    const mods: string[] = [];
    if (event.modifiers.shift) {
      mods.push('Shift');
    }
    if (event.modifiers.ctrl) {
      mods.push('Ctrl');
    }
    if (event.modifiers.alt) {
      mods.push('Alt');
    }
    if (event.modifiers.meta) {
      mods.push('Meta');
    }

    if (mods.length > 0) {
      eventText += ` + ${mods.join('+')}`;
    }

    // Add event kind if available (from Kitty protocol)
    if (event.kind) {
      eventText += ` [${event.kind}]`;
    }

    return eventText;
  }

  if (event.type === 'mouse') {
    let eventText = `Mouse: ${event.kind} at (${event.x}, ${event.y})`;
    if (event.button) {
      eventText += ` button=${event.button}`;
    }
    return eventText;
  }

  if (event.type === 'paste') {
    return `Paste: ${event.content.length} characters`;
  }

  if (event.type === 'focus') {
    return `Focus: ${event.gained ? 'gained' : 'lost'}`;
  }

  return `Event: ${event.type}`;
}

async function main() {
  const term = Terminal.open();

  try {
    // Detect terminal capabilities
    const capabilities = await input.detectCapabilities(term);
    displayCapabilities(capabilities);

    // Initialize input with optional features
    writeLine();
    writeLine('Initializing input with optional features...');
    const inputMode = await input.initializeInput(term, {
      detectedCapabilities: capabilities,
      keyNormalization: 'raw', // Always show raw key + modifiers
      features: {
        [input.InputFeature.MouseTracking]: {
          enabled: true,
          required: false,
          options: { protocol: 'sgr' },
        },
        [input.InputFeature.KittyKeyboard]: {
          enabled: true,
          required: false,
        },
        [input.InputFeature.BracketedPaste]: {
          enabled: true,
          required: false,
        },
        [input.InputFeature.FocusEvents]: {
          enabled: true,
          required: false,
        },
      },
    });

    displayEnabledFeatures(inputMode);

    // Instructions
    writeLine();
    writeLine('Press Ctrl+C to exit');
    writeLine('Try typing or pressing keys...');
    writeLine();
    writeLine('Events:');

    if (inputMode.kittyKeyboard) {
      await input.clearInput();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Handle input events
    const stream = input.createEventStream();

    for await (const event of stream) {
      writeLine(`  ${formatEvent(event)}`);

      // Check for Ctrl+C
      if (
        event.type === 'key' &&
        event.modifiers.ctrl &&
        typeof event.code === 'object' &&
        event.code.char === 'c'
      ) {
        stream.close();
        process.exit(0);
      }
    }
  } finally {
    await input.resetTerminal(term);
    term.close();
  }
}

main().catch((error) => {
  process.stderr.write(`Error: ${error}\r\n`);
  process.exit(1);
});

// Ensure terminal is reset on exit
process.on('exit', () => {
  // Force terminal reset
  try {
    const _proc = Bun.spawnSync(['stty', 'sane', 'echo', 'icanon', 'iexten'], {
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
    });
  } catch {
    // Best effort
  }
});
