// What counts as a usable birth detail.
//
// Lifted out of server.js so the test harness runs the SAME middleware the
// live site does. It was only mounted in server.js before, which meant the
// harness happily accepted a date of birth of "not-a-date" and every test
// passed while production would have rejected it. That is the same shape of
// mistake as the harness not enforcing NOT NULL, and it is worth not making
// twice.
//
// This runs BEFORE payment. Someone should never hand over money and then be
// told their time of birth is unreadable.

function cleanDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidName(value) {
  return /^[A-Za-zÀ-ž][A-Za-zÀ-ž .'’-]{1,79}$/.test(String(value || '').trim());
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

function isValidPhone(value) {
  const length = cleanDigits(value).length;
  return length >= 10 && length <= 15;
}

function isValidIsoDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900 && date <= new Date() &&
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidTime(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  return Boolean(match) && Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

// Mounted at /api, so req.path is relative to that.
const FREE_PATHS = ['/reports/free'];
const PAID_PATHS = ['/reports/paid-test-v2', '/reports/blueprint/checkout'];

function validateReportInput(req, res, next) {
  const isFree = FREE_PATHS.includes(req.path);
  const isPaid = PAID_PATHS.includes(req.path);
  if (!isFree && !isPaid) return next();

  const body = req.body || {};
  const errors = {};
  if (!isValidName(body.name)) errors.name = 'Enter a valid full name.';
  if (!isValidEmail(body.email)) errors.email = 'Enter a valid email address.';
  if (!isValidPhone(body.phone)) errors.phone = 'Enter a valid WhatsApp number with 10 to 15 digits.';
  if (!isValidIsoDate(body.dob)) errors.dob = 'Enter a valid date of birth.';

  if (isPaid) {
    if (!['male', 'female'].includes(String(body.gender || '').toLowerCase())) errors.gender = 'Select a valid gender.';
    if (!isValidTime(body.tob)) errors.tob = 'Enter a valid time of birth.';
    if (!['exact_record', 'family_confirmed', 'approximate'].includes(String(body.birth_time_accuracy || ''))) {
      errors.birth_time_accuracy = 'Select birth time accuracy.';
    }
    if (!String(body.pob || '').trim()) errors.pob = 'Select a valid birthplace.';
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const timezone = Number(body.timezone);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.latitude = 'Invalid birthplace latitude.';
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.longitude = 'Invalid birthplace longitude.';
    if (!Number.isFinite(timezone) || timezone < -14 || timezone > 14) errors.timezone = 'Invalid birthplace timezone.';
    if (String(body.question || '').trim().length < 5) errors.question = 'Add your main concern in a few words.';
  }

  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, error: 'Please correct the submitted information.', fields: errors });
  }
  return next();
}

module.exports = {
  validateReportInput, PAID_PATHS, FREE_PATHS,
  isValidName, isValidEmail, isValidPhone, isValidIsoDate, isValidTime
};
