const { Resend } = require("resend");

console.log("RESEND_API_KEY =", process.env.RESEND_API_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

class EmailService {
  async sendEmail({ to, subject, html }) {
    try {
      const response = await resend.emails.send({
        from: process.env.MAIL_FROM,
        to:'muthuaspu@gmail.com',
        subject,
        html,
      });

      return response;
    } catch (error) {
      console.error("Resend Email Error:", error);
      throw error;
    }
  }
}

module.exports = new EmailService();