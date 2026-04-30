const BASE_URL = 'https://json.astrologyapi.com/v1';

function parseDob(dob) {
  const [year, month, day] = String(dob).split('-').map(Number);
  return { year, month, day };
}

function parseTob(tob) {
  const [hour, min] = String(tob || '00:00').split(':').map(Number);
  return { hour: hour || 0, min: min || 0 };
}

function toNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '' || value === 'null') continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function getHeaders() {
  const token = process.env.ASTROLOGYAPI_ACCESS_TOKEN;
  const userId = process.env.ASTROLOGYAPI_USER_ID;
  const apiKey = process.env.ASTROLOGYAPI_API_KEY;

  const headers = {
    'Content-Type': 'application/json',
    'Accept-Language': 'en'
  };

  if (userId && apiKey) {
    headers.Authorization = `Basic ${Buffer.from(`${userId}:${apiKey}`).toString('base64')}`;
    return headers;
  }

  if (token) {
    headers['x-astrologyapi-key'] = token;
    return headers;
  }

  return null;
}

async function callApi(endpoint, payload) {
  const headers = getHeaders();
  if (!headers) {
    return {
      success: false,
      skipped: true,
      provider: 'AstrologyAPI.com',
      error: 'AstrologyAPI credentials missing. Add ASTROLOGYAPI_USER_ID and ASTROLOGYAPI_API_KEY, or ASTROLOGYAPI_ACCESS_TOKEN.'
    };
  }

  const response = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!response.ok) {
    return { success: false, provider: 'AstrologyAPI.com', endpoint, status: response.status, error: data };
  }

  return { success: true, provider: 'AstrologyAPI.com', endpoint, data };
}

function pickGeo(data) {
  const list = data?.geonames || data?.output || data;
  if (Array.isArray(list)) return list[0];
  if (list && typeof list === 'object') return list;
  return null;
}

async function getGeoDetails(place) {
  const result = await callApi('geo_details', { place, maxRows: 1 });
  if (!result.success) return result;

  const geo = pickGeo(result.data);
  if (!geo) return { success: false, provider: 'AstrologyAPI.com', error: 'Location not found', raw: result.data };

  const latitude = toNumber(geo.latitude, geo.lat);
  const longitude = toNumber(geo.longitude, geo.lon, geo.lng);

  if (latitude === null || longitude === null) {
    return { success: false, provider: 'AstrologyAPI.com', error: 'Geo result missing latitude or longitude', geo, raw: result.data };
  }

  return {
    success: true,
    provider: 'AstrologyAPI.com',
    geo: { ...geo, latitude, longitude },
    raw: result.data
  };
}

function timezoneDate(dob) {
  const { year, month, day } = parseDob(dob);
  return `${month}-${day}-${year}`;
}

async function getTimezone({ latitude, longitude, dob }) {
  const result = await callApi('timezone_with_dst', {
    latitude,
    longitude,
    date: timezoneDate(dob)
  });

  if (result.success) {
    const timezone = toNumber(result.data?.timezone, result.data?.tzone, result.data?.offset);
    if (timezone !== null) return { success: true, timezone, raw: result.data };
  }

  return { success: false, timezone: 5.5, raw: result };
}

async function getVedicPlanets({ dob, tob, pob }) {
  const geoResult = await getGeoDetails(pob);
  if (!geoResult.success) return { success: false, provider: 'AstrologyAPI.com', stage: 'geo_details', error: geoResult.error || geoResult };

  const timezoneResult = await getTimezone({ latitude: geoResult.geo.latitude, longitude: geoResult.geo.longitude, dob });
  const d = parseDob(dob);
  const t = parseTob(tob);

  const payload = {
    day: d.day,
    month: d.month,
    year: d.year,
    hour: t.hour,
    min: t.min,
    lat: geoResult.geo.latitude,
    lon: geoResult.geo.longitude,
    tzone: timezoneResult.timezone
  };

  const birthDetails = await callApi('birth_details', payload);
  const planets = await callApi('planets', payload);

  return {
    success: planets.success,
    provider: 'AstrologyAPI.com',
    geo: {
      place_name: geoResult.geo.place_name || pob,
      latitude: geoResult.geo.latitude,
      longitude: geoResult.geo.longitude,
      timezone: timezoneResult.timezone,
      timezone_id: geoResult.geo.timezone_id,
      country_code: geoResult.geo.country_code
    },
    input: payload,
    birth_details: birthDetails.success ? birthDetails.data : null,
    planets: planets.success ? planets.data : null,
    error: planets.success ? null : planets.error,
    debug: {
      timezone_status: timezoneResult.success ? 'api' : 'fallback_5_5',
      birth_details_status: birthDetails.success
    }
  };
}

module.exports = { getVedicPlanets };
