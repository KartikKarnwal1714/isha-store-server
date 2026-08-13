const express = require("express");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Otp = require("../models/Otp");
const sendOtpSms = require("../utils/sendOtpSms");

const {
  protect,
  requireAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ======================================================
// TOKEN HELPER
// ======================================================

const createToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

// ======================================================
// ADMIN LOGIN
// POST /api/auth/admin-login
// ======================================================

router.post(
  "/admin-login",
  async (req, res) => {
    try {
      const email = String(
        req.body.email || ""
      )
        .trim()
        .toLowerCase();

      const password = String(
        req.body.password || ""
      );

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message:
            "Email and password are required",
        });
      }

      const configuredEmail = String(
        process.env.ADMIN_EMAIL || ""
      )
        .trim()
        .toLowerCase();

      const configuredPassword = String(
        process.env.ADMIN_PASSWORD || ""
      );

      if (
        email !== configuredEmail ||
        password !== configuredPassword
      ) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid email or password",
        });
      }

      const token = createToken({
        role: "admin",
        email,
      });

      return res.status(200).json({
        success: true,
        message:
          "Admin login successful",

        token,

        admin: {
          email,
          role: "admin",
        },
      });
    } catch (error) {
      console.error(
        "Admin login error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Admin login failed",
      });
    }
  }
);

// ======================================================
// VERIFY ADMIN PASSWORD (for sensitive re-confirmation steps
// like "Delete All Products")
// POST /api/auth/verify-admin-password
// body: { password }
// Requires the admin to already be logged in (valid token) -
// this just re-checks the password, it does not issue a new
// token.
// ======================================================

router.post(
  "/verify-admin-password",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const password = String(
        req.body.password || ""
      );

      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Password is required",
        });
      }

      const configuredPassword = String(
        process.env.ADMIN_PASSWORD || ""
      );

      if (password !== configuredPassword) {
        return res.status(401).json({
          success: false,
          message: "Incorrect password",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Password verified",
      });
    } catch (error) {
      console.error(
        "Verify admin password error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Password verification failed",
      });
    }
  }
);

// ======================================================
// FIND OR CREATE A CUSTOMER ACCOUNT FOR A PHONE NUMBER
// Shared by /customer-login and /verify-otp
// ======================================================

const findOrCreateCustomer = async ({ phone, name, email }) => {
  let customer = await User.findOne({ phone });
  let isNewCustomer = false;

  if (!customer) {
    customer = await User.create({
      phone,
      name,
      email,
      isProfileComplete: Boolean(name && email),
    });

    isNewCustomer = true;
  } else {
    let changed = false;

    if (name && !customer.name) {
      customer.name = name;
      changed = true;
    }

    if (email && !customer.email) {
      customer.email = email;
      changed = true;
    }

    if (
      customer.name &&
      customer.email &&
      !customer.isProfileComplete
    ) {
      customer.isProfileComplete = true;
      changed = true;
    }

    if (changed) {
      await customer.save();
    }
  }

  return { customer, isNewCustomer };
};

const buildCustomerLoginResponse = (customer, isNewCustomer) => {
  const token = createToken({
    userId: customer._id,
    role: "customer",
    phone: customer.phone,
  });

  return {
    success: true,
    message: isNewCustomer
      ? "Customer account created"
      : "Customer login successful",
    token,
    customer: {
      _id: customer._id,
      phone: customer.phone,
      name: customer.name,
      email: customer.email,
      addresses: customer.addresses || [],
      isProfileComplete: customer.isProfileComplete,
      role: "customer",
    },
  };
};

// ======================================================
// SEND OTP
// POST /api/auth/send-otp
// body: { phone }
//
// If the phone matches OTP_TEST_PHONE in .env, no real SMS
// is sent — it always "succeeds" and the OTP to use is
// OTP_TEST_CODE, so you can log in during development
// without spending Fast2SMS credits.
// ======================================================

router.post("/send-otp", async (req, res) => {
  try {
    const phone = String(req.body.phone || "")
      .replace(/\D/g, "")
      .trim();

    if (phone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit phone number",
      });
    }

    const testPhone = String(process.env.OTP_TEST_PHONE || "").trim();

    if (testPhone && phone === testPhone) {
      return res.status(200).json({
        success: true,
        message: "Test OTP is ready to use",
        testMode: true,
      });
    }

    const otp = String(
      Math.floor(100000 + Math.random() * 900000)
    );

    const expiryMinutes = Number(
      process.env.OTP_EXPIRY_MINUTES || 5
    );

    const expiresAt = new Date(
      Date.now() + expiryMinutes * 60 * 1000
    );

    await Otp.findOneAndUpdate(
      { phone },
      { phone, code: otp, attempts: 0, expiresAt },
      { upsert: true, new: true }
    );

    await sendOtpSms(phone, otp);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("Send OTP error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "OTP could not be sent. Please try again.",
    });
  }
});

// ======================================================
// VERIFY OTP AND LOG IN / REGISTER
// POST /api/auth/verify-otp
// body: { phone, otp, name?, email? }
// ======================================================

router.post("/verify-otp", async (req, res) => {
  try {
    const phone = String(req.body.phone || "")
      .replace(/\D/g, "")
      .trim();

    const otp = String(req.body.otp || "").trim();

    const name = String(req.body.name || "").trim();

    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    if (phone.length !== 10 || otp.length !== 6) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid phone number and OTP",
      });
    }

    const testPhone = String(process.env.OTP_TEST_PHONE || "").trim();
    const testCode = String(process.env.OTP_TEST_CODE || "").trim();

    if (testPhone && phone === testPhone) {
      if (otp !== testCode) {
        return res.status(401).json({
          success: false,
          message: "Incorrect OTP",
        });
      }
    } else {
      const otpRecord = await Otp.findOne({ phone });

      if (!otpRecord) {
        return res.status(400).json({
          success: false,
          message: "Please request a new OTP",
        });
      }

      if (otpRecord.expiresAt < new Date()) {
        await Otp.deleteOne({ _id: otpRecord._id });

        return res.status(400).json({
          success: false,
          message: "OTP has expired. Please request a new one.",
        });
      }

      if (otpRecord.attempts >= 5) {
        await Otp.deleteOne({ _id: otpRecord._id });

        return res.status(429).json({
          success: false,
          message: "Too many incorrect attempts. Please request a new OTP.",
        });
      }

      if (otpRecord.code !== otp) {
        otpRecord.attempts += 1;
        await otpRecord.save();

        return res.status(401).json({
          success: false,
          message: "Incorrect OTP",
        });
      }

      await Otp.deleteOne({ _id: otpRecord._id });
    }

    const { customer, isNewCustomer } = await findOrCreateCustomer({
      phone,
      name,
      email,
    });

    return res.status(200).json(
      buildCustomerLoginResponse(customer, isNewCustomer)
    );
  } catch (error) {
    console.error("Verify OTP error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "OTP verification failed",
    });
  }
});

// ======================================================
// CUSTOMER LOGIN OR REGISTER BY PHONE
// (kept for backward compatibility — does not require OTP)
// POST /api/auth/customer-login
// ======================================================

router.post(
  "/customer-login",
  async (req, res) => {
    try {
      const phone = String(
        req.body.phone || ""
      )
        .replace(/\D/g, "")
        .trim();

      const name = String(
        req.body.name || ""
      ).trim();

      const email = String(
        req.body.email || ""
      )
        .trim()
        .toLowerCase();

      if (
        phone.length < 10 ||
        phone.length > 15
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please enter a valid phone number",
        });
      }

      const { customer, isNewCustomer } =
        await findOrCreateCustomer({ phone, name, email });

      return res
        .status(200)
        .json(buildCustomerLoginResponse(customer, isNewCustomer));
    } catch (error) {
      console.error(
        "Customer login error:",
        error
      );

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message:
            "An account already exists with this phone number",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Customer login failed",
      });
    }
  }
);

// ======================================================
// GET CURRENT AUTHENTICATED USER
// GET /api/auth/me
// ======================================================

router.get(
  "/me",
  protect,
  async (req, res) => {
    try {
      if (req.user.role === "admin") {
        return res.status(200).json({
          success: true,

          user: {
            email: req.user.email,
            role: "admin",
          },
        });
      }

      const customer =
        await User.findById(
          req.user.userId
        ).select(
          "name phone email addresses isProfileComplete"
        );

      if (!customer) {
        return res.status(404).json({
          success: false,
          message:
            "Customer account not found",
        });
      }

      return res.status(200).json({
        success: true,

        user: {
          _id: customer._id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          addresses:
            customer.addresses || [],
          isProfileComplete:
            customer.isProfileComplete,
          role: "customer",
        },
      });
    } catch (error) {
      console.error(
        "Get authenticated user error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Authenticated user could not be loaded",
      });
    }
  }
);

module.exports = router;