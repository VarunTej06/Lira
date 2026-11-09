import type { Space } from '../types/space';

/**
 * The space a new ticket goes into: the one the caller asked for, else the space of the project on screen, else the space on screen.
 * A named space that no longer exists falls back to the space on screen.
 */
export function spaceForCreate(spaces: Space[], activeSpace: Space | undefined, requestedId?: number, projectSpaceId?: number): Space | undefined {
  const id = requestedId || projectSpaceId;
  return id ? (spaces.find(s => s.id === id) || activeSpace) : activeSpace;
}
