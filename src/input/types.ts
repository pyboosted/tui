/**
 * Input event types and interfaces for @boosted/tui
 *
 * This module provides TypeScript types for keyboard and mouse events,
 * following a Crossterm-inspired API while being idiomatic to TypeScript.
 */

/**
 * Modifier keys state for keyboard and mouse events
 */
export interface KeyModifiers {
  /** Control key pressed */
  ctrl: boolean;
  /** Alt/Option key pressed */
  alt: boolean;
  /** Shift key pressed */
  shift: boolean;
  /** Meta/Command/Windows key pressed */
  meta: boolean;
}

/**
 * Key codes for special keys and printable characters
 */
export type KeyCode =
  // Navigation keys
  | 'Up'
  | 'Down'
  | 'Left'
  | 'Right'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown'
  // Editing keys
  | 'Backspace'
  | 'Delete'
  | 'Insert'
  | 'Enter'
  | 'Tab'
  | 'Escape'
  // Function keys
  | 'F1'
  | 'F2'
  | 'F3'
  | 'F4'
  | 'F5'
  | 'F6'
  | 'F7'
  | 'F8'
  | 'F9'
  | 'F10'
  | 'F11'
  | 'F12'
  // Media keys (if supported)
  | 'PrintScreen'
  | 'Pause'
  | 'Menu'
  // Modifier keys (standalone key presses)
  | 'Shift'
  | 'Control'
  | 'Alt'
  | 'Meta'
  | 'CapsLock'
  | 'NumLock'
  | 'ScrollLock'
  // Printable character
  | { char: string };

/**
 * Key event kind (when using Kitty keyboard protocol)
 */
export type KeyEventKind =
  | 'press' // Key pressed down
  | 'repeat' // Key held down (auto-repeat)
  | 'release'; // Key released

/**
 * Keyboard event
 */
export interface KeyEvent {
  type: 'key';
  /** The key code or character */
  code: KeyCode;
  /** Modifier keys state */
  modifiers: KeyModifiers;
  /** True if this is a key repeat (legacy compatibility) */
  repeat: boolean;
  /** Event kind (press/repeat/release) - only available with Kitty protocol */
  kind?: KeyEventKind;
  /** The raw escape sequence that generated this event */
  raw: string;
}

/**
 * Mouse buttons
 */
export type MouseButton =
  | 1 // Left button
  | 2 // Right button
  | 3 // Middle button
  | 'WheelUp'
  | 'WheelDown'
  | 'WheelLeft'
  | 'WheelRight';

/**
 * Mouse event kinds
 */
export type MouseEventKind =
  | 'down' // Mouse button pressed
  | 'up' // Mouse button released
  | 'drag' // Mouse moved while button pressed
  | 'move' // Mouse moved without button pressed
  | 'scroll'; // Mouse wheel scrolled

/**
 * Mouse event
 */
export interface MouseEvent {
  type: 'mouse';
  /** The kind of mouse event */
  kind: MouseEventKind;
  /** The button involved (null for move events) */
  button: MouseButton | null;
  /** X coordinate (1-based, in terminal cells) */
  x: number;
  /** Y coordinate (1-based, in terminal cells) */
  y: number;
  /** Modifier keys state */
  modifiers: KeyModifiers;
  /** The raw escape sequence that generated this event */
  raw: string;
}

/**
 * Terminal resize event
 */
export interface ResizeEvent {
  type: 'resize';
  /** New number of columns */
  cols: number;
  /** New number of rows */
  rows: number;
}

/**
 * Paste event (bracketed paste mode)
 */
export interface PasteEvent {
  type: 'paste';
  /** The pasted text */
  content: string;
}

/**
 * Focus change events
 */
export interface FocusEvent {
  type: 'focus';
  /** True if terminal gained focus, false if lost */
  gained: boolean;
}

/**
 * Clipboard event (OSC 52 response)
 */
export interface ClipboardEvent {
  type: 'clipboard';
  /** The clipboard content */
  content: string;
}

/**
 * All possible input events
 */
export type InputEvent =
  | KeyEvent
  | MouseEvent
  | ResizeEvent
  | PasteEvent
  | FocusEvent
  | ClipboardEvent;

/**
 * Options for configuring input handling
 */
export interface InputOptions {
  /** Enable mouse tracking */
  mouse?: boolean;
  /** Mouse tracking protocol to use */
  mouseProtocol?: 'x10' | 'sgr';
  /** Enable Kitty keyboard protocol for enhanced key detection */
  kittyKeyboard?: boolean;
  /** Enable bracketed paste mode */
  bracketedPaste?: boolean;
  /** Enable focus change events */
  focusEvents?: boolean;
}

/**
 * Input mode configuration
 */
export interface InputMode {
  /** Raw mode enabled */
  raw: boolean;
  /** Echo disabled */
  echo: boolean;
  /** Mouse tracking enabled */
  mouse: boolean;
  /** Current mouse protocol */
  mouseProtocol?: 'x10' | 'sgr';
  /** Kitty keyboard protocol enabled */
  kittyKeyboard: boolean;
  /** Bracketed paste enabled */
  bracketedPaste: boolean;
  /** Focus events enabled */
  focusEvents: boolean;
}

/**
 * Decoder state for partial sequence handling
 */
export interface DecoderState {
  /** Current parser state */
  state: 'idle' | 'escape' | 'csi' | 'ss3' | 'osc' | 'dcs';
  /** Accumulated parameters */
  params: number[];
  /** Intermediate characters */
  intermediates: string;
  /** Final character */
  final: string;
  /** Buffer for partial sequences */
  buffer: Uint8Array;
  /** Current buffer position */
  position: number;
}
