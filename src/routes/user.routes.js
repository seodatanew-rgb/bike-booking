const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/user.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

// All user management routes are admin only
router.use(protect, restrictTo('admin'));

router.get ('/',               ctrl.getUsers);
router.get ('/:id',            ctrl.getUser);
router.patch('/:id/role',      ctrl.changeRole);
router.patch('/:id/toggle',    ctrl.toggleUser);
router.delete('/:id',          ctrl.deleteUser);

module.exports = router;
