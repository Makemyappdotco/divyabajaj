const publicPaidRoutes = require('../publicPaidRoutes');
const { generateApprovedPaidPdfV4 } = require('./pdfApprovedV4AssetBridge');

let applied = false;

function parseReportJson(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string' && value.trim()) {
    try { return JSON.parse(value); } catch (error) { return null; }
  }
  return null;
}

function safeFileName(value) {
  return String(value || 'Divya-Bajaj')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '') || 'Divya-Bajaj';
}

function qaReportJson() {
  const life = {
    intro: 'QA intro.',
    birth_chart: 'QA chart signal.',
    numbers: 'QA number signal.',
    convergence: 'QA convergence.',
    tension_or_silence: 'QA mixed signal.',
    timing: ['QA timing.'],
    actions: ['QA action.'],
    confidence: 'High'
  };
  return {
    primer: {
      purpose: 'QA purpose.',
      systems: 'Nadi Astrology and Vedic Numerology.',
      four_ideas: { houses: 'QA.', planets: 'QA.', dasha: 'QA.', chain_of_command: 'QA.' },
      convergence_method: 'QA convergence method.',
      limits: ['QA limitation.'],
      disclaimer: 'QA disclaimer.'
    },
    glance: {
      headline_finding: 'QA headline finding.',
      astrology: [{ element: 'Ascendant', position: 'Virgo', plain_meaning: 'QA meaning.' }],
      numerology: [{ label: 'Birth Number', value: '6', derived_from: 'DOB', plain_meaning: 'QA meaning.' }]
    },
    life_areas: {
      personal_nature: life,
      past_life_karma: life,
      finances: life,
      marriage: life,
      health: life,
      children: life,
      property: life
    },
    remedies: {
      intro: 'QA remedies.',
      behavioural: [],
      professional_structural: ['QA structural action.'],
      traditional_observance: [],
      gemstone_note: 'No gemstone recommendation in QA.'
    },
    timing_map: [{ period: '2026', astrology: 'QA', numerology: 'QA', combined_reading: 'QA combined.', confidence: 'High' }],
    closing_summary: ['QA closing point.'],
    scope_limitations: ['QA scope limitation.']
  };
}

module.exports = function applyFinalPaidPdfV4Patch() {
  if (applied) return;

  const layer = (publicPaidRoutes.stack || []).find(item =>
    item.route && item.route.path === '/reports/pdf-direct' && item.route.methods && item.route.methods.post
  );

  if (!layer || !layer.route || !Array.isArray(layer.route.stack) || !layer.route.stack[0]) {
    throw new Error('Could not locate the paid PDF download route for approved V4 patching');
  }

  const originalHandler = layer.route.stack[0].handle;

  layer.route.stack[0].handle = async function approvedPaidPdfV4Handler(req, res, next) {
    const reportJson = parseReportJson(req.body && req.body.report_json);
    if (!reportJson) return originalHandler(req, res, next);

    try {
      const lead = (req.body && req.body.lead) || {};
      if (!String(lead.name || '').trim()) {
        return res.status(400).json({ success: false, error: 'Client name is required for PDF generation' });
      }

      const pdfBuffer = await generateApprovedPaidPdfV4({ lead, reportJson });
      const filename = `${safeFileName(lead.name)}-Integrated-Life-Report.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(pdfBuffer.length));
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('X-Divya-PDF-Template', 'approved-v4-hq');
      return res.end(pdfBuffer);
    } catch (error) {
      console.error('[Approved V4 paid PDF error]', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Could not generate the approved paid report PDF'
      });
    }
  };

  if (process.env.VERCEL_ENV !== 'production') {
    publicPaidRoutes.get('/reports/pdf-v4-selftest', async (req, res) => {
      try {
        const pdfBuffer = await generateApprovedPaidPdfV4({
          lead: { name: 'V4 QA Test', dob: '1994-08-23', tob: '07:35', pob: 'Delhi, India', question: 'career' },
          reportJson: qaReportJson()
        });
        return res.json({ success: true, bytes: pdfBuffer.length, template: 'approved-v4-hq' });
      } catch (error) {
        console.error('[Approved V4 self-test error]', error);
        return res.status(500).json({ success: false, error: error.message });
      }
    });
  }

  applied = true;
};
