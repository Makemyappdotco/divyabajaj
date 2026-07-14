function normalizePremiumLayout(svg) {
  let output = String(svg || '');

  if (output.includes('RELATIONSHIPS  06')) {
    output = output.replace(/(<text x="61" y=")787("[^>]*>)/g, '$1763$2');
  }

  if (output.includes('YOUR THREE PLANES') && output.includes('HIDDEN PATTERNS  10')) {
    output = output
      .replace('<rect x="44" y="680" width="507" height="95"', '<rect x="44" y="665" width="507" height="115"')
      .replace(/(<text x="62" y=")702("[^>]*>YOUR THREE PLANES)/g, '$1690$2')
      .replace(/ y="726" /g, ' y="716" ')
      .replace(/ y="748" /g, ' y="738" ')
      .replace(/ y="768" /g, ' y="758" ')
      .replace(/font-size="6\.1"/g, 'font-size="6.8"');
  }

  if (output.includes('ACTION PLAN  12')) {
    output = output
      .replace('<rect x="44" y="730" width="507" height="50"', '<rect x="44" y="690" width="507" height="90"')
      .replace(/(<text x="62" y=")755("[^>]*><\/text>)/g, '$1715$2')
      .replace(/(<text x="62" y=")779("[^>]*>)/g, '$1738$2');
  }

  return output;
}

module.exports = { normalizePremiumLayout };
