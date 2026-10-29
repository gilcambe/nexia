import { D1Database } from '@cloudflare/workers-types';

let d1: D1Database;

export function initD1(db: D1Database) {
  d1 = db;
}

export { d1 };
