const { calcAllNumbers } = require('../services/numerology');

function clean(value) {
  return String(value || '').trim();
}

function assertIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date of birth must be YYYY-MM-DD');
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date of birth');
}

function buildFactLedger(input) {
  const customer = {
    name: clean(input.name),
    email: clean(input.email),
    phone: clean(input.phone),
    dob: clean(input.dob),
    tob: clean(input.tob),
    pob: clean(input.pob),
    concern: clean(input.question)
  };

  if (!customer.name) throw new Error('Full name is required');
  if (!customer.dob) throw new Error('Date of birth is required');
  assertIsoDate(customer.dob);

  const numerology = calcAllNumbers(customer.name, customer.dob);

  return {
    version: 'premium-v2-fact-ledger-1',
    created_at: new Date().toISOString(),
    customer,
    numerology,
    astrology: {
      verified: false,
      provider: null,
      dob: customer.dob,
      tob: customer.tob,
      pob: customer.pob,
      allowed_claims: [
        'Broad birth-detail context only',
        'No exact houses',
        'No exact dashas',
        'No exact planetary degrees',
        'No fixed event timing',
        'No fixed gemstone prescription'
      ]
    },
    immutable_facts: {
      ruling_number: numerology.ruling_number,
      destiny_number: numerology.destiny_number,
      name_number: numerology.name_number,
      personal_year: numerology.personal_year,
      lo_shu_counts: numerology.lo_shu_grid.counts,
      missing_numbers: numerology.lo_shu_grid.missing,
      repeated_numbers: numerology.lo_shu_grid.repeated,
      plane_analysis: numerology.plane_analysis
    }
  };
}

module.exports = { buildFactLedger };
