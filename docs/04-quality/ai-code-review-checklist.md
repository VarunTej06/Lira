# Review checklist for AI-assisted code

Use on every pull request, whether a person or an assistant wrote it. The usual weaknesses of AI-generated code ("slop") are listed so reviewers know where to look.

## 1. Is it the right size?
- [ ] Could this be shorter? Delete wrappers that only forward, options nobody asked for, and defensive checks for impossible cases.
- [ ] Is there a new helper that duplicates an existing one? (Search `src/utils/`, `src/hooks/`, `src/components/common/` first.)
- [ ] Are there comments that restate the code? Remove them. Keep comments that explain **why**.
- [ ] Does one function do more than one thing? Split by responsibility, not by line count.

## 2. Is it correct, not just plausible?
- [ ] Run it. Does the behaviour match the request in the browser (UI) or via a test (logic)?
- [ ] Are invented APIs, options, or package names checked against the real documentation?
- [ ] Are errors handled meaningfully? No empty `catch`, no swallowed failures, no fake fallbacks that hide a bug.
- [ ] Edge cases: empty list, one item, very large list, missing optional fields, time zones, concurrent edit.
- [ ] React: no `setState` directly in an effect, no reading refs or `Date` during render, dependency arrays correct (not silenced).

## 3. Is it safe?
- [ ] Which rules in `secure-coding-standard.md` apply? Named in the PR.
- [ ] Is every id from the client authorised against the caller (object-level)? Is the tenant filter present?
- [ ] Any new `dangerouslySetInnerHTML`, `innerHTML`, `eval`, string-built SQL/paths/URLs?
- [ ] Any new outbound request to a user-controlled address? Any new secret or token handling?
- [ ] New dependency? SOP-04 gate answered in the description.

## 4. Does it fit the design system and architecture?
- [ ] Colours, sizes, radius, shadow from tokens. No new purple/gradient/emoji decoration without a design reason.
- [ ] Logic in hooks or pure functions with tests; component renders.
- [ ] Browser settings go through `appStorage`, never `localStorage` directly; the time through `currentTime()`; resets through `useResetWhen`; colours through `PALETTE`; text sizes through the type-scale classes.
- [ ] Reads/writes go through the data layer (`DataStore`) once it exists.
- [ ] No new circular imports.

## 5. Is it proven?
- [ ] Test fails without the change and passes with it; negative tests for security paths.
- [ ] Tests assert behaviour, not implementation details or snapshots of everything.
- [ ] Docs updated if a documented fact changed.

## Red flags
Huge diff for a small request · new abstraction with one user · "TODO" or placeholder logic · tests rewritten to match new output · lint rules disabled · many similar files added · confident explanation with no run output.

## Approve / request changes
Approve only if you could explain every changed line to a colleague.
