const User = require('../models/User');
const generateMembershipNumber = require('../utils/generateMembershipNumber');

// POST /api/membership/assign   (internal — called by the Django service after payment succeeds)
// body: { email }
async function assign(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    let user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      // Auto-create member record if not pre-created during signup
      user = await User.create({
        email: email.toLowerCase(),
        fullName: email.split('@')[0],
        passwordHash: '$2a$10$vNqS4F.G6.5QeJg8xK2r8u9/gq/2h2g1j.5QeJg8xK2r8u9/gq/2h2',
      });
    }

    // Idempotent: if this member already has a number, return it
    if (user.membershipNumber) {
      return res.json({
        email: user.email,
        membershipNumber: user.membershipNumber,
        membershipStatus: user.membershipStatus,
        alreadyAssigned: true,
      });
    }

    const membershipNumber = await generateMembershipNumber();
    user.membershipNumber = membershipNumber;
    user.membershipStatus = 'active';
    user.membershipAssignedAt = new Date();
    await user.save();

    return res.status(201).json({
      email: user.email,
      membershipNumber: user.membershipNumber,
      membershipStatus: user.membershipStatus,
      alreadyAssigned: false,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/membership/status/:email   (internal — Django can poll/check status)
async function status(req, res, next) {
  try {
    const user = await User.findOne({ where: { email: req.params.email.toLowerCase() } });
    if (!user) return res.status(404).json({ error: 'No account with that email' });

    return res.json({
      email: user.email,
      membershipNumber: user.membershipNumber,
      membershipStatus: user.membershipStatus,
      membershipAssignedAt: user.membershipAssignedAt,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/membership/verify/:membershipNumber   (public — e.g. verify a member at an event)
async function verify(req, res, next) {
  try {
    const user = await User.findOne({ where: { membershipNumber: req.params.membershipNumber } });
    if (!user || user.membershipStatus !== 'active') {
      return res.status(404).json({ valid: false });
    }

    return res.json({
      valid: true,
      fullName: user.fullName,
      membershipNumber: user.membershipNumber,
      memberSince: user.membershipAssignedAt,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { assign, status, verify };
