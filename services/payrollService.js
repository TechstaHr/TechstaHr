const AdminBalance = require('../models/AdminBalance');
const Payroll = require('../models/Payroll');
const axios = require('axios');

const processPayroll = async (payroll) => {
  try {
    if (payroll.status !== 'pending') return;

    payroll.status = 'processing';
    await payroll.save();

    const adminBalance = await AdminBalance.findOne();
    if (!adminBalance || adminBalance.balance < payroll.amount) {
      console.error(`Insufficient admin balance to process payroll ${payroll._id}`);
      payroll.status = 'failed';
      await payroll.save();
      return;
    }

    const response = await axios.post(
      process.env.PAYMENT_API_URL,
      {
        account_bank: payroll.bankCode,      
        account_number: payroll.accountNumber,
        amount: payroll.amount * 100,       
        narration: `Salary for employee ${payroll.employeeId}`,
        currency: 'NGN',
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYMENT_API_KEY}`,
        },
      }
    );

    const isSuccess =
      response.data &&
      (response.data.status === 'success' || response.data.data?.status === 'success');

    if (!isSuccess) {
      payroll.status = 'failed';
      await payroll.save();
      return;
    }

    adminBalance.balance -= payroll.amount;
    await adminBalance.save();

    payroll.status = 'completed';
    await payroll.save();

  } catch (error) {
    console.error(`Error processing payroll ${payroll._id}:`, error.message);
    payroll.status = 'failed';
    await payroll.save();
  }
};

const processPendingPayrolls = async () => {
  const pendingPayrolls = await Payroll.find({ status: 'pending' });
  for (const payroll of pendingPayrolls) {
    await processPayroll(payroll);
  }
};

module.exports = { processPendingPayrolls };
