const express = require("express");

const router = express.Router();

const {
  createBrand,
  getBrands,
  deleteBrand,
} = require("../controllers/brandController");

router.post("/", createBrand);

router.get("/", getBrands);

router.delete("/:id", deleteBrand);

module.exports = router;