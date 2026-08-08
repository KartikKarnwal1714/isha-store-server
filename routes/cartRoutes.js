const express = require("express");
const router = express.Router();

const {
  addToCart,
  removeFromCart,
  clearUserCart,
} = require("../controllers/cartController");

router.post("/add", addToCart);
router.post("/remove", removeFromCart);
router.post("/clear", clearUserCart);

module.exports = router;