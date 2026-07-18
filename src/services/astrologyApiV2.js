const brand = require('../config/divyaBrand');

const JSON_BASE_URL = 'https://json.astrologyapi.com/v1';
const PDF_BASE_URL = 'https://pdf.astrologyapi.com/v1';

function getMode() {
  return String(process.env.ASTROLOGYAPI_MODE || 'sandbox').toLowerCase();
}

function getToken({ pdf = false } = {}) {
  if (pdf && getMode() === 'sandbox') {
    const sandboxToken = process.env.ASTROLOGYAPI_PDF_SANDBOX_TOKEN;
    if (!sandboxToken) {
      throw new Error('ASTROLOGYAPI_PDF_SANDBOX_TOKEN is missing');
    }
    return sandboxToken;
  }

  const token = process.env.ASTROLOGYAPI_V2_ACCESS_TOKEN;
  if (!token) throw new Error('ASTROLOGYAPI_V2_ACCESS_TOKEN is missing');
  return token;
}

function parseDate(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Date of birth must use YYYY-MM-DD format');
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function parseTime(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error('Time of birth must use HH:MM format');
  const hour = Number(match[1]);
  const min = Number(match[2]);
  if (hour < 0 || hour > 23 || min < 0 || min > 59) {
    throw new Error('Time of birth is invalid');
  }
  return { hour, min };
}

function requiredNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} is required`);
  return number;
}

function normaliseGender(value) {
  const gender = String(value || '').trim().toLowerCase();
  if (!['male', 'female'].includes(gender)) {
    throw new Error('Gender must be male or female for AstrologyAPI');
  }
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
    if (error.name === 'AbortError') {
      throw new Error(`AstrologyAPI ${path} timed out after ${timeoutMs} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
  const result = await post('pro_horoscope_pdf', buildPdfPayload(input), {
    pdf: true,
    timeoutMs: 120000
  });
  if (!result?.status || !result?.pdf_url) {
    throw new Error('Professional Horoscope PDF response did not contain a PDF URL');
  }
  return result;
}

async function generateProNumerologyPdf(input) {
  const result = await post('pro_numerology_report', buildPdfPayload(input), {
    pdf: true,
    timeoutMs: 120000
  });
  if (!result?.status || !result?.pdf_url) {
    throw new Error('Pro Numerology PDF response did not contain a PDF URL');
  }
  return result;
}

async function getCurrentVdasha(input) {
  const birth = normaliseBirthInput(input);
  return post('current_vdasha', {
    day: birth.day,
    month: birth.month,
    year: birth.year,
    hour: birth.hour,
    min: birth.min,
    lat: birth.lat,
    lon: birth.lon,
    tzone: birth.tzone
  });
}

module.exports = {
  buildPdfPayload,
  generateProHoroscopePdf,
  generateProNumerologyPdf,
  getCurrentVdasha,
  getMode,
  normaliseBirthInput,
  post
};
