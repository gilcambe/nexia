#!/usr/bin/env node
/**
 * validate-require.js
 *
 * CLI tool to validate that given JavaScript files can be required without
 * throwing module‑not‑found or reference errors. Intended to be used by the
 * Cortex executor before opening a PR.
 *
 * Usage:
 *   node scripts/validate-require.js <file1.js> <file2.js> ...
 *
 * If any file fails to load, the script prints the error messages and exits
 * with code 1. Otherwise it exits with code 0.
 */

const path = require('path');
const fs = require('fs');

function validateFile(file) {
  const absolute = path.resolve(process.cwd(), file);
  if (!fs.existsSync(absolute)) {
    return `File not found: ${file}`;
  }
  try {
    // Clear Node's module cache for the file to ensure a fresh load
    delete require.cache[require.resolve(absolute)];
    require(absolute);
    return null; // no error
  } catch (err) {
    // Return a concise error message
    return `Error requiring "${file}": ${err.message}`;
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: validate-require.js <file1.js> [<file2.js> ...]');
    process.exit(1);
  }

  const errors = args.map(validateFile).filter(Boolean);
  if (errors.length > 0) {
    errors.forEach((msg) => console.error(msg));
    process.exit(1);
  } else {
    console.log('All files required successfully.');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}
