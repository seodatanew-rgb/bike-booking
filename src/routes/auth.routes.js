const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/auth.controller');
const { protect }              = require('../middleware/auth.middleware');
const { validate, schemas }    = require('../middleware/validate.middleware');

router.post('/register', validate(schemas.register), ctrl.register);
router.post('/login',    validate(schemas.login),    ctrl.login);
router.post('/logout',   protect,                    ctrl.logout);
router.get ('/me',       protect,                    ctrl.getMe);
router.put ('/me',       protect,                    ctrl.updateMe);

module.exports = router;
