const SITE_URL = String(process.env.SITE_URL || 'https://divyabajaj.com').replace(/\/$/, '');

module.exports = Object.freeze({
  name: 'Divya Bajaj',
  professionalTitle: 'Astro-Numerologist',
  website: 'https://divyabajaj.com',
  email: 'contact@divyabajaj.com',
  whatsapp: '+91 9545136766',
  officeCity: 'Gurugram',
  language: 'en',
  chartStyle: 'NORTH_INDIAN',
  reportPriceInr: 999,
  consultation: Object.freeze({
    priceInr: 4999,
    durationMinutes: 60,
    modes: ['phone', 'video'],
    bookingPath: '/consultation'
  }),
  companyInfo:
    'Divya Bajaj is a Gurugram-based Astro-Numerologist offering personalised astrology and numerology guidance for career, relationships, business and important life decisions through detailed reports and one-to-one consultations.',
  assetUrls: Object.freeze({
    logoNormal: `${SITE_URL}/assets/divya-bajaj/logo-normal.png`,
    logoGold: `${SITE_URL}/assets/divya-bajaj/logo-gold.png`,
    portraitClose: `${SITE_URL}/assets/divya-bajaj/portrait-close.jpg`,
    portraitFull: `${SITE_URL}/assets/divya-bajaj/portrait-full.jpg`
  })
});
