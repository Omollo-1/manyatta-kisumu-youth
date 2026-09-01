const express = require('express');
const { assign, status, verify } = require('../controllers/membershipController');
const requireInternalKey = require('../middleware/internalKeyMiddleware');

const router = express.Router();

// Called by the Django service (server-to-server) after a payment succeeds.
router.post('/assign', requireInternalKey, assign);
router.get('/status/:email', requireInternalKey, status);

// Public: anyone can verify a membership number is real/active.
router.get('/verify/:membershipNumber', verify);

module.exports = router;
