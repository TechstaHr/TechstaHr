const { Resend } = require("resend");
require("dotenv").config();

const resend = new Resend(process.env.RESEND_API_KEY);

const normalizeRecipients = (recipients) => {
  if (!recipients) return [];
  if (typeof recipients === "string") {
    return recipients.split(",").map((email) => email.trim()).filter(Boolean);
  }
  if (Array.isArray(recipients)) return recipients.filter(Boolean);
  return [];
};

const sendEmail = async (options) => {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    const from = "Techstahr <noreply@techstahr.com>";

    const to = normalizeRecipients(options.to);
    if (!to.length) {
      throw new Error("No recipients provided for email");
    }

    const payload = {
      from,
      to,
      subject: options.subject,
      html: options.html,
    };

    const cc = normalizeRecipients(options.cc);
    if (cc.length) payload.cc = cc;

    const bcc = normalizeRecipients(options.bcc);
    if (bcc.length) payload.bcc = bcc;

    const replyTo = options.reply_to || options.replyTo;
    if (replyTo) {
      const parsedReply = normalizeRecipients(replyTo);
      if (parsedReply.length) payload.reply_to = parsedReply;
    }

    const { data, error } = await resend.emails.send(payload);
    if (error) {
      throw new Error(error.message || "Resend email failed");
    }

    return data;
  } catch (error) {
    console.error("Resend Error:", error?.response?.data || error.message || error);
    throw new Error(
      `Failed to send email: ${
        error?.response?.data?.message || error.message || "Unknown error"
      }`
    );
  }
};

module.exports = sendEmail;
