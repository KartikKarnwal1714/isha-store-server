const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Notification = require("../models/Notification");
const User = require("../models/User");
const generateInvoice =
  require("../utils/generateInvoice");

const router = express.Router();
const {
  protect,
  requireAdmin,
  requireCustomer,
} = require("../middleware/authMiddleware");



// ======================================================
// HELPER: RESTORE PRODUCT STOCK
// ======================================================

const restoreOrderStock = async (order) => {
  if (order.stockRestoredAfterCancellation) {
    return;
  }

  for (const item of order.products) {
    const product = await Product.findById(item.productId);

    if (!product) {
      continue;
    }

    const color = product.colors.find(
      (colorItem) =>
        String(colorItem.colorName).toLowerCase() ===
        String(item.color).toLowerCase()
    );

    if (!color) {
      continue;
    }

    const size = color.sizes.find(
      (sizeItem) =>
        String(sizeItem.size).toLowerCase() ===
        String(item.size).toLowerCase()
    );

    if (!size) {
      continue;
    }

    size.stock =
      Number(size.stock || 0) +
      Number(item.quantity || 0);

    await product.save();
  }

  order.stockRestoredAfterCancellation = true;
};


// CREATE ORDER WITH STOCK CHECK
router.post("/create", async (req, res) => {
  try {
    const { products, customerId } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No products in order",
      });
    }

    // STEP 1: CHECK STOCK
    for (const item of products) {
      const product = await Product.findById(item.productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `${item.name} not found`,
        });
      }

      const color = product.colors.find(
        (c) => c.colorName === item.color
      );

      if (!color) {
        return res.status(400).json({
          success: false,
          message: `${item.name} color not found`,
        });
      }

      const size = color.sizes.find(
        (s) => s.size === item.size
      );

      if (!size) {
        return res.status(400).json({
          success: false,
          message: `${item.name} size not found`,
        });
      }

      if (Number(size.stock) <= 0) {
        return res.status(400).json({
          success: false,
          message: `${item.name} (${item.size}) is Out Of Stock. Order cannot be placed.`,
        });
      }

      if (Number(size.stock) < Number(item.quantity)) {
        return res.status(400).json({
          success: false,
          message: `Only ${size.stock} item(s) available for ${item.name}. Order cannot be placed.`,
        });
      }
    }

    // STEP 2: REDUCE STOCK
    for (const item of products) {
      const product = await Product.findById(item.productId);

      const color = product.colors.find(
        (c) => c.colorName === item.color
      );

      const size = color.sizes.find(
        (s) => s.size === item.size
      );

      size.stock =
        Number(size.stock) -
        Number(item.quantity);

      await product.save();
    }

    // STEP 3: CREATE ORDER
    const order = await Order.create({
  ...req.body,

  orderStatus: "Pending",

  statusHistory: [
    {
      status: "Pending",
      message: "Order placed successfully",
      updatedBy: "system",
      date: new Date(),
    },
  ],
});

    // STEP 4: SAVE ORDER IN USER + CLEAR USER CART
    if (customerId) {
      await User.findByIdAndUpdate(customerId, {
        $push: {
          orders: order._id,
        },
        $set: {
          cart: [],
        },
      });
    }

    // STEP 5: CREATE NOTIFICATION
    const adminNotification =
  await Notification.create({
    title: "New Order",
    message: `${order.customerName} placed an order worth ₹${order.total}`,
    type: "order_created",
    recipientType: "admin",
    recipientId: null,
    orderId: order._id,
    link: `/orders/${order._id}`,
  });

const customerNotification =
  await Notification.create({
    title: "Order Placed",
    message: `Your order #${String(order._id)
      .slice(-6)
      .toUpperCase()} has been placed successfully.`,
    type: "order_created",
    recipientType: "customer",
    recipientId: order.customerId,
    orderId: order._id,
    link: "/current-orders",
  });

const io = req.app.get("io");

if (io) {
  io.emit("adminNotification", adminNotification);

  io.emit(
    `customerNotification:${String(
      order.customerId
    )}`,
    customerNotification
  );
}

    return res.status(201).json({
      success: true,
      message: "Order Created Successfully",
      order,
    });
  } catch (error) {
    console.error("Create order error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Order could not be created",
    });
  }
});

// ======================================================
// DOWNLOAD ORDER INVOICE
// GET /api/orders/:id/invoice
// ======================================================

router.get(
  "/:id/invoice",
  protect,
  async (req, res) => {
    try {
      const order =
        await Order.findById(
          req.params.id
        ).lean();

      if (!order) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found",
        });
      }

      if (
        req.user.role === "customer" &&
        String(order.customerId) !==
          String(req.user.userId)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You are not allowed to download this invoice",
        });
      }

      if (
        ![
          "customer",
          "admin",
        ].includes(req.user.role)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to download this invoice",
        });
      }

      return generateInvoice(
        order,
        res
      );
    } catch (error) {
      console.error(
        "Invoice generation error:",
        error
      );

      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          message:
            error.message ||
            "Invoice could not be generated",
        });
      }
    }
  }
);

// GET CUSTOMER ORDERS
router.get(
  "/my-orders/:customerId",
  protect,
  requireCustomer,
  async (req, res) => {
    try {
      if (
        String(req.user.userId) !==
        String(req.params.customerId)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You cannot view another customer's orders",
        });
      }

      const orders = await Order.find({
        customerId:
          req.params.customerId,
      });

      // remaining existing code

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
);

// ======================================================
// CUSTOMER CANCEL ORDER
// ======================================================

router.put(
  "/cancel/:id",
  protect,
  requireCustomer,
  async (req, res) => {
  try {
    const {
  customerId,
  reason,
} = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required",
      });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        message: "Cancellation reason is required",
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      String(order.customerId) !== String(customerId)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to cancel this order",
      });
    }

    const cancellableStatuses = [
      "Pending",
      "Confirmed",
      "Processing",
    ];

    if (
      !cancellableStatuses.includes(order.orderStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled because it is currently ${order.orderStatus}`,
      });
    }

    await restoreOrderStock(order);

    order.cancellationRequested = true;
    order.cancellationReason = String(reason).trim();
    order.cancelledBy = "customer";
    order.cancelledAt = new Date();
    order.orderStatus = "Cancelled";

    if (
      order.paymentMethod === "Online" &&
      order.paymentStatus === "Paid"
    ) {
      order.paymentStatus = "Refund Pending";
      order.refundAmount = Number(order.total || 0);
    }

        order.statusHistory.push({
      status: "Cancelled",

      message: `Order cancelled by customer. Reason: ${String(
        reason
      ).trim()}`,

      updatedBy: "customer",

      date: new Date(),
    });

    await order.save();

    const adminNotification =
      await Notification.create({
        title: "Order Cancelled",

        message: `${
          order.customerName
        } cancelled order #${String(
          order._id
        )
          .slice(-6)
          .toUpperCase()}`,

        type: "order_cancelled",

        recipientType: "admin",

        recipientId: null,

        orderId: order._id,

        link: `/orders/${order._id}`,
      });

    const customerNotification =
      await Notification.create({
        title: "Order Cancelled",

        message: `Your order #${String(
          order._id
        )
          .slice(-6)
          .toUpperCase()} has been cancelled successfully.`,

        type: "order_cancelled",

        recipientType: "customer",

        recipientId: order.customerId,

        orderId: order._id,

        link: "/previous-orders",
      });

    const io = req.app.get("io");

    if (io) {
      io.emit(
        "adminNotification",
        adminNotification
      );

      io.emit(
        `customerNotification:${String(
          order.customerId
        )}`,
        customerNotification
      );
    }

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order,
    });
  } catch (error) {
    console.error("Cancel order error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Order cancellation failed",
    });
  }
}
);

// ======================================================
// CUSTOMER RETURN REQUEST
// ======================================================

router.put(
  "/return-request/:id",
  protect,
  requireCustomer,
  async (req, res) => {
  try {
  const customerId =
  req.user.userId;

const {
  reason,
  description = "",
} = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required",
      });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        message: "Return reason is required",
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      String(order.customerId) !== String(customerId)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to return this order",
      });
    }

    if (order.orderStatus !== "Delivered") {
      return res.status(400).json({
        success: false,
        message:
          "Only delivered orders can be returned",
      });
    }

    if (order.returnRequested) {
      return res.status(400).json({
        success: false,
        message:
          "A return request already exists for this order",
      });
    }

    const deliveredDate =
      order.deliveredAt || order.updatedAt;

    const returnDeadline = new Date(deliveredDate);

    returnDeadline.setDate(
      returnDeadline.getDate() + 7
    );

    if (new Date() > returnDeadline) {
      return res.status(400).json({
        success: false,
        message:
          "The 7-day return period has expired",
      });
    }

    order.returnRequested = true;
    order.returnReason = String(reason).trim();
    order.returnDescription =
      String(description).trim();
    order.returnRequestedAt = new Date();
    order.orderStatus = "Return Requested";

    order.statusHistory.push({
      status: "Return Requested",
      message: `Return requested by customer. Reason: ${String(
        reason
      ).trim()}`,
      updatedBy: "customer",
      date: new Date(),
    });

    await order.save();

   const adminNotification =
  await Notification.create({
    title: "Return Requested",
    message: `${order.customerName} requested a return for order #${String(
      order._id
    )
      .slice(-6)
      .toUpperCase()}`,
    type: "return_requested",
    recipientType: "admin",
    recipientId: null,
    orderId: order._id,
    link: `/orders/${order._id}`,
  });

const customerNotification =
  await Notification.create({
    title: "Return Request Submitted",
    message: `Your return request for order #${String(
      order._id
    )
      .slice(-6)
      .toUpperCase()} has been submitted.`,
    type: "return_requested",
    recipientType: "customer",
    recipientId: order.customerId,
    orderId: order._id,
    link: "/current-orders",
  });

const io = req.app.get("io");

if (io) {
  io.emit("adminNotification", adminNotification);

  io.emit(
    `customerNotification:${String(
      order.customerId
    )}`,
    customerNotification
  );
}

    return res.status(200).json({
      success: true,
      message: "Return request submitted successfully",
      order,
    });
  } catch (error) {
    console.error("Return request error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Return request could not be submitted",
    });
  }
}
);

// ======================================================
// CUSTOMER EXCHANGE REQUEST
// ======================================================


// GET ALL ORDERS
router.get(
  "/all",
  protect,
  requireAdmin,
  async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("customerId")
      .populate("products.productId")
      .sort({
        createdAt: -1,
      });

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
);

// ======================================================
// GET ORDER TRACKING
// ======================================================

router.get("/track/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .select(
        "customerId orderStatus paymentStatus statusHistory createdAt deliveredAt cancelledAt returnRequested returnReason returnRequestedAt returnApprovedAt returnRejectedAt returnCompletedAt"
      )
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,

      tracking: {
        orderId: order._id,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        deliveredAt: order.deliveredAt,
        cancelledAt: order.cancelledAt,
        statusHistory: order.statusHistory || [],
        returnRequested: order.returnRequested,
        returnReason: order.returnReason,
        returnRequestedAt: order.returnRequestedAt,
        returnApprovedAt: order.returnApprovedAt,
        returnRejectedAt: order.returnRejectedAt,
        returnCompletedAt: order.returnCompletedAt,
      },
    });
  } catch (error) {
    console.error("Order tracking error:", error);

    return res.status(500).json({
      success: false,
      message: "Order tracking could not be loaded",
    });
  }
});


// GET SINGLE ORDER
router.get(
  "/:id",
  protect,
  requireAdmin,
  async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customerId")
      .populate("products.productId");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order Not Found",
      });
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
);

// UPDATE ORDER STATUS
// ======================================================
// ADMIN UPDATE ORDER STATUS
// ======================================================

router.put(
  "/update-status/:id",
  protect,
  requireAdmin,
  async (req, res) => {
  try {
    const {
  orderStatus,
  message = "",
  courierCompany = "",
  trackingNumber = "",
  trackingUrl = "",
  estimatedDelivery,
} = req.body;

    const validStatuses = [
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
    ];

    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      order.orderStatus === "Cancelled" &&
      orderStatus !== "Cancelled"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A cancelled order cannot be reactivated",
      });
    }

 if (orderStatus === "Cancelled") {
  await restoreOrderStock(order);

  order.cancelledBy = "admin";

  if (!order.cancelledAt) {
    order.cancelledAt = new Date();
  }

  if (
    order.paymentMethod === "Online" &&
    order.paymentStatus === "Paid"
  ) {
    order.paymentStatus = "Refund Pending";
    order.refundAmount = Number(order.total || 0);
  }
}

    if (orderStatus === "Shipped") {
  order.shippedAt = new Date();

  if (courierCompany) {
    order.courierCompany = courierCompany.trim();
  }

  if (trackingNumber) {
    order.trackingNumber = trackingNumber.trim();
  }

  if (trackingUrl) {
    order.trackingUrl = trackingUrl.trim();
  }

  if (estimatedDelivery) {
    order.estimatedDelivery = estimatedDelivery;
  }
}

if (
  orderStatus === "Shipped" &&
  !order.shippedAt
) {
  order.shippedAt = new Date();
}

if (orderStatus === "Delivered") {

  if (!order.deliveredAt) {
    order.deliveredAt = new Date();
  }

  if (order.paymentMethod === "COD") {
    order.paymentStatus = "Paid";
  }
}

    if (orderStatus === "Return Approved") {
      order.returnApprovedAt = new Date();

      if (order.paymentStatus === "Paid") {
        order.paymentStatus = "Refund Pending";
        order.refundAmount = Number(order.total || 0);
      }
    }

    if (orderStatus === "Return Rejected") {
      order.returnRejectedAt = new Date();
    }

    if (orderStatus === "Returned") {
      order.returnCompletedAt = new Date();

      if (order.paymentStatus === "Refund Pending") {
        order.paymentStatus = "Refunded";
      }
    }

    order.orderStatus = orderStatus;

    order.statusHistory.push({
      status: orderStatus,
      message:
        String(message).trim() ||
        `Order status updated to ${orderStatus}`,
      updatedBy: "admin",
      date: new Date(),
    });

    await order.save();

        const notificationDetails = {
      Confirmed: {
        title: "Order Confirmed",

        message: `Your order #${String(
          order._id
        )
          .slice(-6)
          .toUpperCase()} has been confirmed.`,

        type: "order_confirmed",
      },

      Processing: {
        title: "Order Processing",

        message: `Your order #${String(
          order._id
        )
          .slice(-6)
          .toUpperCase()} is being processed.`,

        type: "order_processing",
      },

      Packed: {
        title: "Order Packed",

        message: `Your order #${String(
          order._id
        )
          .slice(-6)
          .toUpperCase()} has been packed.`,

        type: "order_packed",
      },

      Shipped: {
        title: "Order Shipped",

        message: `Your order #${String(
          order._id
        )
          .slice(-6)
          .toUpperCase()} has been shipped.`,

        type: "order_shipped",
      },

      "Out for Delivery": {
        title: "Out for Delivery",

        message: `Your order #${String(
          order._id
        )
          .slice(-6)
          .toUpperCase()} is out for delivery.`,

        type: "out_for_delivery",
      },

      Delivered: {
        title: "Order Delivered",

        message: `Your order #${String(
          order._id
        )
          .slice(-6)
          .toUpperCase()} has been delivered.`,

        type: "order_delivered",
      },

      Cancelled: {
        title: "Order Cancelled",

        message: `Your order #${String(
          order._id
        )
          .slice(-6)
          .toUpperCase()} has been cancelled by the store.`,

        type: "order_cancelled",
      },

      "Return Approved": {
        title: "Return Approved",

        message: `Your return request for order #${String(
          order._id
        )
          .slice(-6)
          .toUpperCase()} has been approved.`,

        type: "return_approved",
      },

      "Return Rejected": {
        title: "Return Rejected",

        message: `Your return request for order #${String(
          order._id
        )
          .slice(-6)
          .toUpperCase()} has been rejected.`,

        type: "return_rejected",
      },

      Returned: {
        title: "Return Completed",

        message: `The return process for order #${String(
          order._id
        )
          .slice(-6)
          .toUpperCase()} has been completed.`,

        type: "refund_completed",
      },
    };

    const details =
      notificationDetails[orderStatus];

    if (details && order.customerId) {
      const customerNotification =
        await Notification.create({
          title: details.title,

          message: details.message,

          type: details.type,

          recipientType: "customer",

          recipientId: order.customerId,

          orderId: order._id,

          link:
            orderStatus === "Delivered" ||
            orderStatus === "Cancelled" ||
            orderStatus === "Returned"
              ? "/previous-orders"
              : "/current-orders",
        });

      const io = req.app.get("io");

      if (io) {
        io.emit(
          `customerNotification:${String(
            order.customerId
          )}`,
          customerNotification
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${orderStatus}`,
      order,
    });
  } catch (error) {
    console.error("Update order status error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Order status could not be updated",
    });
  }
}
);

// ======================================================
// GENERATE DELIVERY OTP
// ======================================================

router.post(
  "/generate-delivery-otp/:id",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.id);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      if (order.orderStatus !== "Out for Delivery") {
        return res.status(400).json({
          success: false,
          message:
            "OTP can only be generated when the order is Out for Delivery.",
        });
      }

      if (order.deliveryOtpVerified) {
        return res.status(400).json({
          success: false,
          message: "Delivery OTP has already been verified.",
        });
      }

      const otp = Math.floor(
        100000 + Math.random() * 900000
      ).toString();

      order.deliveryOtp = otp;
      order.deliveryOtpGeneratedAt = new Date();

      await order.save();

      return res.status(200).json({
        success: true,
        message: "Delivery OTP generated successfully.",
        otp, // Remove this after SMS integration
      });

    } catch (error) {
      console.error("Generate Delivery OTP:", error);

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to generate delivery OTP.",
      });
    }
  }
);

// ======================================================
// VERIFY DELIVERY OTP
// ======================================================

router.post(
  "/verify-delivery-otp/:id",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const { otp } = req.body;

      if (!otp) {
        return res.status(400).json({
          success: false,
          message: "OTP is required.",
        });
      }

      const order = await Order.findById(req.params.id);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found.",
        });
      }

      if (order.orderStatus !== "Out for Delivery") {
        return res.status(400).json({
          success: false,
          message:
            "OTP can only be verified when the order is Out for Delivery.",
        });
      }

      if (!order.deliveryOtp) {
        return res.status(400).json({
          success: false,
          message: "Delivery OTP has not been generated.",
        });
      }

      if (order.deliveryOtpVerified) {
        return res.status(400).json({
          success: false,
          message: "Delivery OTP has already been verified.",
        });
      }

      if (String(order.deliveryOtp) !== String(otp)) {
        return res.status(400).json({
          success: false,
          message: "Invalid OTP.",
        });
      }

      order.deliveryOtpVerified = true;
      order.deliveryOtpVerifiedAt = new Date();

      order.deliveryOtp = "";

      order.deliveredAt = new Date();

      order.orderStatus = "Delivered";

      if (order.paymentMethod === "COD") {
        order.paymentStatus = "Paid";
      }

      order.statusHistory.push({
        status: "Delivered",
        message: "Delivery verified using OTP.",
        updatedBy: "admin",
        date: new Date(),
      });

      await order.save();

      const customerNotification =
        await Notification.create({
          title: "Order Delivered",

          message: `Your order #${String(order._id)
            .slice(-6)
            .toUpperCase()} has been delivered successfully.`,

          type: "order_delivered",

          recipientType: "customer",

          recipientId: order.customerId,

          orderId: order._id,

          link: "/previous-orders",
        });

      const io = req.app.get("io");

      if (io) {
        io.emit(
          `customerNotification:${String(order.customerId)}`,
          customerNotification
        );
      }

      return res.status(200).json({
        success: true,
        message: "Delivery OTP verified successfully.",
        order,
      });

    } catch (error) {
      console.error("Verify Delivery OTP:", error);

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to verify delivery OTP.",
      });
    }
  }
);


// DELETE ORDER
router.delete(
  "/delete/:id",
  protect,
  requireAdmin,
  async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Order Deleted Successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
);

module.exports = router;
