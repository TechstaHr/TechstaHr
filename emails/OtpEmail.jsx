const React = require('react');

const OtpEmail = ({ full_name, otp }) =>
  React.createElement(
    'div',
    { style: { fontFamily: 'Arial, sans-serif', fontSize: 16, color: '#333', padding: '20px' } },
    React.createElement('p', null, `Hi ${full_name || 'User'} 👋,`),
    React.createElement('h1', { style: { color: '#0066cc' } }, 'Your Techstahr OTP Code'),
    React.createElement(
      'p',
      null,
      "Use the One-Time Password (OTP) below to verify your identity. This code is valid for 10 minutes."
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
      'If you did not request this OTP, please ignore this message or contact support immediately.'
    ),
    React.createElement(
      'p',
      { style: { marginTop: 30, fontSize: 12, color: '#999' } },
      '— The Techstahr Team'
    )
  );

module.exports = OtpEmail;