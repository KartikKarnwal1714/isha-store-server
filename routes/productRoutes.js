const express = require("express");

const router = express.Router();

const upload = require("../middleware/upload");

const multer = require("multer");

const excelUpload = multer({
  dest: "uploads/excel",
});

const {
  protect,
  requireAdmin,
} = require("../middleware/authMiddleware");

const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  dashboardAnalytics,
  importProductsExcel,
  trackProductView,
  getProductRecommendations,
  getCustomerRecommendations,
  getFrequentlyBoughtTogether,
} = require("../controllers/productController");


// CREATE PRODUCT
router.post(
  "/",
  protect,
  requireAdmin,
  upload.array("images", 20),
  createProduct
);

// GET ALL PRODUCTS
router.get(
  "/",
  getProducts
);

// DASHBOARD ANALYTICS
router.get(
  "/analytics/dashboard",
  dashboardAnalytics
);

// IMPORT PRODUCTS FROM EXCEL
router.post(
  "/import-excel",
  protect,
  requireAdmin,
  excelUpload.single("file"),
  importProductsExcel
);

// CUSTOMER PERSONALIZED RECOMMENDATIONS
router.get(
  "/recommendations/customer/:customerId",
  getCustomerRecommendations
);

// PRODUCT-BASED RECOMMENDATIONS
router.get(
  "/:productId/recommendations",
  getProductRecommendations
);

// CUSTOMERS ALSO BOUGHT
router.get(
  "/:productId/frequently-bought",
  getFrequentlyBoughtTogether
);

// TRACK PRODUCT VIEW
router.post(
  "/:productId/view",
  trackProductView
);

// GET SINGLE PRODUCT
router.get(
  "/:id",
  getProductById
);

// UPDATE PRODUCT
router.put(
  "/:id",
  protect,
  requireAdmin,
  upload.array("images", 20),
  updateProduct
);

// DELETE PRODUCT
router.delete(
  "/:id",
  protect,
  requireAdmin,
  deleteProduct
);

module.exports = router;