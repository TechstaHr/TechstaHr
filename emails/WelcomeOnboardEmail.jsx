const React = require('react');

const WelcomeOnboardEmail = ({ full_name }) =>
  React.createElement(
    'div',
    { style: { fontFamily: 'Arial, sans-serif', fontSize: 16, color: '#333', padding: '20px' } },
    React.createElement('p', null, `Hi ${full_name || 'there'} 👋,`),
    React.createElement('h1', { style: { color: '#0066cc' } }, "Welcome to Techstahr! 🎉"),
    React.createElement(
      'p',
      null,
      `We're excited to have you on board! Your account has been successfully created.`
    ),
    React.createElement(
      'p',
      null,
      `Techstahr is your all-in-one platform for team productivity, time tracking, and project management. Here's what you can do:`
    ),
    React.createElement(
      'ul',
      { style: { lineHeight: 1.8 } },
      React.createElement('li', null, 'Track time and productivity'),
      React.createElement('li', null, 'Manage projects and tasks'),
      React.createElement('li', null, 'Collaborate with your team'),
      React.createElement('li', null, 'Monitor workloads and deadlines')
    ),
    React.createElement(
      'p',
      null,
      `Get started by logging into your account and exploring the platform.`
    ),
    React.createElement(
      'p',
      { style: { marginTop: 30 } },
      'If you have any questions, feel free to reach out to our support team.'
    ),
    React.createElement(
      'p',
      { style: { marginTop: 30, fontSize: 12, color: '#999' } },
      '— The Techstahr Team'
    )
  );

module.exports = WelcomeOnboardEmail;
