const SCORING_VERSION = 'dominant-planets-v1';

const DASHA_WEIGHTS = Object.freeze({
  major: 5,
  minor: 4,
  sub_minor: 3,
  sub_sub_minor: 2,
  sub_sub_sub_minor: 1
});

const ASCENDANT_WEIGHTS = Object.freeze({
  sign_lord: 2,
  nakshatra_lord: 2,
  sub_lord: 3,
  sub_sub_lord: 1
});

const MOON_WEIGHTS = Object.freeze({
  nakshatra_lord: 2,
  sub_lord: 2,
  sub_sub_lord: 1
});

function normalisePlanet(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function resultData(result) {
  return result?.ok ? result.data : null;
}

function scoreEntry(map, planet) {
  const name = normalisePlanet(planet);
  if (!name) return null;
  if (!map.has(name)) map.set(name, { planet: name, score: 0, unique_houses: [], reasons: [] });
  return map.get(name);
}

function addScore(map, planet, points, reason) {
  const entry = scoreEntry(map, planet);
  if (!entry || !Number.isFinite(Number(points))) return;
  entry.score += Number(points);
  if (reason) entry.reasons.push(reason);
}

function findKpPlanet(rows, planet) {
  const target = normalisePlanet(planet);
  return (Array.isArray(rows) ? rows : []).find(row => normalisePlanet(row?.planet_name || row?.name) === target) || null;
}

function addSignificatorBreadth(map, rows) {
  (Array.isArray(rows) ? rows : []).forEach(row => {
    const planet = normalisePlanet(row?.planet_name || row?.name);
    const houses = [...new Set((Array.isArray(row?.significators) ? row.significators : [])
      .map(Number)
      .filter(house => Number.isInteger(house) && house >= 1 && house <= 12))]
      .sort((a, b) => a - b);
    if (!planet) return;
    const entry = scoreEntry(map, planet);
    entry.unique_houses = houses;
    addScore(map, planet, houses.length, `Signifies ${houses.length} unique houses: ${houses.join(', ') || 'none'}.`);
  });
}

function addDashaRoles(map, currentDasha) {
  Object.entries(DASHA_WEIGHTS).forEach(([level, weight]) => {
    const planet = currentDasha?.[level]?.planet;
    if (planet) addScore(map, planet, weight, `Current ${level} lord: +${weight}.`);
  });
}

function addLordLayers(map, kpPlanets) {
  const ascendant = findKpPlanet(kpPlanets, 'Ascendant');
  const moon = findKpPlanet(kpPlanets, 'Moon');
  Object.entries(ASCENDANT_WEIGHTS).forEach(([field, weight]) => {
    if (ascendant?.[field]) addScore(map, ascendant[field], weight, `Ascendant ${field}: +${weight}.`);
  });
  Object.entries(MOON_WEIGHTS).forEach(([field, weight]) => {
    if (moon?.[field]) addScore(map, moon[field], weight, `Moon ${field}: +${weight}.`);
  });
}

function scoreDominantPlanets(bundle, { limit = 3 } = {}) {
  const scores = new Map();
  addSignificatorBreadth(scores, resultData(bundle?.kp_planet_significators));
  addDashaRoles(scores, resultData(bundle?.current_vdasha) || {});
  addLordLayers(scores, resultData(bundle?.kp_planets));

  const ranking = [...scores.values()]
    .map(entry => ({ ...entry, score: Math.round(entry.score * 100) / 100 }))
    .sort((a, b) => b.score - a.score || a.planet.localeCompare(b.planet));

  return {
    version: SCORING_VERSION,
    dominant_planets: ranking.slice(0, Math.min(Math.max(Number(limit) || 3, 2), 4)),
    full_ranking: ranking
  };
}

function doubleConfirmation(dominantResult, deterministicNumerology) {
  const dominantSet = new Set((dominantResult?.dominant_planets || []).map(item => normalisePlanet(item.planet)));
  const numberPlanets = deterministicNumerology?.number_planets || {};
  const checks = [
    { number: 'Psychic Number', planet: normalisePlanet(numberPlanets.psychic) },
    { number: 'Destiny Number', planet: normalisePlanet(numberPlanets.destiny) },
    { number: 'Name Number', planet: normalisePlanet(numberPlanets.name) }
  ].map(item => ({ ...item, matches_dominant_chart: Boolean(item.planet && dominantSet.has(item.planet)) }));
  const score = checks.filter(item => item.matches_dominant_chart).length;
  const labels = { 3: 'Triple Confirmation', 2: 'Strong Agreement', 1: 'Partial Agreement', 0: 'Divergent Design' };
  return {
    score,
    total: 3,
    label: labels[score],
    checks,
    matched_planets: checks.filter(item => item.matches_dominant_chart).map(item => item.planet),
    outlier_planets: checks.filter(item => !item.matches_dominant_chart).map(item => item.planet),
    dominant_chart_planets: [...dominantSet]
  };
}

module.exports = { doubleConfirmation, normalisePlanet, scoreDominantPlanets };