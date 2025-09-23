const express = require('express');
const router = express.Router();
const integrationCtrl = require('../controllers/integrationController');

router.get('/', integrationCtrl.getAllIntegrations);
router.get('/:id', integrationCtrl.getIntegration);
router.post('/', integrationCtrl.createIntegration);
router.put('/:id', integrationCtrl.updateIntegration);
router.delete('/:id', integrationCtrl.deleteIntegration);

module.exports = router;