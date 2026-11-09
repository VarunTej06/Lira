import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { seedDatabase } from './seedData';

describe('Sample data for a new workspace', () => {
  beforeEach(async () => { await db.issues.clear(); await db.spaces.clear(); });

  it('creates the six sample spaces, each with its own tickets', async () => {
    await seedDatabase();
    const spaces = await db.spaces.toArray();
    expect(spaces.map(s => s.key).sort()).toEqual(['ATMOS', 'CERT', 'CRE', 'CRS', 'GEN', 'LIRA']);
    for (const key of ['CERT', 'CRS', 'ATMOS', 'GEN', 'LIRA']) {
      const space = spaces.find(s => s.key === key)!;
      const tickets = await db.issues.where('spaceId').equals(space.id!).toArray();
      expect(tickets.length, key).toBeGreaterThan(0);
      expect(tickets.every(t => t.key.startsWith(`${key}-`)), key).toBe(true);
    }
  });

  it('gives every ticket a unique key', async () => {
    await seedDatabase();
    const keys = (await db.issues.toArray()).map(i => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('does nothing twice: a seeded workspace is left as it is', async () => {
    await seedDatabase();
    const before = await db.issues.count();
    await seedDatabase();
    expect(await db.issues.count()).toBe(before);
  });
});
