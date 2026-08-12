const brand = require('../config/divyaBrand');

const JSON_BASE_URL = 'https://json.astrologyapi.com/v1';
const PDF_BASE_URL = 'https://pdf.astrologyapi.com/v1';

function getMode() {
  return String(process.env.ASTROLOGYAPI_MODE || 'sandbox').toLowerCase();
}

function getToken({ pdf = false } = {}) {
  if (pdf && getMode() === 'sandbox') {
    const sandboxToken = process.env.ASTROLOGYAPI_PDF_SANDBOX_TOKEN;
    if (!sandboxToken) throw new Error('ASTROLOGYAPI_PDF_SANDBOX_TOKEN is missing');
    return sandboxToken;
  }
  const token = process.env.ASTROLOGYAPI_V2_ACCESS_TOKEN;
  if (!token) throw new Error('ASTROLOGYAPI_V2_ACCESS_TOKEN is missing');
  return token;
}

function parseDate(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Date of birth must use YYYY-MM-DD format');
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function parseTime(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error('Time of birth must use HH:MM format');
  const hour = Number(match[1]);
  const min = Number(match[2]);
  if (hour < 0 || hour > 23 || min < 0 || min > 59) throw new Error('Time of birth is invalid');
  return { hour, min };
}

function requiredNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} is required`);
  return number;
}

function normaliseGender(value) {
  const gender = String(value || '').trim().toLowerCase();
  if (!['male', 'female'].includes(gender)) throw new Error('Gender must be male or female for AstrologyAPI');
  return gender;
}

function normaliseBirthInput(input = {}) {
  const date = parseDate(input.dob);
  const time = parseTime(input.tob);
  const place = String(input.place || input.pob || '').trim();
  if (!place) throw new Error('Place of birth is required');
  return {
    name: String(input.name || '').trim(),
    gender: normaliseGender(input.gender),
    ...date,
    ...time,
    lat: requiredNumber(input.latitude ?? input.lat, 'Latitude'),
    lon: requiredNumber(input.longitude ?? input.lon, 'Longitude'),
    tzone: requiredNumber(input.timezone ?? input.tzone, 'Timezone'),
    place
  };
}

function birthPayload(input) {
  const birth = normaliseBirthInput(input);
  return {
    day: birth.day,
    month: birth.month,
    year: birth.year,
    hour: birth.hour,
    min: birth.min,
    lat: birth.lat,
    lon: birth.lon,
    tzone: birth.tzone
  };
}

async function post(path, payload, { pdf = false, timeoutMs = 60000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const baseUrl = pdf ? PDF_BASE_URL : JSON_BASE_URL;
  try {
    const response = await fetch(`${baseUrl}/${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': brand.language,
        'x-astrologyapi-key': getToken({ pdf })
      },
      body: JSON.stringify(payload)
    });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch (error) { data = { raw }; }
    if (!response.ok) {
      const message = data?.message || data?.error || data?.raw || `HTTP ${response.status}`;
      throw new Error(`AstrologyAPI ${path} failed: ${message}`);
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`AstrologyAPI ${path} timed out after ${timeoutMs} ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normaliseLocationText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function locationQueryVariants(value) {
  const query = String(value || '').trim();
  const variants = new Set([query]);
  const compact = query.replace(/\s+/g, '');
  if (compact && compact !== query) variants.add(compact);
  if (query.length >= 5) variants.add(query.slice(0, -1));
  if (/nagar$/i.test(query) && !/\snagar$/i.test(query)) variants.add(query.replace(/nagar$/i, ' Nagar'));
  if (/town$/i.test(query) && query.includes(' ')) variants.add(query.slice(0, -1));
  return [...variants].filter(item => item.length >= 2).slice(0, 4);
}

function locationScore(location, query) {
  const name = normaliseLocationText(location.place_name);
  const display = normaliseLocationText(location.display_name);
  const wanted = normaliseLocationText(query);
  let score = 0;
  if (name === wanted) score += 1000;
  else if (name.startsWith(wanted)) score += 500;
  else if (display.includes(wanted)) score += 250;
  else if (name.includes(wanted)) score += 100;
  return score;
}

function locationRegion(row) {
  return String(
    row.state_name || row.state || row.admin_name1 || row.admin1 || row.region || row.province || row.district || row.county || ''
  ).trim();
}

function locationCountryName(row) {
  return String(row.country_name || row.country || '').trim();
}

function mapLocation(row, query, index) {
  const placeName = String(row.place_name || row.name || '').trim();
  const latitude = Number(row.latitude ?? row.lat);
  const longitude = Number(row.longitude ?? row.lon);
  const region = locationRegion(row);
  const countryCode = String(row.country_code || '').trim().toUpperCase();
  const countryName = locationCountryName(row);
  const contextParts = [region, countryName || countryCode].filter(Boolean);
  const coordinateHint = Number.isFinite(latitude) && Number.isFinite(longitude)
    ? `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? 'N' : 'S'}, ${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? 'E' : 'W'}`
    : '';
  return {
    id: `${placeName || query}-${latitude}-${longitude}-${index}`,
    place_name: placeName,
    display_name: [placeName, ...contextParts].filter(Boolean).join(', '),
    region,
    country_name: countryName,
    country_code: countryCode,
    latitude,
    longitude,
    timezone_id: String(row.timezone_id || '').trim(),
    context: contextParts.length ? contextParts.join(' · ') : [countryCode, coordinateHint].filter(Boolean).join(' · '),
    coordinate_hint: coordinateHint
  };
}

async function searchLocations(place, maxRows = 12) {
  const query = String(place || '').trim();
  if (query.length < 2) return [];
  const requestedRows = Math.min(Math.max(Number(maxRows) || 12, 1), 12);
  const variants = locationQueryVariants(query);
  const settled = await Promise.allSettled(
    variants.map(variant => post('geo_details', { place: variant, maxRows: 25 }, { timeoutMs: 20000 }))
  );
  const merged = [];
  settled.forEach(result => {
    if (result.status !== 'fulfilled') return;
    const rows = Array.isArray(result.value?.geonames) ? result.value.geonames : [];
    merged.push(...rows);
  });
  const unique = new Map();
  merged.forEach((row, index) => {
    const mapped = mapLocation(row, query, index);
    if (!mapped.place_name || !Number.isFinite(mapped.latitude) || !Number.isFinite(mapped.longitude)) return;
    const key = `${mapped.latitude.toFixed(5)}:${mapped.longitude.toFixed(5)}`;
    if (!unique.has(key)) unique.set(key, mapped);
  });
  return [...unique.values()]
    .sort((a, b) => {
      const difference = locationScore(b, query) - locationScore(a, query);
      if (difference) return difference;
      return a.display_name.localeCompare(b.display_name);
    })
    .slice(0, requestedRows);
}

async function getTimezoneForBirth({ latitude, longitude, dob }) {
  const { year, month, day } = parseDate(dob);
  const date = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-${year}`;
  const result = await post('timezone_with_dst', {
    latitude: requiredNumber(latitude, 'Latitude'),
    longitude: requiredNumber(longitude, 'Longitude'),
    date
  });
  if (!result?.status || !Number.isFinite(Number(result.timezone))) {
    throw new Error('AstrologyAPI could not determine the timezone for this birth place and date');
  }
  return Number(result.timezone);
}

function buildPdfPayload(input) {
  const birth = normaliseBirthInput(input);
  return {
    ...birth,
    language: brand.language,
    chart_style: brand.chartStyle,
    footer_link: brand.website,
    logo_url: brand.assetUrls.logoNormal,
    company_name: brand.name,
    company_info: brand.companyInfo,
    domain_url: brand.website,
    company_email: brand.email,
    company_landline: '',
    company_mobile: brand.whatsapp
  };
}

async function generateProHoroscopePdf(input) {
  const result = await post('pro_horoscope_pdf', buildPdfPayload(input), { pdf: true, timeoutMs: 120000 });
  if (!result?.status || !result?.pdf_url) throw new Error('Professional Horoscope PDF response did not contain a PDF URL');
  return result;
}
async function generateProNumerologyPdf(input) {
  const result = await post('pro_numerology_report', buildPdfPayload(input), { pdf: true, timeoutMs: 120000 });
  if (!result?.status || !result?.pdf_url) throw new Error('Pro Numerology PDF response did not contain a PDF URL');
  return result;
}
async function getPlanets(input) { return post('planets', birthPayload(input)); }
async function getKpPlanets(input) { return post('kp_planets', birthPayload(input)); }
async function getKpHouseCusps(input) { return post('kp_house_cusps', birthPayload(input)); }
async function getKpPlanetSignificators(input) { return post('kp_planet_significator', birthPayload(input)); }
async function getKpHouseSignificators(input) { return post('kp_house_significator', birthPayload(input)); }
async function getCurrentVdasha(input) { return post('current_vdasha', birthPayload(input)); }
async function getCurrentVdashaAll(input) { return post('current_vdasha_all', birthPayload(input)); }
async function getChartData(input, chartId = 'D1') {
  return post(`horo_chart/${encodeURIComponent(chartId)}`, { ...birthPayload(input), chartType: 'north', image_type: 'png' });
}
async function getChartImage(input, chartId = 'D1') {
  return post(`horo_chart_image/${encodeURIComponent(chartId)}`, {
    ...birthPayload(input), planetColor: '#171319', signColor: '#8B6A2E', lineColor: '#B8924F', chartType: 'north', image_type: 'svg'
  });
}
async function getNumerologicalNumbers(input) {
  const { year, month, day } = parseDate(input.dob);
  return post('numerological_numbers', { date: day, month, year, full_name: String(input.name || '').trim() });
}
async function getNumeroTable(input) {
  const { year, month, day } = parseDate(input.dob);
  return post('numero_table', { day, month, year, name: String(input.name || '').trim() });
}
function resultOf(settled) {
  return settled.status === 'fulfilled' ? { ok: true, data: settled.value } : { ok: false, error: settled.reason?.message || 'Unknown AstrologyAPI error' };
}

async function generateSourceBundle(input, { includePdfs = false } = {}) {
  const chartIds = ['D1', 'D9', 'D10'];
  const jobs = [
    getPlanets(input),
    getKpPlanets(input),
    getKpHouseCusps(input),
    getKpPlanetSignificators(input),
    getKpHouseSignificators(input),
    getCurrentVdasha(input),
    getCurrentVdashaAll(input),
    getNumerologicalNumbers(input),
    getNumeroTable(input),
    ...chartIds.map(id => getChartData(input, id)),
    ...chartIds.map(id => getChartImage(input, id))
  ];
  if (includePdfs) jobs.push(generateProHoroscopePdf(input), generateProNumerologyPdf(input));
  const settled = await Promise.allSettled(jobs);
  let index = 0;
  const bundle = {
    mode: getMode(),
    generated_at: new Date().toISOString(),
    planets: resultOf(settled[index++]),
    kp_planets: resultOf(settled[index++]),
    kp_house_cusps: resultOf(settled[index++]),
    kp_planet_significators: resultOf(settled[index++]),
    kp_house_significators: resultOf(settled[index++]),
    current_vdasha: resultOf(settled[index++]),
    current_vdasha_all: resultOf(settled[index++]),
    numerological_numbers: resultOf(settled[index++]),
    numero_table: resultOf(settled[index++]),
    charts: {},
    chart_images: {},
    pdfs: {}
  };
  chartIds.forEach(id => { bundle.charts[id] = resultOf(settled[index++]); });
  chartIds.forEach(id => { bundle.chart_images[id] = resultOf(settled[index++]); });
  if (includePdfs) {
    bundle.pdfs.pro_horoscope = resultOf(settled[index++]);
    bundle.pdfs.pro_numerology = resultOf(settled[index++]);
  }
  return bundle;
}

module.exports = {
  birthPayload,
  buildPdfPayload,
  generateProHoroscopePdf,
  generateProNumerologyPdf,
  generateSourceBundle,
  getChartData,
  getChartImage,
  getCurrentVdasha,
  getCurrentVdashaAll,
  getKpHouseCusps,
  getKpHouseSignificators,
  getKpPlanetSignificators,
  getKpPlanets,
  getMode,
  getNumeroTable,
  getNumerologicalNumbers,
  getPlanets,
  getTimezoneForBirth,
  normaliseBirthInput,
  post,
  searchLocations
};