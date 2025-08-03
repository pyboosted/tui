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
  let stream: input.InputEventStream | null = null;

  const cleanup = async (exitCode = 0) => {
    if (stream) {
      stream.close();
    }
    if (process.stdin.isTTY) {
      await input.resetTerminal(term);
    }
    term.close();
    process.exit(exitCode);
  };

  process.on('SIGINT', () => cleanup(0));

  try {
    const capabilities = await input.detectCapabilities(term);
    displayCapabilities(capabilities);

    const inputMode = await input.initializeInput(term, {
      detectedCapabilities: capabilities,
      keyNormalization: 'raw',
      progressiveDetection: true,
      onFeatureDetected: (feature) => {
        writeLine(`\x1b[32m✓ Feature '${feature}' detected at runtime!\x1b[0m`);
      },
      features: {
        [input.InputFeature.MouseTracking]: {
          enabled: true,
          required: false,
          options: { protocol: 'sgr' },
        },
        [input.InputFeature.KittyKeyboard]: { enabled: true, required: false },
        [input.InputFeature.BracketedPaste]: { enabled: true, required: false },
        [input.InputFeature.FocusEvents]: { enabled: true, required: false },
      },
    });

    displayEnabledFeatures(inputMode);

    writeLine();
    writeLine('Press Ctrl+C to exit');
    writeLine('Try typing or pressing keys...');

    // Progressive detection is enabled by default
    writeLine();
    writeLine('Progressive detection is enabled!');
    writeLine('Features will be detected when you use them:');
    writeLine('  - Move mouse to detect mouse support');
    writeLine('  - Paste text to detect bracketed paste');
    writeLine('  - Switch windows to detect focus events');

    writeLine();
    writeLine('Events:');

    if (inputMode.kittyKeyboard) {
      await input.clearInput();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Create the stream after initialization to avoid conflicts
    stream = input.createEventStream();

    for await (const event of stream) {
      writeLine(`  ${formatEvent(event)}`);

      if (
        event.type === 'key' &&
        event.modifiers.ctrl &&
        typeof event.code === 'object' &&
        event.code.char === 'c'
      ) {
        break;
      }
    }
  } catch (error) {
    process.stderr.write(`Error: ${error}\r\n`);
    await cleanup(1);
  } finally {
    await cleanup(0);
  }
}

main();
