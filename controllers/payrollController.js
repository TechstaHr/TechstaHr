const Payroll = require('../models/Payroll');
const { processPayroll } = require('../services/payrollService');

const addPayroll = async (req, res) => {
  try {
    const { employeeId, amount, bankId, accountNumber } = req.body;

    const payroll = await Payroll.create({
      employeeId,
      amount,
      bankId,
      accountNumber,
    });

    s
    await processPayroll(payroll);

    res.status(201).json({ message: 'Payroll added and processed', payroll });
  } catch (error) {
    console.error('Error adding payroll:', error.message);
    res.status(500).json({ message: 'Failed to add payroll' });
  }
};

module.exports = { addPayroll };
