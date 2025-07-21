/**
 * Terminal mode and feature toggle helpers
 *
 * This module provides functions to enable/disable various terminal
 * features like raw mode, mouse tracking, and special protocols.
 */

import type { Terminal } from '../terminal.ts';
import { ESCAPE_SEQUENCES, KITTY_FLAGS } from './protocols.ts';
import { configureDecoder } from './reader.ts';
import type { InputOptions } from './types.ts';

/**
 * Terminal mode state tracking
 */
interface TerminalModeState {
  rawMode: boolean;
  mouseTracking: boolean;
  mouseProtocol?: 'x10' | 'sgr';
  kittyKeyboard: boolean;
  bracketedPaste: boolean;
  focusEvents: boolean;
}

/**
 * Global state for terminal modes
 */
const terminalState: TerminalModeState = {
  rawMode: false,
  mouseTracking: false,
  mouseProtocol: undefined,
  kittyKeyboard: false,
  bracketedPaste: false,
  focusEvents: false,
};

/**
 * Enable raw mode on the terminal
 *
 * This disables line buffering and echoing, allowing byte-by-byte input.
 *
 * @param term - Terminal instance to configure
 * @returns Promise that resolves when raw mode is enabled
 */
export async function enableRawMode(_term: Terminal): Promise<void> {
  if (terminalState.rawMode) {
    return;
  }

  // Use Bun's spawn to run stty command
  const proc = Bun.spawn(['stty', 'raw', '-echo'], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  await proc.exited;

  if (proc.exitCode !== 0) {
    throw new Error('Failed to enable raw mode');
  }

  terminalState.rawMode = true;
}

/**
 * Disable raw mode on the terminal
 *
 * This restores normal line-buffered input with echo.
 *
 * @param term - Terminal instance to configure
 * @returns Promise that resolves when raw mode is disabled
 */
export async function disableRawMode(_term: Terminal): Promise<void> {
  if (!terminalState.rawMode) {
    return;
  }

  // Restore terminal settings
  const proc = Bun.spawn(['stty', 'sane'], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  await proc.exited;

  if (proc.exitCode !== 0) {
    throw new Error('Failed to disable raw mode');
  }

  terminalState.rawMode = false;
}

/**
 * Enable mouse tracking on the terminal
 *
 * @param term - Terminal instance to configure
 * @param options - Mouse tracking options
 */
export function enableMouse(
  term: Terminal,
  options: {
    protocol?: 'x10' | 'sgr';
    allMotion?: boolean;
  } = {}
): void {
  const { protocol = 'sgr', allMotion = false } = options;

  // Disable any existing mouse tracking first
  if (terminalState.mouseTracking) {
    disableMouse(term);
  }

  // Enable basic mouse tracking
  term.write(ESCAPE_SEQUENCES.ENABLE_MOUSE_TRACKING);

  // Enable button tracking (press/release)
  term.write(ESCAPE_SEQUENCES.ENABLE_MOUSE_BUTTONS);

  // Enable all motion if requested
  if (allMotion) {
    term.write(ESCAPE_SEQUENCES.ENABLE_MOUSE_ALL);
  }

  // Enable SGR protocol if requested
  if (protocol === 'sgr') {
    term.write(ESCAPE_SEQUENCES.ENABLE_SGR_MOUSE);
  }

  term.flush();

  terminalState.mouseTracking = true;
  terminalState.mouseProtocol = protocol;
}

/**
 * Disable mouse tracking on the terminal
 *
 * @param term - Terminal instance to configure
 */
export function disableMouse(term: Terminal): void {
  if (!terminalState.mouseTracking) {
    return;
  }

  // Disable all mouse modes
  term.write(ESCAPE_SEQUENCES.DISABLE_MOUSE_ALL);
  term.write(ESCAPE_SEQUENCES.DISABLE_MOUSE_BUTTONS);
  term.write(ESCAPE_SEQUENCES.DISABLE_MOUSE_TRACKING);

  // Disable SGR if it was enabled
  if (terminalState.mouseProtocol === 'sgr') {
    term.write(ESCAPE_SEQUENCES.DISABLE_SGR_MOUSE);
  }

  term.flush();

  terminalState.mouseTracking = false;
  terminalState.mouseProtocol = undefined;
}

/**
 * Enable Kitty keyboard protocol
 *
 * This provides enhanced keyboard reporting including:
 * - Key release events
 * - Distinguishing between different keys that produce the same character
 * - Reporting of all keys including those that don't produce characters
 *
 * @param term - Terminal instance to configure
 * @param flags - Kitty protocol flags to enable
 */
export function pushKittyKeyboard(
  term: Terminal,
  flags: number = KITTY_FLAGS.DISAMBIGUATE_ESCAPES |
    KITTY_FLAGS.REPORT_EVENT_TYPES |
    KITTY_FLAGS.REPORT_ALL_KEYS_AS_ESCAPE_CODES
): void {
  term.write(ESCAPE_SEQUENCES.PUSH_KITTY_KEYBOARD(flags));
  term.flush();
  terminalState.kittyKeyboard = true;
}

/**
 * Disable Kitty keyboard protocol
 *
 * @param term - Terminal instance to configure
 */
export function popKittyKeyboard(term: Terminal): void {
  if (!terminalState.kittyKeyboard) {
    return;
  }

  term.write(ESCAPE_SEQUENCES.POP_KITTY_KEYBOARD);
  term.flush();
  terminalState.kittyKeyboard = false;
}

/**
 * Enable bracketed paste mode
 *
 * This causes pasted text to be wrapped in special escape sequences
 * so it can be distinguished from typed input.
 *
 * @param term - Terminal instance to configure
 */
export function enableBracketedPaste(term: Terminal): void {
  if (terminalState.bracketedPaste) {
    return;
  }

  term.write(ESCAPE_SEQUENCES.ENABLE_BRACKETED_PASTE);
  term.flush();
  terminalState.bracketedPaste = true;
}

/**
 * Disable bracketed paste mode
 *
 * @param term - Terminal instance to configure
 */
export function disableBracketedPaste(term: Terminal): void {
  if (!terminalState.bracketedPaste) {
    return;
  }

  term.write(ESCAPE_SEQUENCES.DISABLE_BRACKETED_PASTE);
  term.flush();
  terminalState.bracketedPaste = false;
}

/**
 * Enable focus change events
 *
 * This causes the terminal to send events when it gains or loses focus.
 *
 * @param term - Terminal instance to configure
 */
export function enableFocusEvents(term: Terminal): void {
  if (terminalState.focusEvents) {
    return;
  }

  term.write(ESCAPE_SEQUENCES.ENABLE_FOCUS_EVENTS);
  term.flush();
  terminalState.focusEvents = true;
}

/**
 * Disable focus change events
 *
 * @param term - Terminal instance to configure
 */
export function disableFocusEvents(term: Terminal): void {
  if (!terminalState.focusEvents) {
    return;
  }

  term.write(ESCAPE_SEQUENCES.DISABLE_FOCUS_EVENTS);
  term.flush();
  terminalState.focusEvents = false;
}

/**
 * Configure all input options at once
 *
 * @param term - Terminal instance to configure
 * @param options - Input options to apply
 */
export async function configureInput(
  term: Terminal,
  options: InputOptions
): Promise<void> {
  // Configure the decoder with the same options
  configureDecoder({ kittyKeyboard: options.kittyKeyboard });

  // Always enable raw mode for input handling
  await enableRawMode(term);

  // Configure mouse if requested
  if (options.mouse) {
    enableMouse(term, {
      protocol: options.mouseProtocol,
      allMotion: true,
    });
  }

  // Configure Kitty keyboard if requested
  if (options.kittyKeyboard) {
    pushKittyKeyboard(term);
  }

  // Configure bracketed paste if requested
  if (options.bracketedPaste) {
    enableBracketedPaste(term);
  }

  // Configure focus events if requested
  if (options.focusEvents) {
    enableFocusEvents(term);
  }
}

/**
 * Reset all terminal modes to defaults
 *
 * This should be called before exiting to restore the terminal
 * to its normal state.
 *
 * @param term - Terminal instance to configure
 */
export async function resetTerminal(term: Terminal): Promise<void> {
  // Disable all special modes
  disableFocusEvents(term);
  disableBracketedPaste(term);
  popKittyKeyboard(term);
  disableMouse(term);

  // Restore normal mode
  await disableRawMode(term);

  // Show cursor
  term.showCursor();
  term.flush();
}

/**
 * Install cleanup handlers to reset terminal on exit
 *
 * @param term - Terminal instance to configure
 */
export function installCleanupHandlers(term: Terminal): void {
  // Handle Ctrl+C
  process.on('SIGINT', async () => {
    await resetTerminal(term);
    process.exit(0);
  });

  // Handle normal termination
  process.on('SIGTERM', async () => {
    await resetTerminal(term);
    process.exit(0);
  });

  // Handle uncaught errors
  process.on('uncaughtException', async (_error) => {
    await resetTerminal(term);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (_reason) => {
    await resetTerminal(term);
    process.exit(1);
  });
}
