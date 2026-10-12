const express = require('express');
const router  = express.Router();
const adminController = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/auth');

// All admin routes require authentication + admin role
router.use(protect);
router.use(restrictTo('admin'));

router.get('/stats',                    adminController.getStats);
router.get('/users',                    adminController.getUsers);
router.get('/listings',                 adminController.getListings);
router.get('/sellers/pending',          adminController.getPendingSellers);
router.get('/trust-integrity',          adminController.checkTrustIntegrity);
router.get('/activity',                 adminController.getActivity);
router.put('/users/:id/verify',         adminController.verifySeller);
router.put('/users/:id/suspend',        adminController.suspendUser);
router.put('/users/:id/role',           adminController.changeRole);
router.delete('/listings/:id',          adminController.removeListing);

module.exports = router;