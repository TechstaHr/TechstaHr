const React = require('react');

const ProjectAssignedEmail = ({ full_name, projectName }) =>
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
    React.createElement('h2', { style: { color: '#0066cc' } }, 'You\'ve Been Assigned to a New Project!'),
    React.createElement(
      'p',
      null,
      `You've been added to the project "${projectName}". You can now collaborate with your team and start contributing.`
    ),
    React.createElement(
      'p',
      null,
      'Log in to your dashboard to view the project and assigned tasks.'
    ),
    React.createElement(
      'p',
      { style: { marginTop: 30, fontSize: 12, color: '#999' } },
      '— The Techstahr Team'
    )
  );

module.exports = ProjectAssignedEmail;