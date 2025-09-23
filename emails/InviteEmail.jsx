const React = require('react');

const InviteEmail = ({ full_name, inviteLink, invitedBy }) =>
  React.createElement(
    'div',
    { style: { fontFamily: 'Arial, sans-serif', fontSize: 16, color: '#333', padding: '20px' } },
    React.createElement('p', null, `Hi ${full_name || 'there'} 👋,`),
    React.createElement('h1', { style: { color: '#0066cc' } }, "You're Invited to Join Techstahr"),
    React.createElement(
      'p',
      null,
      `${invitedBy || 'Someone'} has invited you to join their team on Techstahr. Click the button below to accept the invitation and set up your account.`
    ),
    React.createElement(
      'a',
      {
        href: inviteLink,
        style: {
          display: 'inline-block',
          margin: '20px 0',
          padding: '12px 24px',
          backgroundColor: '#0066cc',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: 6,
          fontWeight: 'bold'
        }
      },
      'Accept Invitation'
    ),
    React.createElement(
      'p',
      null,
      'If you did not expect this invitation, you can safely ignore this email.'
    ),
    React.createElement(
      'p',
      { style: { marginTop: 30, fontSize: 12, color: '#999' } },
      '— The Techstahr Team'
    )
  );

module.exports = InviteEmail;