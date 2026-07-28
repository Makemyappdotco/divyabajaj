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

const PYTHAGOREAN_VALUES = Object.freeze({
  A: 1, J: 1, S: 1,
  B: 2, K: 2, T: 2,
  C: 3, L: 3, U: 3,
  D: 4, M: 4, V: 4,
  E: 5, N: 5, W: 5,
  F: 6, O: 6, X: 6,
  G: 7, P: 7, Y: 7,
  H: 8, Q: 8, Z: 8,
  I: 9, R: 9
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
  if (!letters.length) throw new Error('A name containing English letters is required for the Pythagorean Name Number');
  const values = letters.map(letter => PYTHAGOREAN_VALUES[letter]);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    number: reduceToSingleDigit(total),
    total,
    letters,
    values
  };
}

function calculateNumerology({ name, dob, reportDate = new Date() } = {}) {
  const { year, month, day } = parseDob(dob);
  const calculationDate = reportDate instanceof Date ? reportDate : new Date(reportDate);
  if (Number.isNaN(calculationDate.getTime())) throw new Error('Report date is invalid for Personal Year calculation');

  const currentYear = calculationDate.getUTCFullYear();
  const psychicRaw = day;
  const destinyDigits = `${String(day).padStart(2, '0')}${String(month).padStart(2, '0')}${year}`;
  const destinyRaw = digitSum(destinyDigits);
  const nameResult = calculateNameNumber(name);
  const reducedDay = reduceToSingleDigit(day);
  const reducedMonth = reduceToSingleDigit(month);
  const reducedYear = reduceToSingleDigit(digitSum(currentYear));
  const personalYearRaw = reducedDay + reducedMonth + reducedYear;

  const psychicNumber = reduceToSingleDigit(psychicRaw);
  const destinyNumber = reduceToSingleDigit(destinyRaw);
  const personalYear = reduceToSingleDigit(personalYearRaw);

  return {
    psychic_number: psychicNumber,
    destiny_number: destinyNumber,
    name_number: nameResult.number,
    personal_year: personalYear,
    number_planets: {
      psychic: NUMBER_PLANETS[psychicNumber],
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
        letters: nameResult.letters,
        values: nameResult.values,
        total: nameResult.total,
        reduced: nameResult.number
      },
      personal_year: {
        reduced_day: reducedDay,
        reduced_month: reducedMonth,
        current_year: currentYear,
        reduced_current_year: reducedYear,
        total: personalYearRaw,
        reduced: personalYear
      }
    }
  };
}

module.exports = {
  NUMBER_PLANETS,
  PYTHAGOREAN_VALUES,
  calculateNameNumber,
  calculateNumerology,
  digitSum,
  reduceToSingleDigit
};