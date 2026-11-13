/** A short key from a project name: one word gives its first 4 letters, several give each word's first letter (up to 5). */
export function suggestProjectKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const key = words.length === 1 ? words[0].slice(0, 4).toUpperCase() : words.map(w => w[0].toUpperCase()).join('').slice(0, 5);
  return key.replace(/[^A-Z0-9]/g, '');
}

/** What a person may type into the key box: capital letters and digits, at most 6. */
export function cleanProjectKey(typed: string): string {
  return typed.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}
