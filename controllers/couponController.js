const Coupon = require("../models/Coupon");

exports.createCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.create(req.body);

    res.status(201).json({
      success: true,
      coupon,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message:
        error.code === 11000
          ? "Coupon code already exists"
          : "Coupon creation failed",
    });
  }
};

exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      coupons,
    });
  } catch (error) {
    console.error("Fetch coupons error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch coupons",
    });
  }
};

exports.applyCoupon = async (req, res) => {
  try {
    const { code, subtotal } = req.body;

    const orderSubtotal = Number(subtotal);

    if (!code || !orderSubtotal) {
      return res.status(400).json({
        success: false,
        message: "Coupon code and subtotal are required",
      });
    }

    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
    });

    if (!coupon) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon",
      });
    }

    const today = new Date();

    if (!coupon.isActive) {
      return res.status(400).json({
        success: false,
        message: "This coupon is inactive",
      });
    }

    if (coupon.startDate && today < coupon.startDate) {
      return res.status(400).json({
        success: false,
        message: "Coupon is not active yet",
      });
    }

    if (coupon.endDate && today > coupon.endDate) {
      coupon.isActive = false;
      await coupon.save();

      return res.status(400).json({
        success: false,
        message: "This coupon has expired",
      });
    }

    if (orderSubtotal < Number(coupon.minOrderAmount)) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount is ₹${coupon.minOrderAmount}`,
      });
    }

    let discount = 0;

    if (coupon.discountType === "percent") {
      discount =
        orderSubtotal *
        (Number(coupon.discountValue) / 100);
    } else {
      discount = Number(coupon.discountValue);
    }

    discount = Math.min(discount, orderSubtotal);

    const finalAmount = orderSubtotal - discount;

    res.json({
      success: true,
      couponCode: coupon.code,
      discount,
      finalAmount,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Coupon apply failed",
    });
  }
};