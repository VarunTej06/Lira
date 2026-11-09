const DEFAULT_DOC_TEMPLATE = `# Space Documentation & Notes

Welcome to the project documentation space for **[SPACE_NAME]**.
Keep your architecture decisions, sprint notes, and links here.

## Quick Links & Resources
- **Repository**: [GitHub](https://github.com)
- **Design Specs**: Figma workspace
- **Staging URL**: https://staging.example.com

## Sprint Objectives
- [x] Complete MVP core features
- [ ] Implement space documentation modal
- [ ] Connect drag-and-drop calendar triage

## Architecture Decisions
1. **Local-first Dexie DB**: IndexedDB storage ensures 100% offline access.
2. **Tailwind CSS**: Strict adherence to the Lira design tokens.
`;

/** The starting notes, with the space name filled in ("Workspace" without a space). */
export const templateFor = (spaceName: string | undefined): string => DEFAULT_DOC_TEMPLATE.replace(/\[SPACE_NAME\]/g, spaceName || 'Workspace');

/** The number of words in the text; 0 when it is blank. */
export const wordCount = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** Wraps the selection (or the word "text" when nothing is selected) in the marks, and says where the cursor selection goes afterwards. */
export function wrapSelection(value: string, start: number, end: number, before: string, after: string) {
  const selected = value.slice(start, end);
  return {
    text: value.slice(0, start) + before + (selected || 'text') + after + value.slice(end),
    selectStart: start + before.length,
    selectEnd: start + before.length + (selected.length || 4),
  };
}
