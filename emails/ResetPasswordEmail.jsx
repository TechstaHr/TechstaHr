const React = require('react');

const ResetPasswordEmail = ({ full_name, otp }) =>
  React.createElement(
    'div',
    {
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 16,
        color: '#333',
        padding: '20px',
        lineHeight: 1.5,
      },
    },
    React.createElement('p', null, `Hi ${full_name || 'User'} 👋,`),
    React.createElement('h2', { style: { color: '#0066cc' } }, 'Reset Your Password'),
    React.createElement(
      'p',
      null,
      'You requested to reset your password. Please use the OTP below to proceed. This code is valid for 10 minutes.'
    ),
    React.createElement(
      'p',
      {
        style: {
          fontSize: 28,
          fontWeight: 'bold',
          letterSpacing: 4,
          margin: '20px 0',
          padding: '10px 20px',
          display: 'inline-block',
          backgroundColor: '#f0f0f0',
          borderRadius: 6,
          color: '#000',
        },
      },
      otp
    ),
    React.createElement(
      'p',
      null,
      'If you did not request this OTP, please ignore this message or contact our support team.'
    ),
    React.createElement(
      'p',
      { style: { marginTop: 30, fontSize: 12, color: '#999' } },
      '— The Techstahr Team'
    )
  );

module.exports = ResetPasswordEmail;