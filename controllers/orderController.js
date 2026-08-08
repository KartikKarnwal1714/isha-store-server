const Order = require("../models/Order");
const User = require("../models/User");
const Notification = require("../models/Notification");

exports.createOrder = async (req, res) => {
  try {
    const order = await Order.create(req.body);

    if (order.customerId) {
      await User.findByIdAndUpdate(order.customerId, {
        $push: {
          orders: order._id,
        },
        $set: {
          cart: [],
        },
      });
    }

    // Create an admin notification for this new order
    const notification = await Notification.create({
      title: "New Order Received",
      message: `${order.customerName} placed a new order.`,
      type: "order_created",
      recipientType: "admin",
      orderId: order._id,
      link: `/orders/${order._id}`,
    });

    // Push it in real-time to any connected admin panels
    const io = req.app.get("io");
    if (io) {
      io.emit("newOrder", {
        notification,
        order,
      });
    }

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order,
    });
  } catch (error) {
    console.log("Create order error:", error);

    res.status(500).json({
      success: false,
      message: "Order creation failed",
    });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("customerId")
      .populate("products.productId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.log("Get orders error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};