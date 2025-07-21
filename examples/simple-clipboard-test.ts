#!/usr/bin/env bun

/**
 * Simple test to verify OSC 52 clipboard functionality
 */

import { clipboard } from '../src/index.ts';

// Test texts
const testTexts = [
  'Hello, World!',
  'Line 1\nLine 2\nLine 3',
  'Special: 🎉 © ™ • →',
  'Tabs:\tColumn1\tColumn2',
];

// Copy each test text
testTexts.forEach((text, _index) => {
  clipboard.copyToClipboard(text);
});
