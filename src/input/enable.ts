/**
 * Terminal mode and feature toggle helpers
 *
 * This module provides functions to enable/disable various terminal
 * features like raw mode, mouse tracking, and special protocols.
 */

import type { Terminal } from '../terminal.ts';
import {
  type DetectedCapabilities,
  detectCapabilities,
  isFeatureSupported,
} from './detection.ts';
import { InputFeature, SupportLevel } from './features.ts';
import { ESCAPE_SEQUENCES, KITTY_FLAGS } from './protocols.ts';
import { configureDecoder } from './reader.ts';
import type { InputConfig, InputMode, InputOptions } from './types.ts';

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
  enabledFeatures: Record<string, boolean>;
  supportedFeatures: Record<string, string>;
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
  enabledFeatures: {},
  supportedFeatures: {},
};

/**
 * Initialize input with feature detection and configuration
 *
 * This function detects terminal capabilities and enables features
 * based on the provided configuration. Required features that are
 * unsupported will throw an error, while optional features will
 * degrade gracefully.
 *
 * @param term - Terminal instance to configure
 * @param config - Input configuration
 * @returns Promise that resolves to the actual input mode
 */
export async function initializeInput(
  term: Terminal,
  config: InputConfig
): Promise<InputMode> {
  // Use pre-detected capabilities if provided, otherwise detect
  let capabilities: DetectedCapabilities;
  if (config.detectedCapabilities) {
    capabilities = config.detectedCapabilities;
  } else {
    capabilities = await detectCapabilities(term, {
      performQueries: true,
    });
  }

  // Store supported features
  for (const [feature, level] of Object.entries(capabilities.features)) {
    terminalState.supportedFeatures[feature] = level as string;
  }

  // Apply overrides if provided (for testing)
  if (config.overrides) {
    for (const [feature, supported] of Object.entries(config.overrides)) {
      if (supported) {
        terminalState.supportedFeatures[feature] = SupportLevel.Full;
      } else {
        terminalState.supportedFeatures[feature] = SupportLevel.None;
      }
    }
  }

  // Always enable raw mode for input handling
  await enableRawMode(term);

  // Process each configured feature
  const errors: string[] = [];

  for (const [featureName, featureConfig] of Object.entries(config.features)) {
    if (!featureConfig?.enabled) {
      continue;
    }

    const feature = featureName as InputFeature;
    const minLevel =
      (featureConfig.options?.minLevel as SupportLevel) || SupportLevel.Partial;
    const isSupported = isFeatureSupported(capabilities, feature, minLevel);

    if (!isSupported) {
      if (featureConfig.required) {
        errors.push(
          `Required feature '${feature}' is not supported by terminal '${capabilities.terminalType}'`
        );
      }
      // Skip unsupported optional features silently
      continue;
    }

    // Enable the feature
    try {
      enableFeature(term, feature, featureConfig.options);
      terminalState.enabledFeatures[feature] = true;
    } catch (error) {
      if (featureConfig.required) {
        errors.push(`Failed to enable required feature '${feature}': ${error}`);
      }
      // Skip failed optional features silently
    }
  }

  // Throw if any required features failed
  if (errors.length > 0) {
    throw new Error(`Input initialization failed:\n${errors.join('\n')}`);
  }

  // Configure decoder with enabled features
  configureDecoder({
    kittyKeyboard: terminalState.enabledFeatures[InputFeature.KittyKeyboard],
    quirks: config.quirks !== false,
    enabledFeatures: terminalState.enabledFeatures,
    keyNormalization: config.keyNormalization ?? 'raw',
  });

  // Return the actual input mode
  return getInputStatus();
}

/**
 * Enable a specific feature
 */
function enableFeature(
  term: Terminal,
  feature: InputFeature,
  options?: Record<string, unknown>
): void {
  switch (feature) {
    case InputFeature.MouseTracking:
      enableMouse(term, {
        protocol: (options?.protocol as 'x10' | 'sgr') || 'sgr',
        allMotion: options?.allMotion !== false,
      });
      break;

    case InputFeature.KittyKeyboard:
      pushKittyKeyboard(term, options?.flags as number | undefined);
      break;

    case InputFeature.BracketedPaste:
      enableBracketedPaste(term);
      break;

    case InputFeature.FocusEvents:
      enableFocusEvents(term);
      break;

    case InputFeature.Clipboard:
      // Clipboard doesn't require enabling, just support detection
      break;

    default:
      throw new Error(`Unknown feature: ${feature}`);
  }
}

/**
 * Get the current input status
 */
export function getInputStatus(): InputMode {
  return {
    raw: terminalState.rawMode,
    echo: !terminalState.rawMode,
    mouse: terminalState.mouseTracking,
    mouseProtocol: terminalState.mouseProtocol,
    kittyKeyboard: terminalState.kittyKeyboard,
    bracketedPaste: terminalState.bracketedPaste,
    focusEvents: terminalState.focusEvents,
    enabledFeatures: { ...terminalState.enabledFeatures },
    supportedFeatures: { ...terminalState.supportedFeatures },
  };
}

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
  const proc = Bun.spawn(['stty', 'sane', 'echo', 'icanon', 'iexten'], {
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
 * This function supports both the legacy InputOptions API and the new
 * InputConfig API. When using InputOptions, it converts to InputConfig
 * internally.
 *
 * @param term - Terminal instance to configure
 * @param options - Input options to apply (legacy or modern)
 * @returns Promise that resolves to InputMode (when using InputConfig) or void
 */
export async function configureInput(
  term: Terminal,
  options: InputOptions | InputConfig
): Promise<InputMode | undefined> {
  // Check if using new InputConfig API
  if ('features' in options) {
    return initializeInput(term, options);
  }

  // Legacy API - convert to new format
  const config: InputConfig = {
    features: {},
    quirks: true,
  };

  if (options.mouse) {
    config.features[InputFeature.MouseTracking] = {
      enabled: true,
      options: {
        protocol: options.mouseProtocol || 'sgr',
        allMotion: true,
      },
    };
  }

  if (options.kittyKeyboard) {
    config.features[InputFeature.KittyKeyboard] = {
      enabled: true,
    };
  }

  if (options.bracketedPaste) {
    config.features[InputFeature.BracketedPaste] = {
      enabled: true,
    };
  }

  if (options.focusEvents) {
    config.features[InputFeature.FocusEvents] = {
      enabled: true,
    };
  }

  // Use the new API but don't return the InputMode for backward compatibility
  await initializeInput(term, config);
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

  // Clear feature tracking
  terminalState.enabledFeatures = {};
  terminalState.supportedFeatures = {};

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
