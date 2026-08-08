// ======================================================
// FAST2SMS OTP SENDER
//
// Uses Fast2SMS's built-in "OTP route", which sends from a
// pre-approved default template ("Your OTP: {#var#} ...")
// without needing your own DLT-registered template. This is
// the standard, quickest way to send OTP SMS in India.
//
// Docs: https://docs.fast2sms.com/ -> "Quick SMS" -> OTP route
// ======================================================

const sendOtpSms = async (phone, otp) => {
  const apiKey = process.env.FAST2SMS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "FAST2SMS_API_KEY is not configured in the environment"
    );
  }

  const url = new URL("https://www.fast2sms.com/dev/bulkV2");

  url.searchParams.set("authorization", apiKey);
  url.searchParams.set("route", "otp");
  url.searchParams.set("variables_values", otp);
  url.searchParams.set("numbers", phone);
  url.searchParams.set("flash", "0");

  const response = await fetch(url, {
    method: "GET",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.return) {
    const reason =
      data?.message?.join?.(", ") ||
      data?.message ||
      `SMS provider responded with status ${response.status}`;

    throw new Error(`Fast2SMS send failed: ${reason}`);
  }

  return data;
};

module.exports = sendOtpSms;
