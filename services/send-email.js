const nodemailer = require("nodemailer");
require('dotenv').config();

const transport = nodemailer.createTransport({
  host: "smtp.zeptomail.com",
  port: 587,
  auth: {
    user: process.env.EMAIL_API_KEY,
    pass: process.env.PASS,
  },
});

const sendEmail = async (options) => {
  const mailOptions = {
    from: options.from || '"Techstahr" <noreply@mail.techstahr.waylc.org>',
    to: options.to,
    subject: options.subject,
    html: options.html,
  };

  return transport.sendMail(mailOptions);
};

module.exports = sendEmail;
