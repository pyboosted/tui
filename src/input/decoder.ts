/**
 * State machine decoder for terminal input sequences
 *
 * This module implements a zero-allocation state machine for parsing
 * terminal escape sequences into typed input events.
 */

import {
  CSI_KEY_MAP,
  CTRL_CHARS,
  MAX_CSI_PARAM,
  MAX_CSI_PARAMS,
  MOUSE_MODIFIER_MASK,
  SEQUENCE_BUFFER_SIZE,
  SGR_BUTTON_MAP,
  SS3_KEY_MAP,
} from './protocols.ts';
import {
  remapAltEscapeChar,
  remapControlChar,
  remapKeyCode,
} from './terminal-quirks.ts';
import type {
  InputEvent,
  KeyCode,
  KeyEvent,
  KeyEventKind,
  KeyModifiers,
  MouseButton,
  MouseEvent,
} from './types.ts';

/**
 * Parser states for the state machine
 */
type ParserState =
  | 'idle'
  | 'escape'
  | 'csi'
  | 'csi_param'
  | 'csi_intermediate'
  | 'ss3'
  | 'osc'
  | 'dcs'
  | 'paste';

/**
 * Input decoder state machine
 */
export class InputDecoder {
  private state: ParserState = 'idle';
  private buffer = new Uint8Array(SEQUENCE_BUFFER_SIZE);
  private bufferPos = 0;
  private params: number[] = [];
  private intermediates = '';
  private final = '';
  private events: InputEvent[] = [];

  // Mouse tracking state
  private lastMouseButton: MouseButton | null = null;

  // Paste buffer
  private pasteBuffer = '';
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Used in state management
  private inPaste = false;

  // OSC buffer for sequences like clipboard
  private oscBuffer = '';
  private oscParam = '';

  // Kitty keyboard protocol state
  private kittyEnabled = false;

  // Terminal quirks handling
  private quirksEnabled = true;

  // Track physical modifier key state to work around terminal bugs
  private physicalModifierState = {
    shift: false,
    ctrl: false,
    alt: false,
    meta: false,
  };

  constructor(options?: { kittyKeyboard?: boolean; quirks?: boolean }) {
    this.kittyEnabled = options?.kittyKeyboard ?? false;
    this.quirksEnabled = options?.quirks ?? true;
    this.reset();
  }

  /**
   * Feed input bytes to the decoder
   */
  feed(data: Uint8Array): void {
    for (const byte of data) {
      this.processByte(byte);
    }
  }

  /**
   * Get the next available event
   */
  next(): InputEvent | null {
    return this.events.shift() || null;
  }

  /**
   * Check if events are available
   */
  hasEvents(): boolean {
    return this.events.length > 0;
  }

  /**
   * Clear all pending events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Reset decoder state
   */
  private reset(): void {
    this.state = 'idle';
    this.bufferPos = 0;
    this.params = [];
    this.intermediates = '';
    this.final = '';
    this.oscBuffer = '';
    this.oscParam = '';
  }

  /**
   * Process a single byte through the state machine
   */
  private processByte(byte: number): void {
    // Store byte in buffer for raw sequence tracking
    if (this.bufferPos < SEQUENCE_BUFFER_SIZE) {
      this.buffer[this.bufferPos++] = byte;
    }

    switch (this.state) {
      case 'idle':
        this.processIdle(byte);
        break;
      case 'escape':
        this.processEscape(byte);
        break;
      case 'csi':
        this.processCSI(byte);
        break;
      case 'csi_param':
        this.processCSIParam(byte);
        break;
      case 'csi_intermediate':
        this.processCSIIntermediate(byte);
        break;
      case 'ss3':
        this.processSS3(byte);
        break;
      case 'paste':
        this.processPaste(byte);
        break;
      case 'osc':
        this.processOSC(byte);
        break;
      case 'dcs':
        // Skip DCS sequences for now
        if (byte === 0x1b) {
          this.state = 'escape';
        } else if (byte === 0x07) {
          this.reset();
        }
        break;
      default:
        // Unknown state - reset
        this.reset();
    }
  }

  /**
   * Process byte in idle state
   */
  private processIdle(byte: number): void {
    if (byte === 0x1b) {
      // Start escape sequence
      this.state = 'escape';
      this.bufferPos = 1;
      this.buffer[0] = byte;
    } else if (byte < 0x20 || byte === 0x7f) {
      // Control character
      // When Kitty is enabled with REPORT_ALL_KEYS_AS_ESCAPE_CODES,
      // control characters are normally followed by Kitty sequences
      // However, some terminals send control chars for Meta combinations
      // without proper Kitty sequences
      if (this.kittyEnabled) {
        // Check if this is a Meta key combination that the terminal
        // sends as a control char instead of a proper Kitty sequence
        const remapped = this.quirksEnabled ? remapControlChar(byte) : null;
        if (remapped) {
          // This is a known Meta+key combination sent as control char
          this.handleControlChar(byte);
        }
        // Otherwise suppress it to avoid duplicates
      } else {
        this.handleControlChar(byte);
      }
    } else {
      // Regular printable character
      const char = String.fromCharCode(byte);

      // When Kitty is enabled, suppress the raw character
      // The Kitty sequence will provide the full event with modifiers
      if (!this.kittyEnabled) {
        this.emitKey({ char }, false);
      }
    }
  }

  /**
   * Process byte in escape state
   */
  private processEscape(byte: number): void {
    switch (byte) {
      case 0x5b: // [
        this.state = 'csi';
        this.params = [];
        this.intermediates = '';
        break;
      case 0x4f: // O
        this.state = 'ss3';
        break;
      case 0x50: // P
        this.state = 'dcs';
        break;
      case 0x5d: // ]
        this.state = 'osc';
        this.oscBuffer = '';
        this.oscParam = '';
        break;
      default:
        // Single escape sequence
        this.handleEscapeChar(byte);
        this.reset();
    }
  }

  /**
   * Process byte in CSI state
   */
  private processCSI(byte: number): void {
    if (byte >= 0x30 && byte <= 0x39) {
      // Digit
      this.state = 'csi_param';
      this.params.push(byte - 0x30);
    } else if (byte === 0x3b || byte === 0x3a) {
      // Semicolon or colon - parameter separator (colon used in Kitty protocol)
      this.params.push(0);
      this.state = 'csi_param';
    } else if (byte === 0x3c) {
      // < - SGR mouse intermediate
      this.intermediates = '<';
      this.state = 'csi_param'; // Continue parsing parameters
    } else if (byte >= 0x20 && byte <= 0x2f) {
      // Other intermediates
      this.intermediates = String.fromCharCode(byte);
      this.state = 'csi_intermediate';
    } else if (byte >= 0x40 && byte <= 0x7e) {
      // Final
      this.final = String.fromCharCode(byte);
      this.handleCSISequence();
      // Only reset if we didn't switch to paste mode
      if (this.state !== 'paste') {
        this.reset();
      }
    } else {
      // Invalid sequence
      this.reset();
    }
  }

  /**
   * Process byte in CSI parameter state
   */
  private processCSIParam(byte: number): void {
    if (byte >= 0x30 && byte <= 0x39) {
      // Digit - accumulate parameter
      if (this.params.length === 0) {
        // First parameter
        this.params.push(byte - 0x30);
      } else {
        const lastParam = this.params.length - 1;
        const currentValue = this.params[lastParam];
        if (currentValue !== undefined && currentValue < MAX_CSI_PARAM) {
          this.params[lastParam] = currentValue * 10 + (byte - 0x30);
        }
      }
    } else if (byte === 0x3b || byte === 0x3a) {
      // Semicolon or colon - parameter separator
      // Colon is used in Kitty protocol for sub-parameters
      if (this.params.length < MAX_CSI_PARAMS) {
        this.params.push(0);
      }
    } else if (byte >= 0x20 && byte <= 0x2f) {
      // Intermediate
      this.intermediates += String.fromCharCode(byte);
      this.state = 'csi_intermediate';
    } else if (byte >= 0x40 && byte <= 0x7e) {
      // Final
      this.final = String.fromCharCode(byte);
      this.handleCSISequence();
      // Only reset if we didn't switch to paste mode
      if (this.state !== 'paste') {
        this.reset();
      }
    } else {
      // Invalid sequence
      this.reset();
    }
  }

  /**
   * Process byte in CSI intermediate state
   */
  private processCSIIntermediate(byte: number): void {
    if (byte >= 0x30 && byte <= 0x39) {
      // Digit - this might be parameters after intermediate
      this.state = 'csi_param';
      this.params.push(byte - 0x30);
    } else if (byte >= 0x20 && byte <= 0x2f) {
      // More intermediates
      this.intermediates += String.fromCharCode(byte);
    } else if (byte >= 0x40 && byte <= 0x7e) {
      // Final
      this.final = String.fromCharCode(byte);
      this.handleCSISequence();
      // Only reset if we didn't switch to paste mode
      if (this.state !== 'paste') {
        this.reset();
      }
    } else {
      // Invalid sequence
      this.reset();
    }
  }

  /**
   * Process byte in SS3 state
   */
  private processSS3(byte: number): void {
    const key = SS3_KEY_MAP[String.fromCharCode(byte)];
    if (key) {
      this.emitKey(key, false);
    } else {
      // Unknown SS3 sequence - emit for debugging
      const unknownKey = `Unknown:SS3+${String.fromCharCode(byte)}`;
      this.emitKey({ char: unknownKey }, false);
    }
    this.reset();
  }

  /**
   * Process byte in paste state
   */
  private processPaste(byte: number): void {
    // First, add the byte to the paste buffer
    this.pasteBuffer += String.fromCharCode(byte);

    // Check if we have accumulated the paste end sequence
    if (
      this.pasteBuffer.length >= 6 &&
      this.pasteBuffer.endsWith('\x1b[201~')
    ) {
      // Remove the end sequence from the paste buffer
      this.pasteBuffer = this.pasteBuffer.slice(0, -6);

      // Emit the paste event
      this.events.push({
        type: 'paste',
        content: this.pasteBuffer,
      });

      this.pasteBuffer = '';
      this.inPaste = false;
      this.reset();
    }
  }

  /**
   * Process OSC (Operating System Command) sequences
   */
  private processOSC(byte: number): void {
    if (byte === 0x1b) {
      // Might be start of ST (String Terminator) ESC \
      // Store the ESC in buffer
      this.oscBuffer += '\x1b';
      return;
    }
    if (byte === 0x5c && this.oscBuffer.endsWith('\x1b')) {
      // ESC \ terminator
      this.oscBuffer = this.oscBuffer.slice(0, -1); // Remove the ESC
      this.handleOSCSequence();
      this.reset();
      return;
    }
    if (byte === 0x07) {
      // BEL terminator
      this.handleOSCSequence();
      this.reset();
      return;
    }

    // Accumulate OSC data
    this.oscBuffer += String.fromCharCode(byte);

    // Safety: prevent buffer from growing too large
    if (this.oscBuffer.length > 10_000) {
      // OSC sequence too long, abort
      this.reset();
      return;
    }

    // Parse OSC parameter if we haven't yet
    if (!this.oscParam && this.oscBuffer.includes(';')) {
      const firstSemiIndex = this.oscBuffer.indexOf(';');
      this.oscParam = this.oscBuffer.substring(0, firstSemiIndex);
      this.oscBuffer = this.oscBuffer.substring(firstSemiIndex + 1);
    }
  }

  /**
   * Handle complete OSC sequence
   */
  private handleOSCSequence(): void {
    // OSC sequences are processed in processBuffer
    if (process.env.DEBUG_OSC) {
      // OSC debugging enabled
    }

    // OSC 52 clipboard sequence
    if (this.oscParam === '52') {
      // Format: OSC 52 ; c ; base64-data
      const parts = this.oscBuffer.split(';');
      if (parts.length >= 2 && parts[0] === 'c') {
        // Clipboard response
        const base64Data = parts[1];
        try {
          const clipboardContent = Buffer.from(base64Data, 'base64').toString(
            'utf8'
          );
          this.events.push({
            type: 'clipboard',
            content: clipboardContent,
          });
        } catch (_e) {
          // Invalid base64, ignore
          if (process.env.DEBUG_OSC) {
            // Log OSC errors when debugging
          }
        }
      }
    }

    // Clear OSC buffers
    this.oscBuffer = '';
    this.oscParam = '';
  }

  /**
   * Handle control character
   */
  private handleControlChar(byte: number): void {
    // Check if this control char should be remapped to Meta+key
    const remapped = this.quirksEnabled ? remapControlChar(byte) : null;
    if (remapped) {
      this.emitKey(remapped.key, false, remapped.modifiers);
      return;
    }

    const code = CTRL_CHARS[byte];
    if (code) {
      const isCtrlChar =
        byte < 0x20 &&
        byte !== 0x09 &&
        byte !== 0x0a &&
        byte !== 0x0d &&
        byte !== 0x1b;
      this.emitKey(code, isCtrlChar);
    }
  }

  /**
   * Handle single escape character
   */
  private handleEscapeChar(byte: number): void {
    // Alt+key combinations
    if (byte >= 0x20 && byte < 0x7f) {
      const char = String.fromCharCode(byte);

      // Check if this should be remapped to Alt+arrow
      const remappedKey = this.quirksEnabled ? remapAltEscapeChar(char) : null;
      if (remappedKey) {
        this.emitKey(remappedKey as KeyCode, false, { alt: true });
      } else {
        this.emitKey({ char }, false, { alt: true });
      }
    } else {
      // Unknown escape sequence - emit it for debugging
      const unknownKey = `Unknown:ESC+${String.fromCharCode(byte)}`;
      this.emitKey({ char: unknownKey }, false);
    }
  }

  /**
   * Handle complete CSI sequence
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This function handles many different CSI sequences and needs to remain complex
  private handleCSISequence(): void {
    // Check for bracketed paste start
    if (this.final === '~' && this.params[0] === 200) {
      this.state = 'paste';
      this.inPaste = true;
      this.pasteBuffer = '';
      this.bufferPos = 0; // Reset buffer for paste content
      return;
    }

    // Check for Kitty keyboard protocol sequences
    if (this.final === 'u' && !this.intermediates) {
      this.handleKittyKeyboard();
      return;
    }

    // Check for SGR mouse sequence (< intermediate)
    if (
      this.intermediates === '<' &&
      (this.final === 'M' || this.final === 'm')
    ) {
      this.handleSGRMouseComplete();
      return;
    }

    // Check for X10 mouse sequence
    if (this.final === 'M') {
      this.handleX10Mouse();
      return;
    }

    // Special handling for keys with Kitty-like sequences (ESC[1;1:1X format)
    // These are keys with event type info but not full Kitty protocol

    // Arrow keys and navigation keys (A, B, C, D, H, F)
    if (
      (this.final === 'A' ||
        this.final === 'B' ||
        this.final === 'C' ||
        this.final === 'D' ||
        this.final === 'H' ||
        this.final === 'F') &&
      this.params.length >= 2
    ) {
      // Extract event type from params (after colon in original sequence)
      // The params array doesn't preserve the colon distinction, but we can infer it
      const eventType = this.params.at(-1);
      const modParam = this.params[1] || 1;

      const keyMap: Record<string, KeyCode> = {
        A: 'Up',
        B: 'Down',
        C: 'Right',
        D: 'Left',
        H: 'Home',
        F: 'End',
      };

      const key = keyMap[this.final];
      if (key) {
        const modifiers = modParam > 1 ? this.extractModifiers() : {};

        // Determine event kind based on event type parameter
        let kind: KeyEventKind | undefined;
        if (eventType === 1) {
          kind = 'press';
        } else if (eventType === 2) {
          kind = 'repeat';
        } else if (eventType === 3) {
          kind = 'release';
        }

        this.emitKey(key, false, modifiers, kind);
        return;
      }
    }

    // Function keys F1-F4 with event types (P, Q, R, S)
    if (
      (this.final === 'P' ||
        this.final === 'Q' ||
        this.final === 'R' ||
        this.final === 'S') &&
      this.params.length >= 2
    ) {
      const eventType = this.params.at(-1);
      const modParam = this.params[1] || 1;

      const keyMap: Record<string, KeyCode> = {
        P: 'F1',
        Q: 'F2',
        R: 'F3',
        S: 'F4',
      };

      const key = keyMap[this.final];
      if (key) {
        const modifiers = modParam > 1 ? this.extractModifiers() : {};

        let kind: KeyEventKind | undefined;
        if (eventType === 1) {
          kind = 'press';
        } else if (eventType === 2) {
          kind = 'repeat';
        } else if (eventType === 3) {
          kind = 'release';
        }

        this.emitKey(key, false, modifiers, kind);
        return;
      }
    }

    // Function keys and other keys with tilde suffix and event types (ESC[XX;1:Y~ format)
    if (this.final === '~' && this.params.length >= 2) {
      // Check if last param looks like an event type (after colon)
      const lastParam = this.params.at(-1);
      const secondLastParam = this.params.at(-2);

      // Case 1: [13, 1, 3] for ESC[13;1:3~ (no modifiers, with event type)
      if (
        lastParam !== undefined &&
        lastParam >= 1 &&
        lastParam <= 3 &&
        secondLastParam === 1
      ) {
        const keyCode = this.params[0];
        let kind: KeyEventKind | undefined;

        if (lastParam === 1) {
          kind = 'press';
        } else if (lastParam === 2) {
          kind = 'repeat';
        } else if (lastParam === 3) {
          kind = 'release';
        }

        // Look up the key
        const lookupKey = `${keyCode}~`;
        const key = CSI_KEY_MAP[lookupKey];

        if (key) {
          this.emitKey(key, false, {}, kind);
          return;
        }
      }

      // Case 2: [5, 2] for ESC[5;2~ (with modifiers, press event)
      // or [5, 2, 3] for ESC[5;2:3~ (with modifiers and event type)
      const keyCode = this.params[0];
      const lookupKey = `${keyCode}~`;
      const key = CSI_KEY_MAP[lookupKey];

      if (key && this.params.length >= 2) {
        // Extract modifiers from second parameter
        const modParam = this.params[1];
        const modifiers =
          modParam > 1 ? this.extractModifiersFromParam(modParam) : {};

        // Check if we have event type (3rd param or after colon)
        let kind: KeyEventKind | undefined;
        if (this.params.length === 2) {
          // Simple format like ESC[5;2~ - this is a press event
          kind = this.kittyEnabled ? 'press' : undefined;
        } else if (this.params.length >= 3) {
          // Format like ESC[5;2:3~ - has event type
          const eventType = this.params.at(-1);
          if (eventType === 1) {
            kind = 'press';
          } else if (eventType === 2) {
            kind = 'repeat';
          } else if (eventType === 3) {
            kind = 'release';
          }
        }

        this.emitKey(key, false, modifiers, kind);
        return;
      }
    }

    // Handle keyboard sequences
    const key = this.lookupCSIKey();
    if (key) {
      const modifiers = this.extractModifiers();
      // When Kitty keyboard protocol is enabled, simple sequences without
      // explicit event type are press events, not immediate
      const kind = this.kittyEnabled ? 'press' : undefined;
      this.emitKey(key, false, modifiers, kind);
    } else {
      // Emit unknown sequence event so it can be displayed
      // This helps with debugging unrecognized sequences
      const modifiers = this.extractModifiers();
      const unknownKey = `Unknown:${this.final}`;
      const kind = this.kittyEnabled ? 'press' : undefined;
      this.emitKey({ char: unknownKey }, false, modifiers, kind);
    }
  }

  /**
   * Lookup CSI key sequence
   */
  private lookupCSIKey(): KeyCode | null {
    // Build lookup key
    let lookupKey = '';

    if (this.params.length > 0) {
      lookupKey = this.params.join(';');
    }

    if (this.intermediates) {
      lookupKey += this.intermediates;
    }

    lookupKey += this.final;

    const keyFromLookup = CSI_KEY_MAP[lookupKey];
    const keyFromFinal = CSI_KEY_MAP[this.final];
    return keyFromLookup || keyFromFinal || null;
  }

  /**
   * Extract modifiers from CSI parameters
   */
  private extractModifiers(): Partial<KeyModifiers> {
    if (this.params.length < 2) {
      return {};
    }

    const secondParam = this.params[1];
    if (secondParam === undefined) {
      return {};
    }

    const modParam = secondParam - 1;
    return {
      shift: (modParam & 1) !== 0,
      alt: (modParam & 2) !== 0,
      ctrl: (modParam & 4) !== 0,
      meta: (modParam & 8) !== 0,
    };
  }

  /**
   * Extract modifiers from a single parameter value
   */
  private extractModifiersFromParam(param: number): Partial<KeyModifiers> {
    if (!param || param === 1) {
      return {};
    }

    const modParam = param - 1;
    return {
      shift: (modParam & 1) !== 0,
      alt: (modParam & 2) !== 0,
      ctrl: (modParam & 4) !== 0,
      meta: (modParam & 8) !== 0,
    };
  }

  /**
   * Handle X10 mouse protocol
   */
  private handleX10Mouse(): void {
    if (this.bufferPos < 6) {
      return;
    }

    const buttonByte = this.buffer[3];
    const xByte = this.buffer[4];
    const yByte = this.buffer[5];

    if (
      buttonByte === undefined ||
      xByte === undefined ||
      yByte === undefined
    ) {
      return;
    }

    const button = buttonByte - 32;
    const x = xByte - 32;
    const y = yByte - 32;

    this.emitMouse(button, x, y, 'x10');
  }

  /**
   * Handle complete SGR mouse sequence
   */
  private handleSGRMouseComplete(): void {
    // SGR format: CSI < button ; x ; y M/m
    // params[0] = button + modifiers
    // params[1] = x coordinate
    // params[2] = y coordinate
    // final = 'M' for press/motion, 'm' for release

    if (this.params.length < 3) {
      return;
    }

    const button = this.params[0] || 0;
    const x = this.params[1] || 1;
    const y = this.params[2] || 1;

    this.emitMouse(button, x, y, 'sgr');
  }

  /**
   * Handle Kitty keyboard protocol sequences
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This function handles the complex Kitty keyboard protocol with many special cases
  private handleKittyKeyboard(): void {
    // Kitty protocol sends: ESC [ unicode-key-code ; modifiers : event-type u
    // Our parser treats : as separator, so "97;1:3" becomes params [97, 1, 3]

    if (this.params.length === 0) {
      // ESC [ u - This is just a report event, ignore it
      return;
    }

    const unicode = this.params[0];
    let modifiers = 1;
    let eventType = 1;

    // The sequence can be:
    // ESC [ unicode u                     (simple, no modifiers)
    // ESC [ unicode ; modifiers u         (with modifiers, default press event)
    // ESC [ unicode ; modifiers : type u  (full format)

    if (this.params.length === 1) {
      // ESC [ unicode u - no modifiers, default press event
      modifiers = 1;
      eventType = 1;
    } else if (this.params.length === 2) {
      // ESC [ unicode ; modifiers u
      modifiers = this.params[1];
      eventType = 1; // Default to press
    } else if (this.params.length >= 3) {
      // ESC [ unicode ; modifiers : type u
      modifiers = this.params[1];
      eventType = this.params[2];
    }

    if (process.env.DEBUG_KITTY) {
      // Log Kitty protocol details when debugging
    }

    // Convert event type to our enum
    let kind: KeyEventKind = 'press';
    let _repeat = false;

    switch (eventType) {
      case 1:
        kind = 'press';
        break;
      case 2:
        kind = 'repeat';
        _repeat = true;
        break;
      case 3:
        kind = 'release';
        break;
      default:
        // Unknown event type, default to press
        kind = 'press';
        break;
    }

    // Handle all Unicode characters and special keys
    if (unicode) {
      const kittyModifiers = this.extractKittyModifiers(modifiers);

      // Special handling for Escape key with modifiers
      // Some terminals only send release events for Ctrl+Escape and Meta+Escape
      if (
        unicode === 27 &&
        kind === 'release' &&
        (kittyModifiers.ctrl || kittyModifiers.meta)
      ) {
        // Emit as immediate event without kind
        this.emitKey('Escape', false, kittyModifiers);
        return;
      }

      // Check if it's a special key first
      const keyCode = this.mapUnicodeToKeyCode(unicode);
      if (keyCode) {
        // Apply terminal-specific remapping if needed
        const actualKeyCode =
          typeof keyCode === 'string' && this.quirksEnabled
            ? remapKeyCode(unicode, keyCode)
            : keyCode;

        // Track physical modifier key state
        if (
          actualKeyCode === 'Shift' ||
          actualKeyCode === 'Control' ||
          actualKeyCode === 'Alt' ||
          actualKeyCode === 'Meta'
        ) {
          // Update our tracked state
          const stateKey =
            actualKeyCode === 'Control'
              ? 'ctrl'
              : (actualKeyCode.toLowerCase() as 'shift' | 'alt' | 'meta');

          if (kind === 'release') {
            this.physicalModifierState[stateKey] = false;
          } else if (kind === 'press') {
            this.physicalModifierState[stateKey] = true;
          }

          // Work around terminal bugs: clear modifiers that shouldn't be set
          // based on our tracked physical state
          const adjustedModifiers = { ...kittyModifiers };

          // Only apply workaround if quirks are enabled
          if (this.quirksEnabled) {
            // If we know a modifier was released, clear it even if terminal says it's set
            if (!this.physicalModifierState.shift && kittyModifiers.shift) {
              adjustedModifiers.shift = false;
            }
            if (!this.physicalModifierState.ctrl && kittyModifiers.ctrl) {
              adjustedModifiers.ctrl = false;
            }
            if (!this.physicalModifierState.alt && kittyModifiers.alt) {
              adjustedModifiers.alt = false;
            }
            if (!this.physicalModifierState.meta && kittyModifiers.meta) {
              adjustedModifiers.meta = false;
            }
          }

          // Also remove the self-modifier (e.g., Shift key shouldn't have Shift modifier)
          if (actualKeyCode === 'Shift') {
            adjustedModifiers.shift = false;
          } else if (actualKeyCode === 'Control') {
            adjustedModifiers.ctrl = false;
          } else if (actualKeyCode === 'Alt') {
            adjustedModifiers.alt = false;
          } else if (actualKeyCode === 'Meta') {
            adjustedModifiers.meta = false;
          }

          this.emitKey(actualKeyCode, false, adjustedModifiers, kind);
        } else {
          // For non-modifier keys, apply the same workaround
          const adjustedModifiers = { ...kittyModifiers };

          // Only apply workaround if quirks are enabled
          if (this.quirksEnabled) {
            // Clear any modifiers we know were released
            if (!this.physicalModifierState.shift && kittyModifiers.shift) {
              adjustedModifiers.shift = false;
            }
            if (!this.physicalModifierState.ctrl && kittyModifiers.ctrl) {
              adjustedModifiers.ctrl = false;
            }
            if (!this.physicalModifierState.alt && kittyModifiers.alt) {
              adjustedModifiers.alt = false;
            }
            if (!this.physicalModifierState.meta && kittyModifiers.meta) {
              adjustedModifiers.meta = false;
            }
          }

          this.emitKey(keyCode, false, adjustedModifiers, kind);
        }
      } else if (unicode >= 32) {
        // Handle all printable Unicode characters
        // Apply same modifier state fix only if quirks are enabled
        const adjustedModifiers = { ...kittyModifiers };

        if (this.quirksEnabled) {
          if (!this.physicalModifierState.shift && kittyModifiers.shift) {
            adjustedModifiers.shift = false;
          }
          if (!this.physicalModifierState.ctrl && kittyModifiers.ctrl) {
            adjustedModifiers.ctrl = false;
          }
          if (!this.physicalModifierState.alt && kittyModifiers.alt) {
            adjustedModifiers.alt = false;
          }
          if (!this.physicalModifierState.meta && kittyModifiers.meta) {
            adjustedModifiers.meta = false;
          }
        }

        const char = String.fromCodePoint(unicode);
        this.emitKey({ char }, false, adjustedModifiers, kind);
      }
    }
  }

  /**
   * Extract modifiers from Kitty protocol
   */
  private extractKittyModifiers(modifiers: number): Partial<KeyModifiers> {
    if (!modifiers || modifiers === 1) {
      return {};
    }

    // Kitty protocol modifier encoding:
    // The value is 1 + sum of:
    // 1 = shift, 2 = alt, 4 = ctrl, 8 = meta/super
    const mod = modifiers - 1;

    return {
      shift: (mod & 1) !== 0,
      alt: (mod & 2) !== 0,
      ctrl: (mod & 4) !== 0,
      meta: (mod & 8) !== 0,
    };
  }

  /**
   * Map Unicode code points to special key codes
   */
  private mapUnicodeToKeyCode(unicode: number): KeyCode | null {
    // Common special keys in Kitty protocol
    switch (unicode) {
      case 13:
        return 'Enter';
      case 27:
        return 'Escape';
      case 9:
        return 'Tab';
      case 127:
        return 'Backspace';

      // Arrow keys
      case 0x1b_5b_41:
        return 'Up'; // ESC[A
      case 0x1b_5b_42:
        return 'Down'; // ESC[B
      case 0x1b_5b_43:
        return 'Right'; // ESC[C
      case 0x1b_5b_44:
        return 'Left'; // ESC[D

      // Function keys (F1-F12 have specific codes)
      case 0x1b_4f_50:
        return 'F1';
      case 0x1b_4f_51:
        return 'F2';
      case 0x1b_4f_52:
        return 'F3';
      case 0x1b_4f_53:
        return 'F4';

      // Modifier keys in Kitty protocol (0xE061-0xE06B range)
      // NOTE: The standard Kitty protocol mapping is:
      // 57441-57442: Shift keys
      // 57443-57444: Control keys
      // 57445-57446: Alt keys
      // 57447-57448: Meta/Super keys
      case 57_441:
        return 'Shift'; // Left Shift (0xE061)
      case 57_442:
        return 'Shift'; // Right Shift (0xE062)
      case 57_443:
        return 'Control'; // Left Control (0xE063)
      case 57_444:
        return 'Control'; // Right Control (0xE064)
      case 57_445:
        return 'Alt'; // Left Alt (0xE065)
      case 57_446:
        return 'Alt'; // Right Alt (0xE066)
      case 57_447:
        return 'Meta'; // Left Super/Meta (0xE067)
      case 57_448:
        return 'Meta'; // Right Super/Meta (0xE068)
      case 57_449:
        return 'CapsLock'; // Caps Lock (0xE069)
      case 57_450:
        return 'NumLock'; // Num Lock (0xE06A)
      case 57_451:
        return 'ScrollLock'; // Scroll Lock (0xE06B)

      // Delete key
      case 0x1b_5b_33:
        return 'Delete'; // ESC[3~
      case 2221:
        return 'Delete'; // Forward delete in Kitty

      // Additional navigation keys in Kitty
      case 2:
        return 'Insert';
      case 5:
        return 'PageUp';
      case 6:
        return 'PageDown';

      // Home/End in Kitty
      case 1:
        return 'Home';
      case 4:
        return 'End';

      default:
        return null;
    }
  }

  /**
   * Emit mouse event
   */
  private emitMouse(
    button: number,
    x: number,
    y: number,
    protocol: 'x10' | 'sgr'
  ): void {
    const modifiers: KeyModifiers = {
      shift: (button & MOUSE_MODIFIER_MASK.SHIFT) !== 0,
      alt: (button & MOUSE_MODIFIER_MASK.ALT) !== 0,
      ctrl: (button & MOUSE_MODIFIER_MASK.CTRL) !== 0,
      meta: (button & MOUSE_MODIFIER_MASK.META) !== 0,
    };

    // Extract button info
    // For SGR, check if it's a wheel event first (64-67)
    const buttonCode = (() => {
      if (protocol === 'sgr') {
        return button >= 64 && button <= 67 ? button : button & 0x03;
      }
      return button & 0x43;
    })();
    const isRelease = protocol === 'sgr' && this.final === 'm';
    const isMotion = (button & 0x20) !== 0;

    let mappedButton: MouseButton | null = null;
    let kind: MouseEvent['kind'] = 'down';

    if (buttonCode in SGR_BUTTON_MAP) {
      mappedButton = SGR_BUTTON_MAP[buttonCode as keyof typeof SGR_BUTTON_MAP];

      if (
        typeof mappedButton === 'string' &&
        mappedButton.startsWith('Wheel')
      ) {
        kind = 'scroll';
      } else if (isRelease) {
        kind = 'up';
        this.lastMouseButton = null;
      } else if (isMotion) {
        kind = this.lastMouseButton ? 'drag' : 'move';
      } else {
        kind = 'down';
        this.lastMouseButton = mappedButton as MouseButton;
      }
    } else if (isMotion) {
      kind = this.lastMouseButton ? 'drag' : 'move';
      mappedButton = this.lastMouseButton;
    }

    const event: MouseEvent = {
      type: 'mouse',
      kind,
      button: mappedButton,
      x,
      y,
      modifiers,
      raw: this.getRawSequence(),
    };

    this.events.push(event);
  }

  /**
   * Emit key event
   */
  private emitKey(
    code: KeyCode,
    isCtrl: boolean,
    additionalMods: Partial<KeyModifiers> = {},
    kind?: KeyEventKind
  ): void {
    const modifiers: KeyModifiers = {
      ctrl: isCtrl || Boolean(additionalMods.ctrl),
      alt: Boolean(additionalMods.alt),
      shift: Boolean(additionalMods.shift),
      meta: Boolean(additionalMods.meta),
    };

    const event: KeyEvent = {
      type: 'key',
      code,
      modifiers,
      repeat: kind === 'repeat',
      raw: this.getRawSequence(),
    };

    // Add kind if provided (Kitty protocol)
    if (kind) {
      event.kind = kind;
    }

    this.events.push(event);
    this.reset();
  }

  /**
   * Get the raw sequence that generated the current event
   */
  private getRawSequence(): string {
    const decoder = new TextDecoder();
    return decoder.decode(this.buffer.subarray(0, this.bufferPos));
  }
}
