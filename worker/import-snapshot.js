import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { premiumCodeHash } from './premium.js';

// Import into a fresh, migrated SQLite database. Keep both inputs and the database private.
export async function importSnapshot(db, snapshot, key) {
  if (typeof key !== 'string' || key.length < 32) throw new Error('PREMIUM_CODE_KEY is required');
  const { users, campaigns, codes, activations, entitlements } = snapshot;
  const groups = [users, campaigns, codes, activations, entitlements];
  if (!groups.every(Array.isArray)) throw new Error('Snapshot is missing a collection');

  const mask = code => '••••' + code.slice(-2);
  const codeRows = await Promise.all(codes.map(async row => {
    const code = typeof row.code === 'string' ? row.code.trim().toUpperCase() : '';
    if (!/^[A-Z0-9]{6}$/.test(code) || !['available', 'disabled', 'claimed'].includes(row.status)) {
      throw new Error('Invalid Premium code record');
    }
    return [row.id, row.campaign_id, await premiumCodeHash(code, key), mask(code),
      Number(row.lifetime === true), Number(row.status !== 'available')];
  }));
  const codesById = new Map(codeRows.map(row => [row[0], row]));
  const date = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        new Date(value + 'T00:00:00Z').toJSON()?.slice(0, 10) !== value) throw new Error('Invalid Premium date');
    return value;
  };
  const activationRows = activations.map(row => {
    const code = codesById.get(row.code_id);
    const created = Date.parse(row.created_date);
    if (!code || code[1] !== row.campaign_id || !Number.isFinite(created)) throw new Error('Invalid activation reference');
    const expires = date(row.expires_on);
    return [row.code_id, row.user_id, row.campaign_id, code[3], row.months, Number(row.lifetime === true),
      Number(row.first_in_campaign === true), date(row.granted_from ?? row.created_date.slice(0, 10)), expires, created];
  });
  const snapshots = [
    ['users', users.map(row => [row.id, row.email.trim().toLowerCase(), row.role, row.skin ?? null])],
    ['premium_campaigns', campaigns.map(row => [row.id, row.slug, row.name, row.first_months ?? 3,
      row.additional_months ?? 1, JSON.stringify({
        country: row.country, product: row.product, store_scope: row.store_scope,
        pilot_quota: row.pilot_quota, price_lei: row.price_lei, active: row.active, demo: row.demo, terms: row.terms,
      })])],
    ['premium_codes', codeRows],
    ['premium_activations', activationRows],
    ['premium_entitlements', entitlements.map(row => [row.user_id, row.campaign_id, date(row.expires_on),
      Number(row.lifetime === true), row.activation_count ?? 0, row.last_code_masked ?? null])],
  ];

  db.exec('PRAGMA foreign_keys = ON; BEGIN IMMEDIATE');
  try {
    for (const [table] of snapshots) {
      if (db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get()) throw new Error('Target database is not empty');
    }
    for (const [table, rows] of snapshots) {
      if (!rows.length) continue;
      // Activations create provisional entitlements. The original entitlement is authoritative.
      const verb = table === 'premium_entitlements' ? 'INSERT OR REPLACE' : 'INSERT';
      const placeholders = rows[0].map(() => '?').join(', ');
      const insert = db.prepare(`${verb} INTO ${table} VALUES (${placeholders})`);
      for (const row of rows) insert.run(...row);
    }
    for (const [table, rows] of snapshots) {
      if (db.prepare(`SELECT count(*) AS total FROM ${table}`).get().total !== rows.length) {
        throw new Error('Snapshot counts do not match');
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return Object.fromEntries(snapshots.map(([table, rows]) => [table, rows.length]));
}

if (import.meta.main) {
  let db;
  try {
    const [, , snapshotPath, databasePath] = process.argv;
    db = new DatabaseSync(databasePath);
    const counts = await importSnapshot(db, JSON.parse(readFileSync(snapshotPath, 'utf8')), process.env.PREMIUM_CODE_KEY);
    console.log(JSON.stringify(counts));
  } catch {
    console.error('Import failed. Check the private snapshot, schema, empty target, and Premium key.');
    process.exitCode = 1;
  } finally {
    db?.close();
  }
}
