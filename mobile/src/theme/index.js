export const colors = {
  primary: '#1B4D3E',
  primaryDark: '#12362B',
  primaryLight: '#E6F1ED',
  accent: '#F2A65A',
  accentDark: '#D98B3B',
  bg: '#F6F8F7',
  card: '#FFFFFF',
  border: '#E2E8E5',
  text: '#14201C',
  textMuted: '#5F6F69',
  textInverse: '#FFFFFF',
  success: '#2E9E5B',
  successBg: '#E5F6EC',
  warning: '#E1A100',
  warningBg: '#FDF3DC',
  danger: '#D64545',
  dangerBg: '#FCE9E9',
  info: '#2F6FED',
  infoBg: '#E7EEFE',
  grey: '#8A9791',
  greyBg: '#EEF1F0',
  overlay: 'rgba(9, 20, 16, 0.55)',
};

export const statusColors = {
  pending: { bg: colors.warningBg, fg: '#9A7100', label: 'Pending' },
  approved: { bg: colors.successBg, fg: colors.success, label: 'Approved' },
  rejected: { bg: colors.dangerBg, fg: colors.danger, label: 'Rejected' },
  checked_in: { bg: colors.infoBg, fg: colors.info, label: 'Inside' },
  checked_out: { bg: colors.greyBg, fg: colors.textMuted, label: 'Exited' },
  expired: { bg: colors.greyBg, fg: colors.textMuted, label: 'Expired' },
  submitted: { bg: colors.infoBg, fg: colors.info, label: 'Submitted' },
  in_progress: { bg: colors.warningBg, fg: '#9A7100', label: 'In Progress' },
  resolved: { bg: colors.successBg, fg: colors.success, label: 'Resolved' },
  confirmed: { bg: colors.successBg, fg: colors.success, label: 'Confirmed' },
  cancelled: { bg: colors.greyBg, fg: colors.textMuted, label: 'Cancelled' },
  sold: { bg: colors.greyBg, fg: colors.textMuted, label: 'Sold' },
  inactive: { bg: colors.greyBg, fg: colors.textMuted, label: 'Inactive' },
  registered: { bg: colors.successBg, fg: colors.success, label: 'Registered' },
  draft: { bg: colors.greyBg, fg: colors.textMuted, label: 'Draft' },
  published: { bg: colors.successBg, fg: colors.success, label: 'Published' },
  completed: { bg: colors.infoBg, fg: colors.info, label: 'Completed' },
  walkin: { bg: colors.infoBg, fg: colors.info, label: 'Walk-in' },
  delivery: { bg: colors.warningBg, fg: '#9A7100', label: 'Delivery' },
  preapproved: { bg: colors.primaryLight, fg: colors.primary, label: 'Pre-approved' },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const typography = {
  h1: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  h3: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  small: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  tiny: { fontSize: 11, color: colors.textMuted, letterSpacing: 0.3 },
  button: { fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
};

export const shadow = {
  card: {
    shadowColor: '#0B1F19',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  float: {
    shadowColor: '#0B1F19',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};

export default { colors, spacing, radius, typography, shadow, statusColors };
