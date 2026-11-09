import { describe, expect, it } from 'vitest';
import { confirmLabelFor, dismissAnswer, type Request } from './dialogStore';

const req = (kind: Request['kind'], extra: Partial<Request> = {}) => ({ title: 't', kind, resolve: () => {}, ...extra }) as Request;

describe('dismissAnswer', () => {
  it('counts an alert as seen, a prompt as no text, and a confirm as "no"', () => {
    expect(dismissAnswer(req('alert'))).toBe(true);
    expect(dismissAnswer(req('prompt'))).toBeNull();
    expect(dismissAnswer(req('confirm'))).toBe(false);
  });
});

describe('confirmLabelFor', () => {
  it('uses the label the caller chose', () => {
    expect(confirmLabelFor(req('confirm', { confirmLabel: 'Discard changes' }), 'danger')).toBe('Discard changes');
  });
  it('says OK for an alert, Delete for a risky question, Confirm for any other', () => {
    expect(confirmLabelFor(req('alert'), 'default')).toBe('OK');
    expect(confirmLabelFor(req('confirm'), 'danger')).toBe('Delete');
    expect(confirmLabelFor(req('confirm'), 'default')).toBe('Confirm');
    expect(confirmLabelFor(req('prompt'), 'default')).toBe('Confirm');
  });
});
