/**
 * Terminal input handling for @hexie/tui
 *
 * This module provides comprehensive input handling including:
 * - Keyboard events with full modifier support
 * - Mouse events with SGR protocol
 * - Paste events with bracketed paste mode
 * - Focus change events
 * - Async iteration and event emitter APIs
 */

// Low-level decoder
export { InputDecoder } from './decoder.ts';
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
  installCleanupHandlers,
  popKittyKeyboard,
  pushKittyKeyboard,
  resetTerminal,
} from './enable.ts';

// Reader functions
export {
  clearInput,
  configureDecoder,
  pollEvent,
  readEvent,
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
  FocusEvent,
  InputEvent,
  InputMode,
  InputOptions,
  KeyCode,
  KeyEvent,
  KeyEventKind,
  KeyModifiers,
  MouseButton,
  MouseEvent,
  MouseEventKind,
  PasteEvent,
  ResizeEvent,
} from './types.ts';
