const React = require('react');

const DeadlineReminderEmail = ({ full_name, projectName, deadline }) =>
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
        React.createElement(
        'h2',
        { style: { color: '#cc3300' } },
        'Project Deadline Approaching!'
        ),
        React.createElement(
        'p',
        null,
        `This is a reminder that the deadline for the project "${projectName}" is on ${deadline}.`
        ),
        React.createElement(
        'p',
        null,
        'Please ensure all your assigned tasks are completed before the deadline.'
        ),
        React.createElement(
        'p',
        null,
        'Log in to your dashboard to review the project status and tasks.'
        ),
        React.createElement(
        'p',
        { style: { marginTop: 30, fontSize: 12, color: '#999' } },
        '— The Techstahr Team'
        )
    );

module.exports = DeadlineReminderEmail;