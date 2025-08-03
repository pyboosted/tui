/**
 * Input feature definitions for terminal capability detection
 *
 * This module defines the various input features that can be detected
 * and configured in different terminal environments.
 */

/**
 * Available input features that can be detected and configured
 */
export const InputFeature = {
  /** Mouse tracking using X10 or SGR protocol */
  MouseTracking: 'mouseTracking',
  /** Enhanced keyboard events with press/release and better modifier support */
  KittyKeyboard: 'kittyKeyboard',
  /** Distinguish between pasted and typed text */
  BracketedPaste: 'bracketedPaste',
  /** Terminal focus in/out events */
  FocusEvents: 'focusEvents',
  /** OSC 52 clipboard access for copy/paste */
  Clipboard: 'clipboard',
} as const;

export type InputFeature = (typeof InputFeature)[keyof typeof InputFeature];

/**
 * Terminal types that we detect and support
 */
export const TerminalType = {
  /** Kitty terminal */
  Kitty: 'kitty',
  /** Ghostty terminal */
  Ghostty: 'ghostty',
  /** iTerm2 */
  ITerm: 'iterm',
  /** tmux terminal multiplexer */
  Tmux: 'tmux',
  /** SSH session (may have limited features) */
  SSH: 'ssh',
  /** Unknown terminal type */
  Unknown: 'unknown',
} as const;

export type TerminalType = (typeof TerminalType)[keyof typeof TerminalType];

/**
 * Feature support level
 */
export const SupportLevel = {
  /** Feature is fully supported */
  Full: 'full',
  /** Feature is partially supported with limitations */
  Partial: 'partial',
  /** Feature is not supported */
  None: 'none',
} as const;

export type SupportLevel = (typeof SupportLevel)[keyof typeof SupportLevel];

/**
 * Feature support matrix for known terminals
 */
export const TERMINAL_FEATURE_SUPPORT: Record<
  TerminalType,
  Record<InputFeature, SupportLevel>
> = {
  [TerminalType.Kitty]: {
    [InputFeature.MouseTracking]: SupportLevel.Full,
    [InputFeature.KittyKeyboard]: SupportLevel.Full,
    [InputFeature.BracketedPaste]: SupportLevel.Full,
    [InputFeature.FocusEvents]: SupportLevel.Full,
    [InputFeature.Clipboard]: SupportLevel.Full,
  },
  [TerminalType.Ghostty]: {
    [InputFeature.MouseTracking]: SupportLevel.Full,
    [InputFeature.KittyKeyboard]: SupportLevel.Full,
    [InputFeature.BracketedPaste]: SupportLevel.Full,
    [InputFeature.FocusEvents]: SupportLevel.Full,
    [InputFeature.Clipboard]: SupportLevel.Full,
  },
  [TerminalType.ITerm]: {
    [InputFeature.MouseTracking]: SupportLevel.Partial,
    [InputFeature.KittyKeyboard]: SupportLevel.None,
    [InputFeature.BracketedPaste]: SupportLevel.Full,
    [InputFeature.FocusEvents]: SupportLevel.Full,
    [InputFeature.Clipboard]: SupportLevel.Full,
  },
  [TerminalType.Tmux]: {
    [InputFeature.MouseTracking]: SupportLevel.Partial,
    [InputFeature.KittyKeyboard]: SupportLevel.None,
    [InputFeature.BracketedPaste]: SupportLevel.Full,
    [InputFeature.FocusEvents]: SupportLevel.None,
    [InputFeature.Clipboard]: SupportLevel.Partial,
  },
  [TerminalType.SSH]: {
    [InputFeature.MouseTracking]: SupportLevel.Partial,
    [InputFeature.KittyKeyboard]: SupportLevel.None,
    [InputFeature.BracketedPaste]: SupportLevel.Partial,
    [InputFeature.FocusEvents]: SupportLevel.None,
    [InputFeature.Clipboard]: SupportLevel.None,
  },
  [TerminalType.Unknown]: {
    [InputFeature.MouseTracking]: SupportLevel.None,
    [InputFeature.KittyKeyboard]: SupportLevel.None,
    [InputFeature.BracketedPaste]: SupportLevel.None,
    [InputFeature.FocusEvents]: SupportLevel.None,
    [InputFeature.Clipboard]: SupportLevel.None,
  },
};

/**
 * ESC character for escape sequences
 */
const ESC = String.fromCharCode(27);

/**
 * Query sequences for feature detection
 */
export const FEATURE_QUERIES: Partial<Record<InputFeature, string>> = {
  // ESC [ ? u
  [InputFeature.KittyKeyboard]: `${ESC}[?u`,
  // Other features are detected through terminal type or responses
};

/**
 * Expected responses for feature queries
 */
export const FEATURE_RESPONSES: Partial<Record<InputFeature, RegExp>> = {
  // ESC [ ? <num> ; <num> u
  [InputFeature.KittyKeyboard]: new RegExp(
    `${ESC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\[\\?(\\d+);(\\d+)u`
  ),
};
