export class TwilioService {
  static async sendWhatsApp(toPhone: string, body: string): Promise<boolean> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886"; // Twilio sandbox number

    if (!accountSid || !authToken) {
      // In production we must not pretend a message was sent — fail honestly so
      // callers and monitoring see the misconfiguration. The console mock is a
      // local-dev convenience only.
      if (process.env.NODE_ENV === "production") {
        console.error("Twilio credentials missing in production; cannot send WhatsApp to", toPhone);
        return false;
      }
      console.warn("Twilio credentials missing. Mocking WhatsApp message to", toPhone);
      console.log(`[WHATSAPP TO ${toPhone}]: ${body}`);
      return true;
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const formattedTo = toPhone.startsWith("whatsapp:") ? toPhone : `whatsapp:${toPhone}`;

    const params = new URLSearchParams();
    params.append("To", formattedTo);
    params.append("From", fromPhone);
    params.append("Body", body);

    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      if (!res.ok) {
        const errData = await res.text();
        console.error("Twilio API Error:", errData);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Failed to send WhatsApp message:", err);
      return false;
    }
  }

  static async sendOtp(toPhone: string, code: string): Promise<boolean> {
    const body = `Your Ethree10 verification code is: ${code}`;
    return this.sendWhatsApp(toPhone, body);
  }
}
