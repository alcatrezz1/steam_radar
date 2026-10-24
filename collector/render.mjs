// Rebuilds the site JSON from saved state without touching the network.
// Used when code changes are pushed, so new scoring shows up without waiting for the next collect.
import { readFile } from 'node:fs/promises';
import { writeOutputs } from './output.mjs';

const STATE_FILE = process.env.STATE_FILE || '../data/state.json';
const OUT_DIR = process.env.OUT_DIR || '../data/site';

const state = JSON.parse(await readFile(STATE_FILE, 'utf8'));
const counts = await writeOutputs(state, OUT_DIR, state.updatedAt || Date.now());
console.log('Rendered from state:', JSON.stringify(counts));
