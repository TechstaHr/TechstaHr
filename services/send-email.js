const axios = require("axios");
require('dotenv').config();

const sendEmail = async (options) => {
  try {
    // Parse the 'from' option to extract address and name
    let fromAddress = process.env.ZEPTO_SENDER || "noreply@techstahr.com";
    let fromName = "Techstahr";
    
    if (options.from) {
      const fromMatch = options.from.match(/^(?:"([^"]+)"\s*)?<?([^>]+)>?$/);
      if (fromMatch) {
        fromName = fromMatch[1] || fromName;
        fromAddress = fromMatch[2] || fromAddress;
      }
    }

    let toRecipients = [];
    if (typeof options.to === 'string') {
      const toEmails = options.to.split(',').map(email => email.trim());
      toRecipients = toEmails.map(email => {
        const emailMatch = email.match(/^(?:"([^"]+)"\s*)?<?([^>]+)>?$/);
        if (emailMatch) {
          return {
            email_address: {
              address: emailMatch[2] || email,
              name: emailMatch[1] || emailMatch[2] || email
            }
          };
        }
        return {
          email_address: {
            address: email,
            name: email
          }
        };
      });
    } else if (Array.isArray(options.to)) {
      toRecipients = options.to.map(email => ({
        email_address: {
          address: email,
          name: email
        }
      }));
    }

    const payload = {
      from: {
        address: fromAddress,
        name: fromName
      },
      to: toRecipients,
      subject: options.subject,
      htmlbody: options.html,
      track_clicks: true,
      track_opens: true
    };

    // Add optional fields if provided
    if (options.cc) {
      payload.cc = Array.isArray(options.cc) 
        ? options.cc.map(email => ({ email_address: { address: email, name: email } }))
        : [{ email_address: { address: options.cc, name: options.cc } }];
    }

    if (options.reply_to || options.replyTo) {
      const replyTo = options.reply_to || options.replyTo;
      payload.reply_to = [{
        address: replyTo,
        name: replyTo
      }];
    }

    // Make the API request to Zepto Mail
    const response = await axios({
      method: 'POST',
      url: process.env.ZEPTO_API_URL || 'https://api.zeptomail.eu/v1.1/email',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': process.env.ZEPTO_API_KEY
      },
      data: payload
    });

    return response.data;
  } catch (error) {
    console.error('Zepto Mail API Error:', error.response?.data || error.message);
    throw new Error(`Failed to send email: ${error.response?.data?.message || error.message}`);
  }
};

module.exports = sendEmail;
