import { z } from 'zod';

export const MAX_BYTES = 25 * 1024 * 1024;

/**
 * The kinds of file that may be stored: pictures, PDF, plain data and common office files. A kind that a browser could run
 * as a page (HTML, SVG, scripts) is not on the list, so it can never be uploaded in the first place.
 */
export const ALLOWED_TYPES: readonly string[] = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'text/csv', 'application/json', 'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

/** Types a browser shows as a picture; only these are sent back with their own type, everything else as a plain download. */
export const IMAGE_TYPES: readonly string[] = ALLOWED_TYPES.filter(t => t.startsWith('image/'));

// No path characters, no control characters: the name is shown and downloaded, never used as a path (the stored path is made by the server).
const FILE_NAME = /^[^\\/\u0000-\u001f\u007f]{1,255}$/;

export const requestUploadSchema = z.strictObject({
  name: z.string().trim().regex(FILE_NAME, 'Use a file name of up to 255 characters, without slashes.'),
  size: z.number().int().min(1, 'The file is empty.').max(MAX_BYTES, 'The file is larger than 25 MB.'),
  type: z.string().refine(t => ALLOWED_TYPES.includes(t), 'This kind of file is not allowed.'),
});

export type RequestUpload = z.infer<typeof requestUploadSchema>;
