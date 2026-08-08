const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: [
        "order_created",
        "order_confirmed",
        "order_processing",
        "order_packed",
        "order_shipped",
        "out_for_delivery",
        "order_delivered",
        "order_cancelled",
        "return_requested",
        "return_approved",
        "return_rejected",
        "refund_pending",
        "refund_completed",
        "low_stock",
        "general",
      ],
      default: "general",
    },

    recipientType: {
      type: String,
      enum: ["customer", "admin"],
      required: true,
      default: "admin",
    },

    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    link: {
      type: String,
      default: "",
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({
  recipientType: 1,
  recipientId: 1,
  isRead: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "Notification",
  notificationSchema
);