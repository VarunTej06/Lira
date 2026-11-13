import { STATUS_META } from '../../utils/status';
import { PALETTE } from '../../theme/palette';

export const statusMeta = (s: string) =>
  (STATUS_META as Record<string, { label: string; color: string; bg: string }>)[s?.toLowerCase()] || { label: s, color: PALETTE.textMuted, bg: PALETTE.surfaceMuted };
