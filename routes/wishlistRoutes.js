const express = require("express");
const router = express.Router();

const {
  addToWishlist,
  removeFromWishlist,
} = require("../controllers/wishlistController");

router.post("/add", addToWishlist);

router.post("/remove", removeFromWishlist);

module.exports = router;