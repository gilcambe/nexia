/**
 * Fixture file that intentionally fails to load because it requires a
 * non‑existent module. Used to test the validate‑require CLI.
 */
require('nonexistent-module');
module.exports = {};
