import { expect, test } from 'bun:test';
import {
  clearCapabilitiesCache,
  detectCapabilities,
  isFeatureSupported,
} from '../src/input/detection.ts';
import {
  InputFeature,
  SupportLevel,
  TerminalType,
} from '../src/input/features.ts';
import type { Terminal } from '../src/terminal.ts';

test('detectCapabilities detects terminal type from environment', async () => {
  // Clear cache before test
  clearCapabilitiesCache();

  // Mock terminal
  const term = {
    write: () => {
      // Mock terminal write
    },
    flush: () => {
      // Mock terminal flush
    },
  } as unknown as Terminal;

  // Test with mocked environment
  const originalTerm = process.env.TERM;
  const originalTermProgram = process.env.TERM_PROGRAM;

  try {
    // Test Kitty detection
    process.env.TERM_PROGRAM = 'kitty';
    clearCapabilitiesCache();
    const kittyCapabilities = await detectCapabilities(term, {
      performQueries: false,
    });
    expect(kittyCapabilities.terminalType).toBe(TerminalType.Kitty);
    expect(kittyCapabilities.features[InputFeature.KittyKeyboard]).toBe(
      SupportLevel.Full
    );

    // Test iTerm detection
    process.env.TERM_PROGRAM = 'iTerm.app';
    clearCapabilitiesCache();
    const itermCapabilities = await detectCapabilities(term, {
      performQueries: false,
    });
    expect(itermCapabilities.terminalType).toBe(TerminalType.ITerm);
    expect(itermCapabilities.features[InputFeature.KittyKeyboard]).toBe(
      SupportLevel.None
    );
    expect(itermCapabilities.features[InputFeature.BracketedPaste]).toBe(
      SupportLevel.Full
    );

    // Test unknown terminal
    process.env.TERM_PROGRAM = '';
    process.env.TERM = '';
    clearCapabilitiesCache();
    const unknownCapabilities = await detectCapabilities(term, {
      performQueries: false,
    });
    expect(unknownCapabilities.terminalType).toBe(TerminalType.Unknown);
  } finally {
    // Restore environment
    process.env.TERM = originalTerm || '';
    process.env.TERM_PROGRAM = originalTermProgram || '';
  }
});

test('isFeatureSupported checks support levels correctly', () => {
  const capabilities = {
    terminalType: TerminalType.Kitty,
    features: {
      [InputFeature.MouseTracking]: SupportLevel.Full,
      [InputFeature.KittyKeyboard]: SupportLevel.Full,
      [InputFeature.BracketedPaste]: SupportLevel.Partial,
      [InputFeature.FocusEvents]: SupportLevel.None,
      [InputFeature.Clipboard]: SupportLevel.Full,
    },
    isSSH: false,
    isTmux: false,
  };

  // Test full support
  expect(
    isFeatureSupported(
      capabilities,
      InputFeature.MouseTracking,
      SupportLevel.Full
    )
  ).toBe(true);
  expect(
    isFeatureSupported(
      capabilities,
      InputFeature.MouseTracking,
      SupportLevel.Partial
    )
  ).toBe(true);
  expect(
    isFeatureSupported(
      capabilities,
      InputFeature.MouseTracking,
      SupportLevel.None
    )
  ).toBe(true);

  // Test partial support
  expect(
    isFeatureSupported(
      capabilities,
      InputFeature.BracketedPaste,
      SupportLevel.Full
    )
  ).toBe(false);
  expect(
    isFeatureSupported(
      capabilities,
      InputFeature.BracketedPaste,
      SupportLevel.Partial
    )
  ).toBe(true);
  expect(
    isFeatureSupported(
      capabilities,
      InputFeature.BracketedPaste,
      SupportLevel.None
    )
  ).toBe(true);

  // Test no support
  expect(
    isFeatureSupported(
      capabilities,
      InputFeature.FocusEvents,
      SupportLevel.Full
    )
  ).toBe(false);
  expect(
    isFeatureSupported(
      capabilities,
      InputFeature.FocusEvents,
      SupportLevel.Partial
    )
  ).toBe(false);
  expect(
    isFeatureSupported(
      capabilities,
      InputFeature.FocusEvents,
      SupportLevel.None
    )
  ).toBe(true);
});

test('SSH and tmux detection affects feature support', async () => {
  const term = {
    write: () => {
      // Mock terminal write
    },
    flush: () => {
      // Mock terminal flush
    },
  } as unknown as Terminal;

  const originalSSH = process.env.SSH_CONNECTION;
  const originalTmux = process.env.TMUX;
  const originalTermProgram = process.env.TERM_PROGRAM;

  try {
    // Test SSH limitations on Kitty
    process.env.TERM_PROGRAM = 'kitty';
    process.env.SSH_CONNECTION = '192.168.1.1 22 192.168.1.2 22';
    clearCapabilitiesCache();
    const sshCapabilities = await detectCapabilities(term, {
      performQueries: false,
    });
    expect(sshCapabilities.isSSH).toBe(true);
    expect(sshCapabilities.features[InputFeature.Clipboard]).not.toBe(
      SupportLevel.Full
    );

    // Test tmux limitations
    process.env.SSH_CONNECTION = '';
    process.env.TMUX = '/tmp/tmux-1000/default,12345,0';
    clearCapabilitiesCache();
    const tmuxCapabilities = await detectCapabilities(term, {
      performQueries: false,
    });
    expect(tmuxCapabilities.isTmux).toBe(true);
    expect(tmuxCapabilities.features[InputFeature.KittyKeyboard]).toBe(
      SupportLevel.None
    );
  } finally {
    process.env.SSH_CONNECTION = originalSSH || '';
    process.env.TMUX = originalTmux || '';
    process.env.TERM_PROGRAM = originalTermProgram || '';
  }
});

test('capabilities are cached', async () => {
  clearCapabilitiesCache();

  const term = {
    write: () => {
      // Mock terminal write
    },
    flush: () => {
      // Mock terminal flush
    },
  } as unknown as Terminal;

  // First call
  const capabilities1 = await detectCapabilities(term, {
    performQueries: false,
  });

  // Second call should return same instance (cached)
  const capabilities2 = await detectCapabilities(term, {
    performQueries: false,
  });
  expect(capabilities1).toBe(capabilities2);

  // Force refresh should return new instance
  const capabilities3 = await detectCapabilities(term, {
    force: true,
    performQueries: false,
  });
  expect(capabilities3).not.toBe(capabilities2);
});
