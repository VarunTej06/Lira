/**
 * The current time, behind one door. Screens call these instead of `new Date()` / `Date.now()` directly, so a render does
 * not hide a clock read and tests can fake the time in one place (`vi.useFakeTimers()` or `vi.spyOn`).
 */
export const currentTime = (): Date => new Date();
export const currentTimeMs = (): number => Date.now();
