const BASE_URL = 'https://json.freeastrologyapi.com';

function parseDob(dob) {
  const [year, month, date] = String(dob).split('-').map(Number);
  return { year, month, date };
}

function parseTob(tob) {
  const [hours, minutes] = String(tob || '00:00').split(':').map(Number);
  return { hours: hours || 0, minutes: minutes || 0, seconds: 0 };
}

function toNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '' || value === 'null') continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

async function callApi(endpoint, payload) {
  const key = process.env.FREE_ASTROLOGY_API_KEY;
  if (!key) return { success: false, skipped: true, error: 'FREE_ASTROLOGY_API_KEY missing' };

  const response = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!response.ok) return { success: false, status: response.status, error: data };
  return { success: true, data };
}

function pickGeo(data) {
  if (Array.isArray(data)) return data[0];
  if (Array.isArray(data?.output)) return data.output[0];
  if (data?.output && typeof data.output === 'object') return data.output;
  return data;
}

async function getGeoDetails(place) {
  const result = await callApi('geo-details', { location: place });
  if (!result.success) return result;

  const geo = pickGeo(result.data);
  if (!geo) return { success: false, error: 'Location not found', raw: result.data };

  const latitude = toNumber(geo.latitude, geo.lat);
  const longitude = toNumber(geo.longitude, geo.lon, geo.lng);
  const timezone = toNumber(geo.timezone_offset, geo.timezone, geo.tzone, geo.offset, 5.5);

  if (latitude === null || longitude === null || timezone === null) {
    return { success: false, error: 'Geo result missing latitude, longitude, or timezone', geo, raw: result.data };
  }

  return {
    success: true,
    geo: {
      ...geo,
      latitude,
      longitude,
      timezone
    },
    raw: result.data
  };
}

async function getVedicPlanets({ dob, tob, pob }) {
  const geoResult = await getGeoDetails(pob);
  if (!geoResult.success) return { success: false, stage: 'geo-details', error: geoResult.error || geoResult };

  const d = parseDob(dob);
  const t = parseTob(tob);
  const payload = {
    year: d.year,
    month: d.month,
    date: d.date,
    hours: t.hours,
    minutes: t.minutes,
    seconds: t.seconds,
    latitude: geoResult.geo.latitude,
    longitude: geoResult.geo.longitude,
    timezone: geoResult.geo.timezone,
    settings: {
      observation_point: 'topocentric',
      ayanamsha: 'lahiri',
      language: 'en'
    }
  };

  const planetsResult = await callApi('planets/extended', payload);

  return {
    success: planetsResult.success,
    provider: 'FreeAstrologyAPI',
    geo: geoResult.geo,
    input: payload,
    planets: planetsResult.success ? planetsResult.data : null,
    error: planetsResult.success ? null : planetsResult.error
  };
}

module.exports = { getVedicPlanets };
