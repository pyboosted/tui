#!/usr/bin/env bun
import { DiffEngine } from '../src/index.ts';
import type { Attributes } from '../src/types.ts';

// Benchmark configuration
const ROWS = 50;
const COLS = 100;
const ITERATIONS = 1000;
const COLOR_CHANGES_PER_FRAME = 500;

// Generate random color
function randomColor(): `#${string}` {
  const hex = Math.floor(Math.random() * 0xff_ff_ff)
    .toString(16)
    .padStart(6, '0');
  return `#${hex}`;
}

// Generate random palette color
function randomPaletteColor(): number {
  return Math.floor(Math.random() * 256);
}

// Benchmark diff engine
function benchmarkDiffEngine(): { time: number; outputSize: number } {
  const engine = new DiffEngine(ROWS, COLS);
  const start = performance.now();
  let totalOutputSize = 0;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    // Clear and add random colored cells
    engine.clear();

    for (let i = 0; i < COLOR_CHANGES_PER_FRAME; i++) {
      const row = Math.floor(Math.random() * ROWS);
      const col = Math.floor(Math.random() * COLS);
      const attrs: Attributes = {
        fg: Math.random() > 0.5 ? randomColor() : randomPaletteColor(),
        bg: Math.random() > 0.7 ? randomColor() : undefined,
        bold: Math.random() > 0.8,
      };

      engine.setCellWithAttrs(row, col, '█', attrs);
    }

    // Compute diff (this is what we're measuring)
    const output = engine.computeDiff();
    totalOutputSize += output.length;
  }

  return {
    time: performance.now() - start,
    outputSize: totalOutputSize / ITERATIONS,
  };
}

// Alternative benchmark implementation
function _benchmarkAlternative(): { time: number; outputSize: number } {
  const engine = new DiffEngine(ROWS, COLS);
  const start = performance.now();
  let totalOutputSize = 0;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    // Clear and add random colored cells
    engine.clear();

    for (let i = 0; i < COLOR_CHANGES_PER_FRAME; i++) {
      const row = Math.floor(Math.random() * ROWS);
      const col = Math.floor(Math.random() * COLS);
      const attrs: Attributes = {
        fg: Math.random() > 0.5 ? randomColor() : randomPaletteColor(),
        bg: Math.random() > 0.7 ? randomColor() : undefined,
        bold: Math.random() > 0.8,
      };

      engine.setCellWithAttrs(row, col, '█', attrs);
    }

    // Compute diff (this is what we're measuring)
    const output = engine.computeDiff();
    totalOutputSize += output.length;
  }

  return {
    time: performance.now() - start,
    outputSize: totalOutputSize / ITERATIONS,
  };
}

// Memory usage helper
function getMemoryUsage(): number {
  if (global.gc) {
    global.gc();
  }
  return process.memoryUsage().heapUsed / 1024 / 1024; // MB
}
benchmarkDiffEngine();

// Benchmark implementation
const memBefore = getMemoryUsage();
const _result = benchmarkDiffEngine();
const memAfter = getMemoryUsage();
const _memUsed = memAfter - memBefore;
const _scenario1 = benchmarkDiffEngine();

process.exit(0);
