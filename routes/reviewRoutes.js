const express = require("express");
const router = express.Router();
const controller = require("../controllers/reviewController");
const { protect, requireAdmin } = require("../middleware/authMiddleware");

router.get("/product/:productId", controller.getProductReviews);
router.post("/", protect, controller.createReview);
router.put("/:id", protect, controller.updateReview);
router.delete("/:id", protect, controller.deleteReview);
router.post("/:id/helpful", protect, controller.toggleHelpful);

router.get("/admin/all", protect, requireAdmin, controller.getAllReviewsForAdmin);
router.patch("/admin/:id/status", protect, requireAdmin, controller.changeReviewStatus);

module.exports = router;
