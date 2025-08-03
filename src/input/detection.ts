/**
 * Terminal capability detection
 *
 * This module provides functions to detect terminal capabilities
 * through environment variables, terminfo, and test sequences.
 */

import type { Terminal } from '../terminal.ts';
import {
  FEATURE_QUERIES,
  FEATURE_RESPONSES,
  InputFeature,
  SupportLevel,
  TERMINAL_FEATURE_SUPPORT,
  TerminalType,
} from './features.ts';

/**
 * Detected terminal capabilities
 */
export interface DetectedCapabilities {
  /** The detected terminal type */
  terminalType: TerminalType;
  /** Support level for each feature */
  features: Record<InputFeature, SupportLevel>;
  /** Terminal version if detected */
  version?: string;
  /** Whether we're in an SSH session */
  isSSH: boolean;
  /** Whether we're in tmux */
  isTmux: boolean;
}

/**
 * Cache for detected capabilities
 */
let cachedCapabilities: DetectedCapabilities | null = null;

/**
 * Detect the terminal type from environment variables
 */
function detectTerminalType(): {
  type: TerminalType;
  version?: string;
  isSSH: boolean;
  isTmux: boolean;
} {
  const term = process.env.TERM || '';
  const termProgram = process.env.TERM_PROGRAM || '';
  const termProgramVersion = process.env.TERM_PROGRAM_VERSION || '';
  const sshConnection = process.env.SSH_CONNECTION || '';
  const tmux = process.env.TMUX || '';

  const isSSH = sshConnection.length > 0;
  const isTmux = tmux.length > 0;

  // Check for specific terminal programs (TERM_PROGRAM takes precedence)
  if (termProgram.toLowerCase() === 'kitty') {
    return {
      type: TerminalType.Kitty,
      version: termProgramVersion,
      isSSH,
      isTmux,
    };
  }

  if (termProgram.toLowerCase() === 'ghostty') {
    return {
      type: TerminalType.Ghostty,
      version: termProgramVersion,
      isSSH,
      isTmux,
    };
  }

  if (termProgram.toLowerCase() === 'iterm.app') {
    return {
      type: TerminalType.ITerm,
      version: termProgramVersion,
      isSSH,
      isTmux,
    };
  }

  // Check for Zed's built-in terminal
  if (termProgram.toLowerCase().includes('zed') || term.includes('alacritty')) {
    // Zed uses Alacritty under the hood
    return {
      type: TerminalType.ITerm, // Use iTerm profile for basic support
      version: termProgramVersion,
      isSSH,
      isTmux,
    };
  }

  // Fall back to TERM variable if TERM_PROGRAM is not set
  if (!termProgram) {
    if (term.includes('kitty')) {
      return {
        type: TerminalType.Kitty,
        version: termProgramVersion,
        isSSH,
        isTmux,
      };
    }
    if (term.includes('ghostty')) {
      return {
        type: TerminalType.Ghostty,
        version: termProgramVersion,
        isSSH,
        isTmux,
      };
    }
  }

  // If we're in tmux, report it as the primary type
  if (isTmux) {
    return { type: TerminalType.Tmux, isSSH, isTmux };
  }

  // If we're in SSH without a recognized terminal, report SSH
  if (isSSH) {
    return { type: TerminalType.SSH, isSSH, isTmux };
  }

  return { type: TerminalType.Unknown, isSSH, isTmux };
}

/**
 * Query a specific feature by sending a test sequence
 */
async function queryFeature(
  term: Terminal,
  feature: InputFeature,
  timeout = 200
): Promise<boolean> {
  const query = FEATURE_QUERIES[feature];
  const responsePattern = FEATURE_RESPONSES[feature];

  if (!(query && responsePattern)) {
    return false;
  }

  // We need raw mode to read terminal responses
  // Save current terminal state and enable raw mode temporarily
  let wasRaw = false;
  try {
    // Check if we can enable raw mode
    const proc = Bun.spawn(['stty', '-g'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const _savedState = await new Response(proc.stdout).text();

    // Enable raw mode
    const enableProc = Bun.spawn(['stty', 'raw', '-echo'], {
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    });
    await enableProc.exited;
    wasRaw = enableProc.exitCode === 0;

    if (!wasRaw) {
      // Can't enable raw mode, skip query
      return false;
    }

    return await new Promise((resolve) => {
      let responseBuffer = '';
      let timeoutId: Timer | null = null;
      let cancelled = false;

      // Set up timeout
      timeoutId = setTimeout(() => {
        cancelled = true;
        cleanup();
        resolve(false);
      }, timeout);

      // Read raw stdin to capture response
      const stream = Bun.stdin.stream();
      const reader = stream.getReader();

      async function readResponse() {
        try {
          // Use Promise.race to implement timeout on the read operation
          const readPromise = reader.read();
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              if (!cancelled) {
                reject(new Error('Read timeout'));
              }
            }, 50); // Check every 50ms
          });

          const result = await Promise.race([
            readPromise,
            timeoutPromise,
          ]).catch(() => null);

          if (cancelled) {
            return;
          }

          if (result?.value) {
            const text = new TextDecoder().decode(result.value);
            responseBuffer += text;

            // Check if we have a matching response
            if (responsePattern?.test(responseBuffer)) {
              cleanup();
              resolve(true);
            } else {
              // Continue reading
              readResponse();
            }
          } else {
            // No data available, try again
            setTimeout(() => {
              if (!cancelled) {
                readResponse();
              }
            }, 10);
          }
        } catch (_error) {
          if (!cancelled) {
            cleanup();
            resolve(false);
          }
        }
      }

      function cleanup() {
        cancelled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        try {
          reader.releaseLock();
        } catch {
          // Reader might already be released
        }
      }

      // Send query sequence
      term.write(query);
      term.flush();

      // Start reading response
      readResponse();
    });
  } finally {
    // Restore terminal state
    if (wasRaw) {
      try {
        const restoreProc = Bun.spawn(
          ['stty', 'sane', 'echo', 'icanon', 'iexten'],
          {
            stdin: 'inherit',
            stdout: 'inherit',
            stderr: 'inherit',
          }
        );
        await restoreProc.exited;
      } catch (_error) {
        // Best effort
      }
    }
  }
}

/**
 * Get base feature support from terminal type
 */
function getBaseFeatureSupport(
  terminalType: TerminalType,
  isSSH: boolean,
  isTmux: boolean
): Record<InputFeature, SupportLevel> {
  const support = { ...TERMINAL_FEATURE_SUPPORT[terminalType] };

  // Apply SSH limitations
  if (isSSH && terminalType !== TerminalType.SSH) {
    // Downgrade certain features when accessed over SSH
    if (support[InputFeature.Clipboard] === SupportLevel.Full) {
      support[InputFeature.Clipboard] = SupportLevel.Partial;
    }
    if (support[InputFeature.FocusEvents] === SupportLevel.Full) {
      support[InputFeature.FocusEvents] = SupportLevel.None;
    }
  }

  // Apply tmux limitations
  if (isTmux && terminalType !== TerminalType.Tmux) {
    // Tmux may not pass through all features
    if (support[InputFeature.KittyKeyboard] === SupportLevel.Full) {
      support[InputFeature.KittyKeyboard] = SupportLevel.None;
    }
    if (support[InputFeature.FocusEvents] === SupportLevel.Full) {
      support[InputFeature.FocusEvents] = SupportLevel.None;
    }
  }

  return support;
}

/**
 * Detect terminal capabilities
 *
 * This function detects terminal capabilities through:
 * 1. Environment variable inspection
 * 2. Terminal type detection
 * 3. Feature-specific queries (if needed)
 *
 * Results are cached for subsequent calls.
 */
export async function detectCapabilities(
  term: Terminal,
  options?: {
    /** Force re-detection even if cached */
    force?: boolean;
    /** Timeout for feature queries in ms */
    queryTimeout?: number;
    /** Whether to perform active queries */
    performQueries?: boolean;
  }
): Promise<DetectedCapabilities> {
  const {
    force = false,
    queryTimeout = 200,
    performQueries = true,
  } = options || {};

  // Return cached result if available and not forced
  if (cachedCapabilities && !force) {
    return cachedCapabilities;
  }

  // Detect terminal type
  const { type, version, isSSH, isTmux } = detectTerminalType();

  // Get base feature support from terminal type
  const features = getBaseFeatureSupport(type, isSSH, isTmux);

  // Perform active queries for uncertain features if enabled
  if (performQueries && type === TerminalType.Unknown) {
    // Try to detect Kitty keyboard protocol support
    const hasKittyKeyboard = await queryFeature(
      term,
      InputFeature.KittyKeyboard,
      queryTimeout
    );
    if (hasKittyKeyboard) {
      features[InputFeature.KittyKeyboard] = SupportLevel.Full;
    }
  }

  const capabilities: DetectedCapabilities = {
    terminalType: type,
    features,
    version,
    isSSH,
    isTmux,
  };

  // Cache the result
  cachedCapabilities = capabilities;

  return capabilities;
}

/**
 * Clear the cached capabilities
 */
export function clearCapabilitiesCache(): void {
  cachedCapabilities = null;
}

/**
 * Check if a specific feature is supported
 */
export function isFeatureSupported(
  capabilities: DetectedCapabilities,
  feature: InputFeature,
  minLevel: SupportLevel = SupportLevel.Partial
): boolean {
  const level = capabilities.features[feature];

  if (minLevel === SupportLevel.None) {
    return true; // Any level is acceptable
  }

  if (minLevel === SupportLevel.Partial) {
    return level === SupportLevel.Partial || level === SupportLevel.Full;
  }

  return level === SupportLevel.Full;
}
