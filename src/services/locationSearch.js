const { searchLocations: searchAstrologyLocations } = require('./astrologyApiV2');

let locationDb = null;
const photonCache = new Map();
const PHOTON_CACHE_MS = 10 * 60 * 1000;

function getLocationDb() {
  if (locationDb) return locationDb;
  try {
    const moduleValue = require('@tansuasici/country-state-city');
    locationDb = moduleValue.CountryStateCity || moduleValue.default || moduleValue;
  } catch (error) {
    console.warn('[Location database unavailable]', error.message);
    locationDb = null;
  }
  return locationDb;
}

function clean(value) { return String(value || '').trim(); }
function normalise(value) {
  return clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function uniqueText(values) {
  const seen = new Set();
  return values.filter(Boolean).filter(value => {
    const key = normalise(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function scoreName(rawName, displayName, query) {
  const nameNorm = normalise(rawName);
  const displayNorm = normalise(displayName);
  const wanted = normalise(query);
  if (nameNorm === wanted) return 1000;
  if (nameNorm.startsWith(wanted)) return 650;
  if (displayNorm.startsWith(wanted)) return 550;
  if (nameNorm.includes(wanted)) return 350;
  if (displayNorm.includes(wanted)) return 180;
  return 0;
}

function countryBy(db, city) {
  const countryId = city.country_id ?? city.countryId;
  const countryCode = clean(city.country_code || city.countryCode || city.countryCode2 || city.iso2).toUpperCase();
  try {
    if (countryId != null && typeof db.getCountryById === 'function') {
      const value = db.getCountryById(Number(countryId));
      if (value) return value;
    }
    if (countryCode && typeof db.getCountryByIso2 === 'function') return db.getCountryByIso2(countryCode) || null;
  } catch (error) {}
  return null;
}

function stateBy(db, city) {
  const stateId = city.state_id ?? city.stateId;
  const stateCode = clean(city.state_code || city.stateCode || city.isoCode).toUpperCase();
  const countryCode = clean(city.country_code || city.countryCode).toUpperCase();
  try {
    if (stateId != null && typeof db.getStateById === 'function') {
      const value = db.getStateById(Number(stateId));
      if (value) return value;
    }
    if (stateCode && countryCode && typeof db.getStatesByCountryCode === 'function') {
      const states = db.getStatesByCountryCode(countryCode) || [];
      return states.find(item => clean(item.isoCode || item.state_code || item.stateCode).toUpperCase() === stateCode) || null;
    }
  } catch (error) {}
  return null;
}

function structuredCityRows(query, maxRows) {
  const db = getLocationDb();
  if (!db || typeof db.searchCities !== 'function') return [];
  let cities = [];
  try { cities = db.searchCities(query) || []; }
  catch (error) {
    console.warn('[Structured city search failed]', error.message);
    return [];
  }

  return cities.map((city, index) => {
    const rawName = clean(city.name || city.place_name);
    const latitude = numberValue(city.latitude ?? city.lat);
    const longitude = numberValue(city.longitude ?? city.lon);
    if (!rawName || latitude == null || longitude == null) return null;

    const state = stateBy(db, city);
    const country = countryBy(db, city);
    const stateName = clean(state?.name || city.state_name || city.stateName);
    const countryName = clean(country?.name || city.country_name || city.countryName);
    const countryCode = clean(country?.iso2 || country?.isoCode || city.country_code || city.countryCode).toUpperCase();
    const displayName = uniqueText([rawName, stateName, countryName || countryCode]).join(', ');

    return {
      id: `csc-${city.id || index}-${latitude}-${longitude}`,
      raw_name: rawName,
      canonical_place_name: rawName,
      place_name: displayName || rawName,
      display_name: displayName || rawName,
      region: stateName,
      country_name: countryName,
      country_code: countryCode,
      latitude,
      longitude,
      timezone_id: '',
      context: uniqueText([stateName, countryName || countryCode]).join(' · '),
      source: 'world_location_database',
      score: scoreName(rawName, displayName, query) + 40
    };
  }).filter(Boolean)
    .sort((a, b) => b.score - a.score || a.display_name.localeCompare(b.display_name))
    .slice(0, Math.max(maxRows * 2, 20));
}

function photonAllowed(properties = {}) {
  const type = normalise(properties.type || properties.osm_value || properties.osmValue);
  const key = normalise(properties.osm_key || properties.osmKey);
  if (key === 'place') return true;
  return ['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood', 'neighborhood', 'locality', 'district', 'borough', 'municipality', 'county', 'state'].includes(type);
}

async function photonRows(query, maxRows) {
  const cacheKey = normalise(query);
  const cached = photonCache.get(cacheKey);
  if (cached && Date.now() - cached.at < PHOTON_CACHE_MS) return cached.rows.slice(0, maxRows);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${Math.min(Math.max(maxRows * 2, 10), 30)}&lang=en`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en',
        'User-Agent': 'DivyaBajajLocationSearch/1.0 (https://divyabajaj.vercel.app)'
      }
    });
    if (!response.ok) throw new Error(`Photon returned ${response.status}`);
    const data = await response.json();
    const features = Array.isArray(data?.features) ? data.features : [];
    const rows = features.map((feature, index) => {
      const properties = feature?.properties || {};
      if (!photonAllowed(properties)) return null;
      const coordinates = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates : [];
      const longitude = numberValue(coordinates[0]);
      const latitude = numberValue(coordinates[1]);
      if (latitude == null || longitude == null) return null;

      const rawName = clean(properties.name || properties.district || properties.city || properties.locality || properties.county);
      if (!rawName) return null;
      const parentCity = clean(properties.city || properties.town || properties.village);
      const district = clean(properties.district || properties.county);
      const stateName = clean(properties.state);
      const countryName = clean(properties.country);
      const countryCode = clean(properties.countrycode || properties.country_code).toUpperCase();
      const displayName = uniqueText([rawName, parentCity, district, stateName, countryName || countryCode]).join(', ');
      const type = clean(properties.type || properties.osm_value || properties.osmValue);
      const exactBonus = normalise(rawName) === normalise(query) ? 80 : 0;

      return {
        id: `photon-${properties.osm_type || 'osm'}-${properties.osm_id || index}-${latitude}-${longitude}`,
        raw_name: rawName,
        canonical_place_name: rawName,
        place_name: displayName || rawName,
        display_name: displayName || rawName,
        region: stateName,
        country_name: countryName,
        country_code: countryCode,
        latitude,
        longitude,
        timezone_id: '',
        context: uniqueText([parentCity, district, stateName, countryName || countryCode]).join(' · '),
        source: 'openstreetmap_photon',
        location_type: type,
        score: scoreName(rawName, displayName, query) + exactBonus + 20
      };
    }).filter(Boolean)
      .sort((a, b) => b.score - a.score || a.display_name.localeCompare(b.display_name));

    photonCache.set(cacheKey, { at: Date.now(), rows });
    if (photonCache.size > 100) photonCache.delete(photonCache.keys().next().value);
    return rows.slice(0, maxRows);
  } catch (error) {
    if (error.name !== 'AbortError') console.warn('[Photon location search failed]', error.message);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function comparisonName(row) {
  return normalise(row?.canonical_place_name || row?.raw_name || row?.place_name);
}

function samePlace(a, b) {
  if (!a || !b) return false;
  const sameName = comparisonName(a) === comparisonName(b);
  const latDiff = Math.abs(Number(a.latitude) - Number(b.latitude));
  const lonDiff = Math.abs(Number(a.longitude) - Number(b.longitude));
  return sameName && latDiff < 0.08 && lonDiff < 0.08;
}

function cleanFallback(row, query) {
  const rawName = clean(row.canonical_place_name || row.raw_name || row.place_name);
  const country = clean(row.country_name || row.country_code);
  const displayName = uniqueText([rawName, clean(row.region), country]).join(', ') || rawName;
  return {
    ...row,
    raw_name: rawName,
    canonical_place_name: rawName,
    place_name: displayName,
    display_name: displayName,
    context: uniqueText([clean(row.region), country]).join(' · '),
    coordinate_hint: '',
    source: 'astrologyapi_geo',
    score: scoreName(rawName, displayName, query)
  };
}

async function searchLocations(query, maxRows = 12) {
  const text = clean(query);
  if (text.length < 2) return [];
  const limit = Math.min(Math.max(Number(maxRows) || 12, 1), 12);
  const structured = structuredCityRows(text, limit);

  const [photonResult, astrologyResult] = await Promise.allSettled([
    photonRows(text, limit),
    searchAstrologyLocations(text, limit)
  ]);
  const photon = photonResult.status === 'fulfilled' ? photonResult.value : [];
  const fallback = astrologyResult.status === 'fulfilled'
    ? (astrologyResult.value || []).map(row => cleanFallback(row, text))
    : [];

  const merged = [];
  [...structured, ...photon, ...fallback]
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0) || a.display_name.localeCompare(b.display_name))
    .forEach(row => {
      if (!merged.some(existing => samePlace(existing, row))) merged.push(row);
    });

  const seen = new Set();
  return merged.filter(row => {
    const key = `${normalise(row.display_name)}:${Number(row.latitude).toFixed(4)}:${Number(row.longitude).toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

module.exports = { searchLocations };
