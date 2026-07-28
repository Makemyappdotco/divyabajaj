const { generateSourceBundle } = require('./astrologyApiV2');
const { calculateNumerology } = require('./numerologyEngine');
const { verifySourceBundle } = require('./reportVerification');
const { doubleConfirmation, scoreDominantPlanets } = require('./dominantPlanetScoring');

function resultSnapshot(result) {
  return result?.ok
    ? { ok: true, data: result.data }
    : { ok: false, error: String(result?.error || 'Source unavailable') };
}

function compactCharts(charts = {}) {
  return Object.fromEntries(
    Object.entries(charts).map(([chartId, result]) => [chartId, resultSnapshot(result)])
  );
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
    verification,
    deterministic_numerology: deterministicNumerology,
    dominant_planet_scoring: dominantPlanets,
    double_confirmation: doubleConfirmationResult,
    astrology: {
      planets: resultSnapshot(bundle.planets),
      kp_planets: resultSnapshot(bundle.kp_planets),
      kp_house_cusps: resultSnapshot(bundle.kp_house_cusps),
      kp_planet_significators: resultSnapshot(bundle.kp_planet_significators),
      kp_house_significators: resultSnapshot(bundle.kp_house_significators),
      current_vdasha: resultSnapshot(bundle.current_vdasha),
      current_vdasha_all: resultSnapshot(bundle.current_vdasha_all),
      charts: compactCharts(bundle.charts)
    },
    numerology_cross_check: {
      numerological_numbers: resultSnapshot(bundle.numerological_numbers),
      numero_table: resultSnapshot(bundle.numero_table)
    },
    transit: {
      available: false,
      note: 'A verified current-residence transit source is not yet connected. Transit confirmation and exact date-level timing are not claimed.'
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
  preparePersonalLifeBlueprintSource,
  resultSnapshot
};