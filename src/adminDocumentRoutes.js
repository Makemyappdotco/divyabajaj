const express = require('express');
const { signedDocumentUrl } = require('./services/reportArchive');

const router = express.Router();

router.get('/:id/download', async (req, res) => {
  try {
    const result = await signedDocumentUrl(req.params.id, 900);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.redirect(302, result.signed_url);
  } catch (error) {
    console.error('[Admin archived document download error]', error);
    return res.status(404).json({ success: false, error: error.message || 'Archived document not found' });
  }
});

router.get('/:id/url', async (req, res) => {
  try {
    const result = await signedDocumentUrl(req.params.id, 900);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({ success: true, document: result.document, signed_url: result.signed_url, expires_in: 900 });
  } catch (error) {
    console.error('[Admin archived document URL error]', error);
    return res.status(404).json({ success: false, error: error.message || 'Archived document not found' });
  }
});

module.exports = router;
