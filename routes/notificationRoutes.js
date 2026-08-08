const express = require("express");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");

const router = express.Router();

// ======================================================
// GET ADMIN NOTIFICATIONS
// GET /api/notifications/admin
// ======================================================

router.get("/admin", async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipientType: "admin",
    })
      .populate("orderId")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error(
      "Get admin notifications error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Admin notifications could not be loaded",
    });
  }
});

// ======================================================
// GET CUSTOMER NOTIFICATIONS
// GET /api/notifications/customer/:customerId
// ======================================================

router.get(
  "/customer/:customerId",
  async (req, res) => {
    try {
      const { customerId } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(customerId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID",
        });
      }

      const notifications =
        await Notification.find({
          recipientType: "customer",
          recipientId: customerId,
        })
          .populate("orderId")
          .sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        notifications,
      });
    } catch (error) {
      console.error(
        "Get customer notifications error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Customer notifications could not be loaded",
      });
    }
  }
);

// ======================================================
// GET CUSTOMER UNREAD COUNT
// GET /api/notifications/customer/:customerId/unread-count
// ======================================================

router.get(
  "/customer/:customerId/unread-count",
  async (req, res) => {
    try {
      const { customerId } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(customerId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID",
        });
      }

      const unreadCount =
        await Notification.countDocuments({
          recipientType: "customer",
          recipientId: customerId,
          isRead: false,
        });

      return res.status(200).json({
        success: true,
        unreadCount,
      });
    } catch (error) {
      console.error(
        "Unread count error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unread count could not be loaded",
      });
    }
  }
);

// ======================================================
// GET ADMIN UNREAD COUNT
// GET /api/notifications/admin/unread-count
// ======================================================

router.get("/admin/unread-count", async (req, res) => {
  try {
    const unreadCount =
      await Notification.countDocuments({
        recipientType: "admin",
        isRead: false,
      });

    return res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error(
      "Admin unread count error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Admin unread count could not be loaded",
    });
  }
});

// ======================================================
// MARK ONE NOTIFICATION AS READ
// PUT /api/notifications/:id/read
// ======================================================

router.put("/:id/read", async (req, res) => {
  try {
    const notification =
      await Notification.findByIdAndUpdate(
        req.params.id,
        {
          isRead: true,
          readAt: new Date(),
        },
        {
          new: true,
        }
      );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error(
      "Mark notification read error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Notification could not be marked as read",
    });
  }
});

// ======================================================
// MARK ALL CUSTOMER NOTIFICATIONS AS READ
// PUT /api/notifications/customer/:customerId/read-all
// ======================================================

router.put(
  "/customer/:customerId/read-all",
  async (req, res) => {
    try {
      const { customerId } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(customerId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID",
        });
      }

      await Notification.updateMany(
        {
          recipientType: "customer",
          recipientId: customerId,
          isRead: false,
        },
        {
          $set: {
            isRead: true,
            readAt: new Date(),
          },
        }
      );

      return res.status(200).json({
        success: true,
        message:
          "All customer notifications marked as read",
      });
    } catch (error) {
      console.error(
        "Mark customer notifications error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Notifications could not be marked as read",
      });
    }
  }
);

// ======================================================
// MARK ALL ADMIN NOTIFICATIONS AS READ
// PUT /api/notifications/admin/read-all
// ======================================================

router.put("/admin/read-all", async (req, res) => {
  try {
    await Notification.updateMany(
      {
        recipientType: "admin",
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "All admin notifications marked as read",
    });
  } catch (error) {
    console.error(
      "Mark admin notifications error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Notifications could not be marked as read",
    });
  }
});

// ======================================================
// DELETE ALL CUSTOMER NOTIFICATIONS
// DELETE /api/notifications/customer/:customerId/all
// ======================================================

router.delete(
  "/customer/:customerId/all",
  async (req, res) => {
    try {
      const { customerId } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(customerId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID",
        });
      }

      await Notification.deleteMany({
        recipientType: "customer",
        recipientId: customerId,
      });

      return res.status(200).json({
        success: true,
        message:
          "All customer notifications deleted",
      });
    } catch (error) {
      console.error(
        "Delete customer notifications error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Notifications could not be deleted",
      });
    }
  }
);

// ======================================================
// DELETE ONE NOTIFICATION
// DELETE /api/notifications/:id
// ======================================================

router.delete("/:id", async (req, res) => {
  try {
    const notification =
      await Notification.findByIdAndDelete(
        req.params.id
      );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete notification error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Notification could not be deleted",
    });
  }
});



module.exports = router;