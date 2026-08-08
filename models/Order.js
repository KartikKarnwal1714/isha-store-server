const mongoose = require("mongoose");

// ======================================================
// ORDER PRODUCT SCHEMA
// ======================================================

const orderProductSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
      default: "",
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    originalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    size: {
      type: String,
      default: "",
    },

    color: {
      type: String,
      default: "",
    },
  },
  {
    _id: true,
  }
);

// ======================================================
// ORDER STATUS HISTORY SCHEMA
// ======================================================

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      default: "",
    },

    updatedBy: {
      type: String,
      enum: ["customer", "admin", "system"],
      default: "system",
    },

    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);

// ======================================================
// ORDER SCHEMA
// ======================================================

const orderSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    customerPhone: {
      type: String,
      default: "",
      trim: true,
    },

    customerName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      default: "",
      trim: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    address: {
      house: {
        type: String,
        default: "",
      },

      city: {
        type: String,
        default: "",
      },

      state: {
        type: String,
        default: "",
      },

      pincode: {
        type: String,
        default: "",
      },

      landmark: {
        type: String,
        default: "",
      },
    },

    products: {
      type: [orderProductSchema],
      required: true,
      validate: {
        validator(products) {
          return Array.isArray(products) && products.length > 0;
        },
        message: "Order must contain at least one product",
      },
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    shipping: {
      type: Number,
      default: 0,
      min: 0,
    },

    tax: {
      type: Number,
      default: 0,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    couponCode: {
      type: String,
      default: "",
      trim: true,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["COD", "Online"],
      default: "COD",
    },

    paymentStatus: {
      type: String,
      enum: [
        "Pending",
        "Paid",
        "Failed",
        "Refund Pending",
        "Refunded",
      ],
      default: "Pending",
    },

    orderStatus: {
      type: String,

      enum: [
  "Pending",
  "Confirmed",
  "Processing",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled",

  "Return Requested",
  "Return Approved",
  "Return Rejected",
  "Returned",

  "Exchange Requested",
  "Exchange Approved",
  "Exchange Rejected",
  "Exchange Product Received",
  "Exchange Shipped",
  "Exchange Delivered",
],

      default: "Pending",
      index: true,
    },

    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },

    // ==================================================
    // CANCELLATION
    // ==================================================

    cancellationRequested: {
      type: Boolean,
      default: false,
    },

    cancellationReason: {
      type: String,
      default: "",
      trim: true,
    },

    cancelledBy: {
      type: String,
      enum: ["", "customer", "admin"],
      default: "",
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    stockRestoredAfterCancellation: {
      type: Boolean,
      default: false,
    },

    // ==================================================
    // RETURN
    // ==================================================

    returnRequested: {
      type: Boolean,
      default: false,
    },

    returnReason: {
      type: String,
      default: "",
      trim: true,
    },

    returnDescription: {
      type: String,
      default: "",
      trim: true,
    },

    returnRequestedAt: {
      type: Date,
      default: null,
    },

    returnApprovedAt: {
      type: Date,
      default: null,
    },

    returnRejectedAt: {
      type: Date,
      default: null,
    },

    returnCompletedAt: {
      type: Date,
      default: null,
    },

    returnAdminNote: {
      type: String,
      default: "",
      trim: true,
    },

    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    deliveredAt: {
  type: Date,
  default: null,
},

// ==========================================
// DELIVERY OTP
// ==========================================

deliveryOtp: {
  type: String,
  default: "",
},

deliveryOtpGeneratedAt: {
  type: Date,
  default: null,
},

deliveryOtpVerified: {
  type: Boolean,
  default: false,
},

deliveryOtpVerifiedAt: {
  type: Date,
  default: null,
},

// ==================================================
// SHIPPING DETAILS
// ==================================================

courierCompany: {
  type: String,
  default: "",
  trim: true,
},

trackingNumber: {
  type: String,
  default: "",
  trim: true,
},

trackingUrl: {
  type: String,
  default: "",
  trim: true,
},

shippedAt: {
  type: Date,
  default: null,
},

estimatedDelivery: {
  type: Date,
  default: null,
},

isRead: {
  type: Boolean,
  default: false,
},

    // ==================================================
    // EXCHANGE
    // ==================================================

    exchangeRequested: {
      type: Boolean,
      default: false,
    },

    exchangeReason: {
      type: String,
      default: "",
      trim: true,
    },

    exchangeDescription: {
      type: String,
      default: "",
      trim: true,
    },

    exchangeRequestedSize: {
      type: String,
      default: "",
    },

    exchangeRequestedColor: {
      type: String,
      default: "",
    },

    exchangeRequestedAt: {
      type: Date,
      default: null,
    },

    exchangeApprovedAt: {
      type: Date,
      default: null,
    },

    exchangeRejectedAt: {
      type: Date,
      default: null,
    },

    exchangeProductReceivedAt: {
      type: Date,
      default: null,
    },

    exchangeShippedAt: {
      type: Date,
      default: null,
    },

    exchangeDeliveredAt: {
      type: Date,
      default: null,
    },

    exchangeAdminNote: {
      type: String,
      default: "",
      trim: true,
    },

  },
  {
    timestamps: true,
  }
);

// ======================================================
// INITIAL TRACKING ENTRY
// ======================================================

orderSchema.pre("save", function () {
  if (this.isNew && this.statusHistory.length === 0) {
    this.statusHistory.push({
      status: this.orderStatus || "Pending",
      message: "Order placed successfully",
      updatedBy: "system",
      date: new Date(),
    });
  }
});

module.exports = mongoose.model("Order", orderSchema);