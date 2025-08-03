/**
 * Terminal input handling for @hexie/tui
 *
 * This module provides comprehensive input handling including:
 * - Keyboard events with full modifier support
 * - Mouse events with SGR protocol
 * - Paste events with bracketed paste mode
 * - Focus change events
 * - Async iteration and event emitter APIs
 *
 * New features in v2:
 * - Automatic terminal capability detection
 * - Required vs optional feature configuration
 * - Graceful degradation for unsupported features
 * - Terminal-specific quirk handling
 *
 * @example
 * ```typescript
 * // Detect and initialize with optional features
 * const inputMode = await input.initializeInput(term, {
 *   features: {
 *     [input.InputFeature.MouseTracking]: { enabled: true },
 *     [input.InputFeature.KittyKeyboard]: { enabled: true, required: false },
 *   }
 * });
 *
 * // Check what was enabled
 * if (inputMode.enabledFeatures?.mouseTracking) {
 *   console.log('Mouse tracking is available!');
 * }
 * ```
 */

// Low-level decoder
export { InputDecoder } from './decoder.ts';
// Feature detection
export {
  clearCapabilitiesCache,
  type DetectedCapabilities,
  detectCapabilities,
  isFeatureSupported,
} from './detection.ts';
// Terminal mode helpers
export {
  configureInput,
  disableBracketedPaste,
  disableFocusEvents,
  disableMouse,
  disableRawMode,
  enableBracketedPaste,
  enableFocusEvents,
  enableMouse,
  enableRawMode,
  getInputStatus,
  initializeInput,
  installCleanupHandlers,
  popKittyKeyboard,
  pushKittyKeyboard,
  resetTerminal,
} from './enable.ts';
// Features
export { InputFeature, SupportLevel, TerminalType } from './features.ts';
// Key utilities
export {
  areKeysEqual,
  getUnshiftedChar,
  isShiftedChar,
  normalizeShiftModifier,
  normalizeToBaseKey,
} from './key-utils.ts';
// Reader functions
export {
  clearInput,
  configureDecoder,
  pollEvent,
  readEvent,
  releaseStdinReader,
  tryReadEvent,
} from './reader.ts';
// Stream API
export {
  createEventStream,
  InputEventEmitter,
  type InputEventStream,
} from './stream.ts';

// Core types
export type {
  FeatureConfig,
  FocusEvent,
  InputConfig,
  InputEvent,
  InputMode,
  InputOptions,
  KeyCode,
  KeyEvent,
  KeyEventKind,
  KeyModifiers,
  KeyNormalization,
  MouseButton,
  MouseEvent,
  MouseEventKind,
  PasteEvent,
  ResizeEvent,
} from './types.ts';
