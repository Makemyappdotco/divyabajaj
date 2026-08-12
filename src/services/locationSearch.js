const { searchLocations: searchAstrologyLocations } = require('./astrologyApiV2');

let locationDb = null;

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

function clean(value) {
  return String(value || '').trim();
}

function normalise(value) {
  return clean(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function countryBy(db, city) {
  const countryId = city.country_id ?? city.countryId;
  const countryCode = clean(city.country_code || city.countryCode || city.countryCode2 || city.iso2).toUpperCase();
  try {
    if (countryId != null && typeof db.getCountryById === 'function') {
      const value = db.getCountryById(Number(countryId));
      if (value) return value;
    }
    if (countryCode && typeof db.getCountryByIso2 === 'function') {
      const value = db.getCountryByIso2(countryCode);
      if (value) return value;
    }
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
  try {
    cities = db.searchCities(query) || [];
  } catch (error) {
    console.warn('[Structured city search failed]', error.message);
    return [];
  }

  const wanted = normalise(query);
  return cities
    .map((city, index) => {
      const placeName = clean(city.name || city.place_name);
      const latitude = numberValue(city.latitude ?? city.lat);
      const longitude = numberValue(city.longitude ?? city.lon);
      if (!placeName || latitude == null || longitude == null) return null;

      const state = stateBy(db, city);
      const country = countryBy(db, city);
      const stateName = clean(state?.name || city.state_name || city.stateName);
      const countryName = clean(country?.name || city.country_name || city.countryName);
      const countryCode = clean(country?.iso2 || country?.isoCode || city.country_code || city.countryCode).toUpperCase();
      const displayParts = [placeName, stateName, countryName || countryCode].filter(Boolean);
      const displayName = [...new Set(displayParts)].join(', ');
      const nameNorm = normalise(placeName);
      let score = 0;
      if (nameNorm === wanted) score += 1000;
      else if (nameNorm.startsWith(wanted)) score += 600;
      else if (nameNorm.includes(wanted)) score += 350;
      else if (normalise(displayName).includes(wanted)) score += 150;

      return {
        id: `csc-${city.id || index}-${latitude}-${longitude}`,
        place_name: placeName,
        display_name: displayName || placeName,
        region: stateName,
        country_name: countryName,
        country_code: countryCode,
        latitude,
        longitude,
        timezone_id: '',
        context: [stateName, countryName || countryCode].filter(Boolean).join(' · '),
        source: 'world_location_database',
        score
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.display_name.localeCompare(b.display_name))
    .slice(0, Math.max(maxRows * 2, 20));
}

function samePlace(a, b) {
  if (!a || !b) return false;
  const sameName = normalise(a.place_name) === normalise(b.place_name);
  const latDiff = Math.abs(Number(a.latitude) - Number(b.latitude));
  const lonDiff = Math.abs(Number(a.longitude) - Number(b.longitude));
  return sameName && latDiff < 0.15 && lonDiff < 0.15;
}

function cleanFallback(row) {
  const placeName = clean(row.place_name);
  const country = clean(row.country_name || row.country_code);
  return {
    ...row,
    place_name: placeName,
    display_name: [placeName, clean(row.region), country].filter(Boolean).join(', ') || placeName,
    context: [clean(row.region), country].filter(Boolean).join(' · '),
    coordinate_hint: '',
    source: 'astrologyapi_geo'
  };
}

async function searchLocations(query, maxRows = 12) {
  const text = clean(query);
  if (text.length < 2) return [];
  const limit = Math.min(Math.max(Number(maxRows) || 12, 1), 12);

  const structured = structuredCityRows(text, limit);
  let fallback = [];
  try {
    fallback = (await searchAstrologyLocations(text, limit)).map(cleanFallback);
  } catch (error) {
    console.warn('[Astrology location fallback failed]', error.message);
  }

  const merged = [...structured];
  fallback.forEach(row => {
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
