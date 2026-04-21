import { Platform, StyleSheet } from 'react-native';

const FONT_SANS = Platform.select({
  ios: 'Avenir Next',
  android: 'sans-serif',
  default: 'System',
});

const FONT_MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const ADMIN_COLORS = {
  bg: '#09090b',
  panel: '#09090b',
  card: '#121214',
  surface: '#121214',
  border: '#27272a',
  borderSoft: '#27272a',
  text: '#fafafa',
  textMuted: '#a1a1aa',
  textSubtle: '#a1a1aa',
  accent: '#DC2626',
  accentSoft: 'rgba(220, 38, 38, 0.12)',
  success: '#14B87A',
  warning: '#F2A900',
  danger: '#FF3B30',
  info: '#4C8DFF',
  white: '#FFFFFF',
  black: '#000000',
};

export const ADMIN_SPACING = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
};

export const ADMIN_RADIUS = {
  xs: 12,
  sm: 12,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
};

export const ADMIN_TYPOGRAPHY = {
  title: {
    fontFamily: 'SpaceGroteskBold',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: ADMIN_COLORS.text,
  },
  subtitle: {
    fontFamily: 'SpaceGroteskSemiBold',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: ADMIN_COLORS.textSubtle,
  },
  h2: {
    fontFamily: 'SpaceGroteskBold',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: ADMIN_COLORS.text,
  },
  body: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 14,
    fontWeight: '500',
    color: ADMIN_COLORS.text,
  },
  bodyMuted: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 13,
    fontWeight: '500',
    color: ADMIN_COLORS.textMuted,
  },
  caption: {
    fontFamily: 'SpaceGroteskSemiBold',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: ADMIN_COLORS.textSubtle,
  },
  mono: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    color: ADMIN_COLORS.textSubtle,
  },
};

export const ADMIN_SHADOWS = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  soft: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
});

export const ADMIN_SURFACES = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: ADMIN_COLORS.bg,
  },
  card: {
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: ADMIN_RADIUS.lg,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  panel: {
    backgroundColor: ADMIN_COLORS.panel,
    borderRadius: ADMIN_RADIUS.lg,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
});
