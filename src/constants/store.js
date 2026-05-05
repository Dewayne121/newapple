// ---------------------------------------------------------------------------
// Monetization product definitions — SKUs match App Store Connect
// ---------------------------------------------------------------------------

export const PRODUCTS = {
  // Feature 1: Paid weekly challenges
  CHALLENGE_ENTRY: {
    sku: 'com.unyield.challenge_entry',
    price: 1.99,
    currency: 'GBP',
    label: 'Challenge Entry',
  },

  // Feature 2: Profile frames
  FRAMES: [
    {
      id: 'bronze',
      sku: null, // free, no IAP
      name: 'Bronze',
      price: 0,
      color: '#CD7F32',
      borderWidth: 2.5,
      glowColor: null,
      description: 'Your starting frame',
    },
    {
      id: 'silver',
      sku: 'com.unyield.frame.silver',
      name: 'Silver',
      price: 0.99,
      color: '#C0C0D0',
      borderWidth: 2.5,
      glowColor: 'rgba(192, 192, 208, 0.25)',
      description: 'A sleek silver border',
    },
    {
      id: 'gold',
      sku: 'com.unyield.frame.gold',
      name: 'Gold',
      price: 1.99,
      color: '#FFD700',
      borderWidth: 3,
      glowColor: 'rgba(255, 215, 0, 0.3)',
      description: 'Stand out with gold',
    },
    {
      id: 'elite',
      sku: 'com.unyield.frame.elite',
      name: 'Elite',
      price: 2.99,
      color: '#00BCD4',
      borderWidth: 3,
      glowColor: 'rgba(0, 188, 212, 0.3)',
      description: 'Elite status energy',
    },
    {
      id: 'champion',
      sku: 'com.unyield.frame.champion',
      name: 'Champion',
      price: 4.99,
      color: '#FF2D55',
      borderWidth: 3,
      glowColor: 'rgba(255, 45, 85, 0.35)',
      description: 'The ultimate flex',
    },
  ],

  // Feature 3: Rank highlight
  RANK_HIGHLIGHT: {
    sku: 'com.unyield.rank_highlight',
    price: 0.99,
    currency: 'GBP',
    durationDays: 7,
    label: 'Rank Highlight',
    description: 'Glowing gold border on leaderboard',
  },

  // Feature 4: Extra challenge attempts
  EXTRA_ATTEMPT: {
    sku: 'com.unyield.extra_attempt',
    price: 0.99,
    currency: 'GBP',
    label: 'Extra Attempt',
  },
  FREE_ATTEMPTS: 1,

  // Feature 5: XP boost
  XP_BOOSTS: [
    {
      id: '1hr',
      sku: 'com.unyield.xpboost.1hr',
      name: '1 Hour Boost',
      price: 0.99,
      currency: 'GBP',
      durationHours: 1,
      multiplier: 1.5,
      description: '1.5x XP for 1 hour',
      icon: 'flash',
    },
    {
      id: '24hr',
      sku: 'com.unyield.xpboost.24hr',
      name: '24 Hour Boost',
      price: 2.49,
      currency: 'GBP',
      durationHours: 24,
      multiplier: 1.5,
      description: '1.5x XP for 24 hours',
      icon: 'flash',
    },
  ],
};

// All purchasable SKUs in one flat list (for initConnection / getProducts)
export const ALL_SKUS = [
  PRODUCTS.CHALLENGE_ENTRY.sku,
  ...PRODUCTS.FRAMES.filter(f => f.sku).map(f => f.sku),
  PRODUCTS.RANK_HIGHLIGHT.sku,
  PRODUCTS.EXTRA_ATTEMPT.sku,
  ...PRODUCTS.XP_BOOSTS.map(b => b.sku),
];

// Quick lookups
export const getFrameById = (id) => PRODUCTS.FRAMES.find(f => f.id === id);
export const getBoostById = (id) => PRODUCTS.XP_BOOSTS.find(b => b.id === id);
export const formatPrice = (price) => price === 0 ? 'FREE' : `\u00A3${price.toFixed(2)}`;
