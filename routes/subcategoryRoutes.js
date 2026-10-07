const express = require("express");

const router = express.Router();

const {
  protect,
  requireAdmin,
} = require("../middleware/authMiddleware");

const {
  createSubcategory,
  getAdminSubcategories,
  getFrontendSubcategories,
  updateSubcategory,
  toggleSubcategory,
  deleteSubcategory,
} = require("../controllers/subcategoryController");


// FRONTEND
router.get(
  "/frontend",
  getFrontendSubcategories
);


// ADMIN
router.get(
  "/",
  protect,
  requireAdmin,
  getAdminSubcategories
);


router.post(
  "/",
  protect,
  requireAdmin,
  createSubcategory
);


router.put(
  "/:id",
  protect,
  requireAdmin,
  updateSubcategory
);


router.patch(
  "/:id/toggle",
  protect,
  requireAdmin,
  toggleSubcategory
);


router.delete(
  "/:id",
  protect,
  requireAdmin,
  deleteSubcategory
);


module.exports = router;