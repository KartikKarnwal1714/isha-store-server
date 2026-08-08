const jwt = require("jsonwebtoken");

// ======================================================
// VERIFY JWT TOKEN
// ======================================================

const protect = (req, res, next) => {
  try {
    const authorizationHeader =
      req.headers.authorization || "";

    if (
      !authorizationHeader.startsWith(
        "Bearer "
      )
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication token is required",
      });
    }

    const token =
      authorizationHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication token is required",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch (error) {
    console.error(
      "Authentication error:",
      error.message
    );

    if (
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Your session has expired. Please log in again.",
      });
    }

    return res.status(401).json({
      success: false,
      message:
        "Invalid authentication token",
    });
  }
};

// ======================================================
// ADMIN ONLY
// ======================================================

const requireAdmin = (
  req,
  res,
  next
) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message:
        "Admin permission is required",
    });
  }

  next();
};

// ======================================================
// CUSTOMER ONLY
// ======================================================

const requireCustomer = (
  req,
  res,
  next
) => {
  if (req.user?.role !== "customer") {
    return res.status(403).json({
      success: false,
      message:
        "Customer permission is required",
    });
  }

  next();
};

module.exports = {
  protect,
  requireAdmin,
  requireCustomer,
};