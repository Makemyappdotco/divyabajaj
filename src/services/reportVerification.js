const REQUIRED_DASHA_LEVELS = ['major', 'minor', 'sub_minor', 'sub_sub_minor', 'sub_sub_sub_minor'];

function okData(result) {
  return result?.ok ? result.data : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalisePlanetName(value) {
  return String(value || '').trim().toLowerCase();
}

function findPlanet(rows, wanted) {
  const target = normalisePlanetName(wanted);
  return asArray(rows).find(row =>
    normalisePlanetName(row.planet_name || row.name) === target
  ) || null;
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseAstrologyApiDate(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function periodContains(period, reportDate) {
  const start = parseAstrologyApiDate(period?.start);
  const end = parseAstrologyApiDate(period?.end);
  return Boolean(start && end && reportDate >= start && reportDate <= end);
}

function selectedPeriodFromAll(allData, level, reportDate) {
  const periods = asArray(allData?.[level]?.dasha_period);
  return periods.find(period => periodContains(period, reportDate)) || null;
}

function directCurrentPeriod(currentData, level) {
  const period = currentData?.[level];
  return period && typeof period === 'object' ? period : null;
}

function compareCurrentDasha(currentData, allData, reportDate) {
  const comparisons = {};
  const discrepancies = [];

  REQUIRED_DASHA_LEVELS.forEach(level => {
    const direct = directCurrentPeriod(currentData, level);
    const selected = selectedPeriodFromAll(allData, level, reportDate);
    const directPlanet = String(direct?.planet || '').trim();
    const selectedPlanet = String(selected?.planet || '').trim();
    const agrees = Boolean(directPlanet && selectedPlanet && directPlanet === selectedPlanet);

    comparisons[level] = {
      direct_planet: directPlanet || null,
      date_selected_planet: selectedPlanet || null,
      direct_start: direct?.start || null,
      direct_end: direct?.end || null,
      date_selected_start: selected?.start || null,
      date_selected_end: selected?.end || null,
      agrees
    };

    if (!direct) discrepancies.push(`DATA REQUIRED: current ${level} period is missing.`);
    else if (!selected) discrepancies.push(`DATA REQUIRED: ${level} Dasha table does not contain the report date.`);
    else if (!agrees) discrepancies.push(`CHART VERIFICATION REQUIRED: current ${level} is ${directPlanet || 'missing'}, but the date-selected table gives ${selectedPlanet || 'missing'}.`);
  });

  return { comparisons, discrepancies };
}

function findNestedNumber(source, candidateKeys) {
  if (!source || typeof source !== 'object') return null;
  const wanted = new Set(candidateKeys.map(key => key.toLowerCase()));
  const queue = [source];
  const visited = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);

    for (const [key, value] of Object.entries(current)) {
      if (wanted.has(key.toLowerCase())) {
        const parsed = numberValue(value);
        if (parsed !== null) return parsed;
      }
      if (value && typeof value === 'object') queue.push(value);
    }
  }
  return null;
}

function compareNumerology(deterministic, bundle) {
  const indian = okData(bundle?.numero_table) || {};
  const western = okData(bundle?.numerological_numbers) || {};
  const apiValues = {
    psychic_number: findNestedNumber(indian, ['radical_number', 'radical_num', 'psychic_number', 'driver_number']),
    destiny_number: findNestedNumber(indian, ['destiny_number', 'conductor_number']) ?? findNestedNumber(western, ['lifepath_number', 'life_path_number']),
    name_number: findNestedNumber(indian, ['name_number']) ?? findNestedNumber(western, ['expression_number'])
  };

  const comparison = {};
  const discrepancies = [];
  ['psychic_number', 'destiny_number', 'name_number'].forEach(key => {
    const backend = numberValue(deterministic?.[key]);
    const api = apiValues[key];
    const comparable = backend !== null && api !== null;
    const agrees = comparable ? backend === api : null;
    comparison[key] = { backend, astrologyapi: api, comparable, agrees };
    if (comparable && !agrees) {
      discrepancies.push(`NUMEROLOGY VERIFICATION REQUIRED: backend ${key} is ${backend}, while AstrologyAPI returns ${api}.`);
    }
  });

  return { comparison, discrepancies };
}

function verifySourceBundle(bundle, deterministicNumerology, { reportDate = new Date() } = {}) {
  const date = reportDate instanceof Date ? reportDate : new Date(reportDate);
  if (Number.isNaN(date.getTime())) throw new Error('Verification report date is invalid');

  const blockingIssues = [];
  const warnings = [];
  const regularPlanets = okData(bundle?.planets);
  const kpPlanets = okData(bundle?.kp_planets);
  const cusps = okData(bundle?.kp_house_cusps);
  const planetSignificators = okData(bundle?.kp_planet_significators);
  const houseSignificators = okData(bundle?.kp_house_significators);
  const currentDasha = okData(bundle?.current_vdasha);
  const allDasha = okData(bundle?.current_vdasha_all);

  const requiredSources = {
    kp_planets: Array.isArray(kpPlanets),
    kp_house_cusps: Array.isArray(cusps),
    kp_planet_significators: Array.isArray(planetSignificators),
    kp_house_significators: Array.isArray(houseSignificators),
    current_vdasha: Boolean(currentDasha),
    current_vdasha_all: Boolean(allDasha),
    deterministic_numerology: Boolean(deterministicNumerology)
  };

  Object.entries(requiredSources).forEach(([name, available]) => {
    if (!available) blockingIssues.push(`DATA REQUIRED: ${name} is unavailable.`);
  });

  const kpAscendant = findPlanet(kpPlanets, 'Ascendant');
  const kpMoon = findPlanet(kpPlanets, 'Moon');
  if (!kpAscendant) blockingIssues.push('DATA REQUIRED: Ascendant is missing from KP planets.');
  if (!kpMoon) blockingIssues.push('DATA REQUIRED: Moon is missing from KP planets.');

  if (Array.isArray(cusps) && cusps.length !== 12) {
    blockingIssues.push(`DATA REQUIRED: expected 12 KP house cusps, received ${cusps.length}.`);
  }
  if (Array.isArray(planetSignificators) && planetSignificators.length < 9) {
    warnings.push(`KP planet significators returned ${planetSignificators.length} rows; expected at least 9.`);
  }
  if (Array.isArray(houseSignificators) && houseSignificators.length !== 12) {
    warnings.push(`KP house significators returned ${houseSignificators.length} rows; expected 12.`);
  }

  const regularAscendant = findPlanet(regularPlanets, 'Ascendant');
  const regularMoon = findPlanet(regularPlanets, 'Moon');
  const regularAscDegree = numberValue(regularAscendant?.normDegree ?? regularAscendant?.norm_degree);
  const kpAscDegree = numberValue(kpAscendant?.norm_degree ?? kpAscendant?.normDegree);
  const ascendantDifference = regularAscDegree !== null && kpAscDegree !== null
    ? Math.abs(regularAscDegree - kpAscDegree)
    : null;

  if (ascendantDifference !== null && ascendantDifference > 0.05) {
    blockingIssues.push(`CHART VERIFICATION REQUIRED: regular and KP Ascendant degrees differ by ${ascendantDifference.toFixed(4)}°.`);
  }

  const regularMoonNakshatra = String(regularMoon?.nakshatra || '').trim();
  const kpMoonNakshatra = String(kpMoon?.nakshatra || '').trim();
  if (regularMoonNakshatra && kpMoonNakshatra && regularMoonNakshatra !== kpMoonNakshatra) {
    blockingIssues.push(`CHART VERIFICATION REQUIRED: regular Moon nakshatra is ${regularMoonNakshatra}, while KP gives ${kpMoonNakshatra}.`);
  }

  const dashaVerification = currentDasha && allDasha
    ? compareCurrentDasha(currentDasha, allDasha, date)
    : { comparisons: {}, discrepancies: [] };
  blockingIssues.push(...dashaVerification.discrepancies);

  const numerologyVerification = compareNumerology(deterministicNumerology, bundle);
  blockingIssues.push(...numerologyVerification.discrepancies);

  const facts = {
    report_date: date.toISOString(),
    ascendant: kpAscendant ? {
      degree: kpAscendant.degree ?? null,
      norm_degree: kpAscendant.norm_degree ?? kpAscendant.normDegree ?? null,
      formatted_degree: kpAscendant.formatted_degree || null,
      sign: kpAscendant.sign || null,
      sign_lord: kpAscendant.sign_lord || null,
      nakshatra: kpAscendant.nakshatra || null,
      nakshatra_lord: kpAscendant.nakshatra_lord || null,
      sub_lord: kpAscendant.sub_lord || null,
      sub_sub_lord: kpAscendant.sub_sub_lord || null
    } : null,
    moon: kpMoon ? {
      degree: kpMoon.degree ?? null,
      norm_degree: kpMoon.norm_degree ?? kpMoon.normDegree ?? null,
      formatted_degree: kpMoon.formatted_degree || null,
      sign: kpMoon.sign || null,
      nakshatra: kpMoon.nakshatra || null,
      nakshatra_lord: kpMoon.nakshatra_lord || null,
      sub_lord: kpMoon.sub_lord || null,
      sub_sub_lord: kpMoon.sub_sub_lord || null
    } : null,
    cusp_count: Array.isArray(cusps) ? cusps.length : 0,
    kp_planet_significator_count: Array.isArray(planetSignificators) ? planetSignificators.length : 0,
    kp_house_significator_count: Array.isArray(houseSignificators) ? houseSignificators.length : 0,
    dasha: dashaVerification.comparisons,
    numerology: numerologyVerification.comparison
  };

  return {
    ready_for_personal_life_blueprint: blockingIssues.length === 0,
    status: blockingIssues.length ? 'verification_required' : 'verified',
    required_sources: requiredSources,
    blocking_issues: blockingIssues,
    warnings,
    verified_facts: facts
  };
}

module.exports = {
  REQUIRED_DASHA_LEVELS,
  compareCurrentDasha,
  compareNumerology,
  parseAstrologyApiDate,
  verifySourceBundle
};