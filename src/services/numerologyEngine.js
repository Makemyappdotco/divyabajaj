const NUMBER_PLANETS = Object.freeze({
  1: 'Sun',
  2: 'Moon',
  3: 'Jupiter',
  4: 'Rahu',
  5: 'Mercury',
  6: 'Venus',
  7: 'Ketu',
  8: 'Saturn',
  9: 'Mars'
});

const CHALDEAN_VALUES = Object.freeze({
  A: 1, I: 1, J: 1, Q: 1, Y: 1,
  B: 2, K: 2, R: 2,
  C: 3, G: 3, L: 3, S: 3,
  D: 4, M: 4, T: 4,
  E: 5, H: 5, N: 5, X: 5,
  U: 6, V: 6, W: 6,
  O: 7, Z: 7,
  F: 8, P: 8
});

function digitSum(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .split('')
    .filter(Boolean)
    .reduce((sum, digit) => sum + Number(digit), 0);
}

function reduceToSingleDigit(value) {
  let current = Math.abs(Number(value) || 0);
  while (current > 9) current = digitSum(current);
  return current;
}

function parseDob(dob) {
  const match = String(dob || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Date of birth must use YYYY-MM-DD format for numerology');

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!valid) throw new Error('Date of birth is invalid for numerology');

  return { year, month, day };
}

function calculateNameNumber(name) {
  const letters = String(name || '').toUpperCase().match(/[A-Z]/g) || [];
  if (!letters.length) throw new Error('A name containing English letters is required for the Chaldean Name Number');

  const values = letters.map(letter => CHALDEAN_VALUES[letter] || 0);
  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    method: 'Chaldean',
    number: reduceToSingleDigit(total),
    total,
    letters,
    values
  };
}

function calculatePersonalYear(day, month, year) {
  const raw = day + month + digitSum(year);
  return {
    year,
    raw,
    number: reduceToSingleDigit(raw)
  };
}

function calculateNumerology({ name, dob, reportDate = new Date() } = {}) {
  const { year, month, day } = parseDob(dob);
  const calculationDate = reportDate instanceof Date ? reportDate : new Date(reportDate);
  if (Number.isNaN(calculationDate.getTime())) throw new Error('Report date is invalid for Personal Year calculation');

  const currentYear = calculationDate.getUTCFullYear();
  const psychicNumber = reduceToSingleDigit(day);
  const destinyDigits = `${String(day).padStart(2, '0')}${String(month).padStart(2, '0')}${year}`;
  const destinyRaw = digitSum(destinyDigits);
  const destinyNumber = reduceToSingleDigit(destinyRaw);
  const nameResult = calculateNameNumber(name);
  const personalYears = Array.from({ length: 5 }, (_, index) => calculatePersonalYear(day, month, currentYear + index));
  const personalYear = personalYears[0].number;

  return {
    method: 'Chaldean numerology',
    psychic_number: psychicNumber,
    birth_number: psychicNumber,
    destiny_number: destinyNumber,
    name_number: nameResult.number,
    personal_year: personalYear,
    personal_years: personalYears.map(item => ({
      year: item.year,
      number: item.number,
      ruling_planet: NUMBER_PLANETS[item.number],
      working_total: item.raw
    })),
    number_planets: {
      psychic: NUMBER_PLANETS[psychicNumber],
      birth: NUMBER_PLANETS[psychicNumber],
      destiny: NUMBER_PLANETS[destinyNumber],
      name: NUMBER_PLANETS[nameResult.number],
      personal_year: NUMBER_PLANETS[personalYear]
    },
    calculation_date: calculationDate.toISOString().slice(0, 10),
    working: {
      psychic: {
        input_day: day,
        reduced: psychicNumber
      },
      destiny: {
        digits: destinyDigits.split('').map(Number),
        total: destinyRaw,
        reduced: destinyNumber
      },
      name: {
        method: nameResult.method,
        letters: nameResult.letters,
        values: nameResult.values,
        total: nameResult.total,
        reduced: nameResult.number
      },
      personal_year: {
        input_day: day,
        input_month: month,
        current_year: currentYear,
        year_digit_sum: digitSum(currentYear),
        total: personalYears[0].raw,
        reduced: personalYear
      }
    }
  };
}

module.exports = {
  NUMBER_PLANETS,
  CHALDEAN_VALUES,
  calculateNameNumber,
  calculateNumerology,
  digitSum,
  reduceToSingleDigit
};
