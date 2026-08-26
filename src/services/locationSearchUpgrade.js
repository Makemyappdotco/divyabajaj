const INDIA_BBOX = '68.0,6.0,98.0,38.0';
const PHOTON_URL = 'https://photon.komoot.io/api/';
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

function clean(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalise(value) {
  return clean(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compact(value) {
  return normalise(value).replace(/\s+/g, '');
}

function words(value) {
  return normalise(value).split(' ').filter(Boolean);
}

function uniqueParts(parts) {
  const seen = new Set();
  return parts.filter(Boolean).map(clean).filter(part => {
    const key = normalise(part);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function photonPlaceName(properties = {}) {
  const locality = properties.name || properties.street || properties.locality || properties.district || properties.city;
  return uniqueParts([
    locality,
    properties.suburb,
    properties.district,
    properties.city,
    properties.county,
    properties.state,
    properties.country
  ]).join(', ');
}

function photonRow(feature, index) {
  const p = feature?.properties || {};
  const coordinates = feature?.geometry?.coordinates || [];
  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);
  const countryCode = clean(p.countrycode || p.country_code).toUpperCase();
  const rawName = clean(p.name || p.street || p.locality || p.district || p.city);
  const placeName = photonPlaceName(p);

  if (!placeName || !rawName || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    id: `photon-${p.osm_type || 'x'}-${p.osm_id || index}`,
    raw_name: rawName,
    place_name: placeName,
    latitude,
    longitude,
    timezone_id: '',
    country_code: countryCode,
    country: clean(p.country),
    admin1: clean(p.state),
    admin2: clean(p.county || p.district),
    population: Number(p.population) || 0,
    place_type: clean(p.osm_value || p.type || p.osm_key),
    provider: 'photon_osm'
  };
}

async function photonSearch(query, { indiaOnly = false, limit = 50 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const url = new URL(PHOTON_URL);
    url.searchParams.set('q', indiaOnly ? `${query}, India` : query);
    url.searchParams.set('limit', String(Math.min(Math.max(limit, 10), 50)));
    url.searchParams.set('lang', 'en');
    if (indiaOnly) url.searchParams.set('bbox', INDIA_BBOX);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DivyaBajaj.com Location Search/1.0'
      }
    });

    if (!response.ok) throw new Error(`Photon returned HTTP ${response.status}`);
    const data = await response.json();
    return (Array.isArray(data?.features) ? data.features : [])
      .map(photonRow)
      .filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

function isAllowedPlaceType(row) {
  const type = normalise(row.place_type);
  if (!type) return true;
  return /city|town|village|hamlet|suburb|neighbourhood|neighborhood|locality|quarter|residential|district|county|state|region|municipality|administrative|borough|ward/.test(type);
}

function looksLikePoiOrStreetName(row, query) {
  const name = normalise(row.raw_name || '');
  const wanted = normalise(query.split(',')[0]);
  if (!name || name === wanted || compact(name) === compact(wanted)) return false;
  return /\b(road|rd|lane|street|avenue|boulevard|expressway|highway|station|stop|hospital|clinic|school|college|university|bank|mall|market|hotel|restaurant|temple|mosque|church|office|complex|centre|center)\b/.test(name);
}

function isRelevant(row, query) {
  if (!isAllowedPlaceType(row) || looksLikePoiOrStreetName(row, query)) return false;

  const queryCore = normalise(query.split(',')[0]);
  const wantedCompact = compact(queryCore);
  const name = normalise(row.raw_name || row.place_name);
  const nameCompact = compact(name);
  const full = normalise(row.place_name);
  const fullCompact = compact(full);

  if (
    name === queryCore ||
    nameCompact === wantedCompact ||
    name.startsWith(queryCore) ||
    name.includes(queryCore) ||
    nameCompact.includes(wantedCompact)
  ) return true;

  const queryWords = words(queryCore);
  const nameWords = new Set(words(name));
  const fullWords = new Set(words(full));
  const allQueryWordsInFull = queryWords.length > 0 && queryWords.every(word => fullWords.has(word));
  const queryWordsInName = queryWords.filter(word => nameWords.has(word)).length;
  const enoughNameOverlap = queryWordsInName >= Math.ceil(queryWords.length / 2);

  return Boolean(
    (full.includes(queryCore) || fullCompact.includes(wantedCompact)) &&
    allQueryWordsInFull &&
    enoughNameOverlap
  );
}

function score(row, query) {
  const wanted = normalise(query.split(',')[0]);
  const wantedCompact = compact(wanted);
  const name = normalise(row.raw_name || row.place_name);
  const nameCompact = compact(name);
  const full = normalise(row.place_name);
  let points = 0;

  if (name === wanted || nameCompact === wantedCompact) points += 5000;
  else if (name.startsWith(wanted)) points += 1400;
  else if (name.includes(wanted) || nameCompact.includes(wantedCompact)) points += 800;
  else if (full.includes(wanted) || compact(full).includes(wantedCompact)) points += 350;

  if (row.country_code === 'IN') points += 1200;

  const type = normalise(row.place_type);
  if (/city|town/.test(type)) points += 600;
  else if (/suburb/.test(type)) points += 520;
  else if (/locality/.test(type)) points += 460;
  else if (/neighbourhood|neighborhood|quarter/.test(type)) points += 400;
  else if (/village|hamlet/.test(type)) points += 360;
  else if (/residential/.test(type)) points += 160;
  else if (/district|county/.test(type)) points += 180;
  else if (/state|region/.test(type)) points += 120;

  if (row.population >= 100000) points += 420;
  else if (row.population >= 10000) points += 280;
  else if (row.population >= 1000) points += 140;
  if (row.population) points += Math.min(Math.log10(Math.max(row.population, 1)) * 10, 70);

  return points;
}

function dedupe(rows) {
  const seen = new Set();
  return rows.filter(row => {
    if (!row || !row.place_name || !Number.isFinite(Number(row.latitude)) || !Number.isFinite(Number(row.longitude))) return false;
    const key = `${normalise(row.place_name)}|${Number(row.latitude).toFixed(4)}|${Number(row.longitude).toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanLegacyRow(row) {
  if (!row) return null;
  return {
    ...row,
    timezone_id: '',
    place_type: row.place_type || '',
    provider: row.provider || 'legacy_geocoder'
  };
}

async function broadSearch(query, legacySearch) {
  const settled = await Promise.allSettled([
    photonSearch(query, { indiaOnly: true, limit: 50 }),
    photonSearch(query, { indiaOnly: false, limit: 35 }),
    legacySearch(query, 25)
  ]);

  const rows = [];
  settled.forEach((result, index) => {
    if (result.status !== 'fulfilled') return;
    const values = Array.isArray(result.value) ? result.value : [];
    rows.push(...(index === 2 ? values.map(cleanLegacyRow).filter(Boolean) : values));
  });

  if (!rows.length) throw new Error('Could not search locations right now. Please try again in a moment.');

  return dedupe(rows)
    .filter(row => isRelevant(row, query))
    .sort((a, b) => {
      const diff = score(b, query) - score(a, query);
      if (diff) return diff;
      return a.place_name.localeCompare(b.place_name);
    })
    .slice(0, 40);
}

module.exports = function installLocationSearchUpgrade() {
  const astrology = require('./astrologyApiV2');
  if (astrology.__indiaWideLocationUpgradeInstalled) return;

  const legacySearch = astrology.searchLocations.bind(astrology);

  astrology.searchLocations = async function searchLocationsIndiaWide(place) {
    const query = clean(place);
    if (query.length < 2) return [];

    const key = normalise(query);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.rows;

    const rows = await broadSearch(query, legacySearch);
    cache.set(key, { at: Date.now(), rows });

    if (cache.size > 150) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 30);
      oldest.forEach(([cacheKey]) => cache.delete(cacheKey));
    }

    return rows;
  };

  astrology.__indiaWideLocationUpgradeInstalled = true;
};
