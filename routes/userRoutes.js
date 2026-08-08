const express = require("express");
const router = express.Router();

const {
  completeProfile,
  getAllCustomers,
  deleteCustomer,
} = require("../controllers/userController");

const {
  protect,
  requireAdmin,
} = require("../middleware/authMiddleware");

router.post("/complete-profile", completeProfile);

router.get("/customers", protect, requireAdmin, getAllCustomers);

router.delete(
  "/customers/:id",
  protect,
  requireAdmin,
  deleteCustomer
);

module.exports = router;