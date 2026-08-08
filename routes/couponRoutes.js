const express = require("express");

const router = express.Router();

const {
  createCoupon,
  getCoupons,
  applyCoupon,
} = require("../controllers/couponController");

router.post("/", createCoupon);

router.get("/", getCoupons);

router.post("/apply", applyCoupon);

module.exports = router;