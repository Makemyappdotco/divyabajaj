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
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (error) {
      data = { raw };
    }

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

function locationScore(location, query) {
  const name = normaliseLocationText(location.place_name);
  const wanted = normaliseLocationText(query);
  let score = 0;

  if (name === wanted) score += 1000;
  else if (name.startsWith(wanted)) score += 300;
  else if (name.includes(wanted)) score += 100;

  // Divya's primary audience is India, but international birth locations remain available.
  if (location.country_code === 'IN') score += 80;
  if (location.timezone_id === 'Asia/Kolkata') score += 20;

  return score;
}

async function searchLocations(place, maxRows = 7) {
  const query = String(place || '').trim();
  if (query.length < 2) return [];

  const requestedRows = Math.min(Math.max(Number(maxRows) || 7, 1), 10);
  const result = await post('geo_details', { place: query, maxRows: '10' });
  const rows = Array.isArray(result?.geonames) ? result.geonames : [];

  return rows
    .map((row, index) => ({
      id: `${row.place_name || query}-${row.latitude}-${row.longitude}-${index}`,
      place_name: String(row.place_name || '').trim(),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      timezone_id: String(row.timezone_id || '').trim(),
      country_code: String(row.country_code || '').trim().toUpperCase()
    }))
    .filter(row => row.place_name && Number.isFinite(row.latitude) && Number.isFinite(row.longitude))
    .sort((a, b) => {
      const scoreDifference = locationScore(b, query) - locationScore(a, query);
      if (scoreDifference) return scoreDifference;
      return a.place_name.localeCompare(b.place_name);
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

async function getPlanets(input) {
  return post('planets', birthPayload(input));
}

async function getCurrentVdasha(input) {
  return post('current_vdasha', birthPayload(input));
}

async function getCurrentVdashaAll(input) {
  return post('current_vdasha_all', birthPayload(input));
}

async function getChartData(input, chartId = 'D1') {
  return post(`horo_chart/${encodeURIComponent(chartId)}`, {
    ...birthPayload(input),
    chartType: 'north',
    image_type: 'png'
  });
}

async function getChartImage(input, chartId = 'D1') {
  return post(`horo_chart_image/${encodeURIComponent(chartId)}`, {
    ...birthPayload(input),
    planetColor: '#171319',
    signColor: '#8B6A2E',
    lineColor: '#B8924F',
    chartType: 'north',
    image_type: 'svg'
  });
}

async function getNumerologicalNumbers(input) {
  const { year, month, day } = parseDate(input.dob);
  return post('numerological_numbers', {
    date: day,
    month,
    year,
    full_name: String(input.name || '').trim()
  });
}

async function getNumeroTable(input) {
  const { year, month, day } = parseDate(input.dob);
  return post('numero_table', {
    day,
    month,
    year,
    name: String(input.name || '').trim()
  });
}

function resultOf(settled) {
  return settled.status === 'fulfilled'
    ? { ok: true, data: settled.value }
    : { ok: false, error: settled.reason?.message || 'Unknown AstrologyAPI error' };
}

async function generateSourceBundle(input, { includePdfs = false } = {}) {
  const chartIds = ['D1', 'D9', 'D10'];
  const jobs = [
    getPlanets(input),
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
  getMode,
  getNumeroTable,
  getNumerologicalNumbers,
  getPlanets,
  getTimezoneForBirth,
  normaliseBirthInput,
  post,
  searchLocations
};
