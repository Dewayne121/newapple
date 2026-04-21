import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

// Responsive scaling
const BASE_WIDTH = 393;
const MAX_SCALE_WIDTH = 480;
const effectiveWidth = Math.min(width, MAX_SCALE_WIDTH);

const scale = (size) => (effectiveWidth / BASE_WIDTH) * size;

const moderateScale = (size) => {
  const scaled = scale(size);
  if (width > MAX_SCALE_WIDTH) {
    return size;
  }
  return scaled > size ? size + (scaled - size) * 0.5 : scaled;
};

// Font family
const FONT = 'SpaceGrotesk';
const FONT_MEDIUM = 'SpaceGroteskMedium';
const FONT_BOLD = 'SpaceGroteskBold';
const FONT_SEMIBOLD = 'SpaceGroteskSemiBold';

// =========================
// SKINS (THEMES)
// =========================
export const SKINS = {
  minimal: 'minimal',
  operator: 'operator',
  midnight: 'midnight',
};

// Zinc + Neon Red Theme
export const THEMES = {
  [SKINS.minimal]: {
    bgDeep: '#09090b',
    bgPanel: '#09090b',
    bgCard: '#121214',
    bgSurface: '#18181b',
    primary: '#DC2626',
    primaryDim: 'rgba(220, 38, 38, 0.10)',
    textMain: '#fafafa',
    textMuted: '#a1a1aa',
    border: '#27272a',
    borderDim: '#1e1e20',
    danger: '#DC2626',
    gold: '#ffd740',
    success: '#00e676',
    warning: '#ffab40',
    shadow: 'rgba(0,0,0,0.5)',
    shadowSoft: 'rgba(0,0,0,0.3)',
    neonGlow: 'rgba(220, 38, 38, 0.15)',
    neonGlowStrong: 'rgba(220, 38, 38, 0.4)',
    accentWarm: '#ff8a5c',
    accentSoft: '#ff6b6b',
  },
  [SKINS.operator]: {
    bgDeep: '#09090b',
    bgPanel: '#09090b',
    bgCard: '#121214',
    bgSurface: '#18181b',
    primary: '#DC2626',
    primaryDim: 'rgba(220, 38, 38, 0.10)',
    textMain: '#fafafa',
    textMuted: '#a1a1aa',
    border: '#27272a',
    borderDim: '#1e1e20',
    danger: '#DC2626',
    gold: '#ffd740',
    success: '#00e676',
    warning: '#ffab40',
    shadow: 'rgba(0,0,0,0.5)',
    shadowSoft: 'rgba(0,0,0,0.3)',
    neonGlow: 'rgba(220, 38, 38, 0.15)',
    neonGlowStrong: 'rgba(220, 38, 38, 0.4)',
    accentWarm: '#ff8a5c',
    accentSoft: '#ff6b6b',
  },
  [SKINS.midnight]: {
    bgDeep: '#09090b',
    bgPanel: '#09090b',
    bgCard: '#121214',
    bgSurface: '#18181b',
    primary: '#DC2626',
    primaryDim: 'rgba(220, 38, 38, 0.10)',
    textMain: '#fafafa',
    textMuted: '#a1a1aa',
    border: '#27272a',
    borderDim: '#1e1e20',
    danger: '#DC2626',
    gold: '#ffd740',
    success: '#00e676',
    warning: '#ffab40',
    shadow: 'rgba(0,0,0,0.5)',
    shadowSoft: 'rgba(0,0,0,0.3)',
    neonGlow: 'rgba(220, 38, 38, 0.15)',
    neonGlowStrong: 'rgba(220, 38, 38, 0.4)',
    accentWarm: '#ff8a5c',
    accentSoft: '#ff6b6b',
  },
};

export function getTheme(skin = SKINS.operator) {
  return THEMES[skin] || THEMES[SKINS.operator];
}

const defaultTheme = THEMES[SKINS.operator];

// Static Colors object (backwards compatibility)
export const Colors = {
  background: defaultTheme.bgDeep,
  card: defaultTheme.bgPanel,
  cardLight: defaultTheme.bgCard,
  surface: defaultTheme.bgCard,
  surfaceLight: defaultTheme.bgDeep,
  surfaceElevated: defaultTheme.bgDeep,

  text: defaultTheme.textMain,
  textSecondary: defaultTheme.textMain,
  textMuted: defaultTheme.textMuted,
  muted: defaultTheme.textMuted,
  muted2: defaultTheme.textMuted,
  textDark: '#3f3f46',

  primary: defaultTheme.primary,
  primaryDark: defaultTheme.primary,
  primaryLight: '#ff6b6b',
  primarySubtle: defaultTheme.primaryDim,
  primarySubtleMedium: defaultTheme.primaryDim,
  primaryGlow: defaultTheme.neonGlow,

  accent: defaultTheme.primary,
  accentLight: '#ff6b6b',

  success: defaultTheme.success,
  warning: '#ffab40',
  error: '#ff2d55',
  info: '#4a9eff',

  gold: defaultTheme.gold,
  silver: '#c0c0d0',
  bronze: '#ff8a5c',
  orange: '#ff8a5c',
  yellow: '#ffd740',

  border: defaultTheme.border,
  borderLight: defaultTheme.borderDim,
  divider: defaultTheme.border,

  overlay: 'rgba(10, 10, 20, 0.7)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: moderateScale(12),
  lg: moderateScale(16),
  xl: moderateScale(20),
  xxl: moderateScale(28),
  xxxl: moderateScale(36),
};

export const BorderRadius = {
  xs: 12,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  '2xl': 28,
  '3xl': 32,
  full: 9999,
};

export const Typography = {
  h1: { fontSize: moderateScale(30), fontWeight: '800', fontFamily: FONT_BOLD, letterSpacing: -0.6, lineHeight: moderateScale(36) },
  h2: { fontSize: moderateScale(24), fontWeight: '800', fontFamily: FONT_BOLD, letterSpacing: -0.4, lineHeight: moderateScale(30) },
  h3: { fontSize: moderateScale(18), fontWeight: '700', fontFamily: FONT_SEMIBOLD, letterSpacing: -0.2, lineHeight: moderateScale(24) },
  h4: { fontSize: moderateScale(15), fontWeight: '700', fontFamily: FONT_SEMIBOLD, letterSpacing: -0.1, lineHeight: moderateScale(20) },

  body: { fontSize: moderateScale(15), fontWeight: '400', fontFamily: FONT, letterSpacing: 0, lineHeight: moderateScale(22) },
  bodySmall: { fontSize: moderateScale(13), fontWeight: '400', fontFamily: FONT, letterSpacing: 0, lineHeight: moderateScale(18) },
  caption: { fontSize: moderateScale(12), fontWeight: '700', fontFamily: FONT_SEMIBOLD, letterSpacing: 1.2, lineHeight: moderateScale(14) },
  mono: { fontSize: moderateScale(12), fontWeight: '600', fontFamily: FONT_SEMIBOLD, letterSpacing: 0.2, lineHeight: moderateScale(16) },

  display: { fontSize: moderateScale(22), fontWeight: '800', fontFamily: FONT_BOLD, letterSpacing: -0.2, lineHeight: moderateScale(26) },
  displaySmall: { fontSize: moderateScale(18), fontWeight: '800', fontFamily: FONT_BOLD, letterSpacing: -0.1, lineHeight: moderateScale(22) },

  monoTiny: { fontSize: 9, fontWeight: '700', fontFamily: FONT_SEMIBOLD, letterSpacing: 0.5, textTransform: 'uppercase' },
  monoSmall: { fontSize: 10, fontWeight: '800', fontFamily: FONT_BOLD, letterSpacing: 1, textTransform: 'uppercase' },
  monoBody: { fontSize: 11, fontWeight: '700', fontFamily: FONT_SEMIBOLD, letterSpacing: 0.5, textTransform: 'uppercase' },
  monoLarge: { fontSize: 13, fontWeight: '800', fontFamily: FONT_BOLD, letterSpacing: 1, textTransform: 'uppercase' },
};

export const isSmallScreen = width < 375;
export const isMediumScreen = width >= 375 && width < 414;
export const isLargeScreen = width >= 414;

export const Shadows = {
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === 'ios' ? 0.15 : 0.2,
    shadowRadius: 14,
    elevation: 3,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: Platform.OS === 'ios' ? 0.25 : 0.35,
    shadowRadius: 20,
    elevation: 6,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: Platform.OS === 'ios' ? 0.35 : 0.45,
    shadowRadius: 28,
    elevation: 10,
  },
  heavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: Platform.OS === 'ios' ? 0.4 : 0.5,
    shadowRadius: 35,
    elevation: 12,
  },
  glow: {
    shadowColor: '#ff2d55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === 'ios' ? 0.3 : 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  neonFloat: {
    shadowColor: '#ff2d55',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.OS === 'ios' ? 0.2 : 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
};

export { moderateScale };
export { FONT, FONT_MEDIUM, FONT_BOLD, FONT_SEMIBOLD };
