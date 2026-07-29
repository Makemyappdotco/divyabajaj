const { generateSourceBundle } = require('./astrologyApiV2');
const { calculateNumerology } = require('./numerologyEngine');
const { verifySourceBundle } = require('./reportVerification');
const { doubleConfirmation, scoreDominantPlanets } = require('./dominantPlanetScoring');

function resultSnapshot(result) {
  return result?.ok
    ? { ok: true, data: result.data }
    : { ok: false, error: String(result?.error || 'Source unavailable') };
}

function formatZodiacDegree(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  const normalised = ((numeric % 30) + 30) % 30;
  let degrees = Math.floor(normalised);
  let minutesFloat = (normalised - degrees) * 60;
  let minutes = Math.floor(minutesFloat);
  let seconds = Math.round((minutesFloat - minutes) * 60);
  if (seconds === 60) {
    seconds = 0;
    minutes += 1;
  }
  if (minutes === 60) {
    minutes = 0;
    degrees += 1;
  }
  return `${String(degrees).padStart(2, '0')}°${String(minutes).padStart(2, '0')}′${String(seconds).padStart(2, '0')}″`;
}

function compactKpPlanets(result) {
  if (!result?.ok) return resultSnapshot(result);
  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    ok: true,
    data: rows.map(row => ({
      planet_name: row.planet_name || row.name || '',
      sign: row.sign || '',
      house: row.house ?? null,
      display_position: [row.sign, formatZodiacDegree(row.norm_degree ?? row.normDegree ?? row.degree)].filter(Boolean).join(' '),
      norm_degree: row.norm_degree ?? row.normDegree ?? null,
      is_retro: Boolean(row.is_retro ?? row.isRetro),
      nakshatra: row.nakshatra || '',
      nakshatra_lord: row.nakshatra_lord || row.nakshatraLord || '',
      sub_lord: row.sub_lord || '',
      sub_sub_lord: row.sub_sub_lord || ''
    }))
  };
}

function compactKpCusps(result) {
  if (!result?.ok) return resultSnapshot(result);
  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    ok: true,
    data: rows.map(row => ({
      house_id: row.house_id ?? null,
      sign: row.sign || '',
      display_position: [row.sign, formatZodiacDegree(row.cusp_full_degree)].filter(Boolean).join(' '),
      cusp_full_degree: row.cusp_full_degree ?? null,
      sign_lord: row.sign_lord || '',
      nakshatra: row.nakshatra || '',
      nakshatra_lord: row.nakshatra_lord || '',
      sub_lord: row.sub_lord || '',
      sub_sub_lord: row.sub_sub_lord || ''
    }))
  };
}

function buildSourceContext({ input, bundle, deterministicNumerology, verification, dominantPlanets, doubleConfirmationResult, reportDate }) {
  return {
    input: {
      name: input.name,
      gender: input.gender,
      dob: input.dob,
      tob: input.tob,
      pob: input.pob,
      current_residence: input.current_residence || '',
      birth_time_accuracy: input.birth_time_accuracy || '',
      question: input.question || '',
      report_date: reportDate.toISOString()
    },
    source_generated_at: bundle.generated_at,
    provider_mode: bundle.mode,
    source_policy: {
      system: 'Nadi-KP event-oriented astrology',
      authoritative_house_source: 'KP planets, KP house cusps and KP significators',
      rule: 'Use KP house and significator fields as authoritative. Do not compare regular Vedic house placement with KP house placement as though it were a chart contradiction.'
    },
    verification,
    deterministic_numerology: deterministicNumerology,
    dominant_planet_scoring: dominantPlanets,
    double_confirmation: doubleConfirmationResult,
    astrology: {
      kp_planets: compactKpPlanets(bundle.kp_planets),
      kp_house_cusps: compactKpCusps(bundle.kp_house_cusps),
      kp_planet_significators: resultSnapshot(bundle.kp_planet_significators),
      kp_house_significators: resultSnapshot(bundle.kp_house_significators),
      current_vdasha: resultSnapshot(bundle.current_vdasha),
      current_vdasha_all: resultSnapshot(bundle.current_vdasha_all)
    },
    numerology_cross_check: {
      numerological_numbers: resultSnapshot(bundle.numerological_numbers),
      numero_table: resultSnapshot(bundle.numero_table)
    },
    transit: {
      available: false,
      note: 'A verified current-residence transit source and client-approved KP transit-confirmation rule are not yet connected. Exact date-level timing is not claimed.'
    }
  };
}

async function preparePersonalLifeBlueprintSource(input, { includePdfs = false, reportDate = new Date() } = {}) {
  const effectiveDate = reportDate instanceof Date ? reportDate : new Date(reportDate);
  if (Number.isNaN(effectiveDate.getTime())) throw new Error('Personal Life Blueprint report date is invalid');

  const bundle = await generateSourceBundle(input, { includePdfs });
  const deterministicNumerology = calculateNumerology({
    name: input.name,
    dob: input.dob,
    reportDate: effectiveDate
  });
  const verification = verifySourceBundle(bundle, deterministicNumerology, { reportDate: effectiveDate });
  const dominantPlanets = scoreDominantPlanets(bundle, { limit: 3 });
  const doubleConfirmationResult = doubleConfirmation(dominantPlanets, deterministicNumerology);
  const context = buildSourceContext({
    input,
    bundle,
    deterministicNumerology,
    verification,
    dominantPlanets,
    doubleConfirmationResult,
    reportDate: effectiveDate
  });

  return {
    context,
    raw_bundle: bundle,
    deterministic_numerology: deterministicNumerology,
    verification,
    dominant_planets: dominantPlanets,
    double_confirmation: doubleConfirmationResult,
    source_pdfs: bundle.pdfs || {}
  };
}

module.exports = {
  buildSourceContext,
  compactKpCusps,
  compactKpPlanets,
  formatZodiacDegree,
  preparePersonalLifeBlueprintSource,
  resultSnapshot
};