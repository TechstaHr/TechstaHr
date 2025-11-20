const sendEmail = require('../utils/emailService');
const User = require('../models/User');

const inviteUser = async (req, res) => {
  try {
    const { email, role } = req.body;

    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    
    const defaultPassword = '0000000';
    const newUser = await User.create({
      email,
      role,
      password: defaultPassword,
      isActive: false,
    });

    
    const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${newUser._id}`;
    const subject = 'You are invited!';
    const html = `
      <p>You have been invited to join our platform.</p>
      <p>Your default password is: <strong>${defaultPassword}</strong></p>
      <p>For security reasons, you will be required to reset your password upon login.</p>
      <p>Click <a href="${inviteLink}">here</a> to accept the invitation and complete your registration.</p>
    `;

    await sendEmail({ to: email, subject, html });

    return res.status(200).json({ message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Error inviting user:', error.message);
    return res.status(500).json({ message: 'Failed to send invitation' });
  }
};

module.exports = { inviteUser };
