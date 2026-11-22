import { describe, expect, it } from 'vitest';
import { MAX_ENTRIES, MAX_VALUE, writeKvSchema } from './schemas';

describe('settings-style data schema', () => {
  it('accepts shared and personal entries, and null to remove one', () => {
    expect(writeKvSchema.safeParse({ shared: { lira_projects: '[]', lira_roadmaps: null }, mine: { lira_theme: 'dark' } }).success).toBe(true);
    expect(writeKvSchema.safeParse({ mine: { 'lira_scope_team:LIRA': '{}' } }).success).toBe(true);
  });

  it('refuses keys the app does not use, internal keys, and AI keys, which are never stored here', () => {
    for (const k of ['theme', 'lira_', 'lira__kv_dirty', 'lira_gemini_api_key', 'lira_ai_API_KEY', 'lira_a b', 'lira_x/../y', `lira_${'a'.repeat(121)}`]) {
      expect(writeKvSchema.safeParse({ mine: { [k]: 'x' } }).success, k).toBe(false);
    }
  });

  it('refuses a value that is too large, a value that is not text, too many entries, nothing at all, and unknown fields', () => {
    expect(writeKvSchema.safeParse({ mine: { lira_a: 'x'.repeat(MAX_VALUE + 1) } }).success).toBe(false);
    expect(writeKvSchema.safeParse({ mine: { lira_a: 5 } }).success).toBe(false);
    expect(writeKvSchema.safeParse({ mine: Object.fromEntries(Array.from({ length: MAX_ENTRIES + 1 }, (_, i) => [`lira_k${i}`, 'x'])) }).success).toBe(false);
    expect(writeKvSchema.safeParse({}).success).toBe(false);
    expect(writeKvSchema.safeParse({ mine: { lira_a: 'x' }, org: 'other' }).success).toBe(false);
  });
});
