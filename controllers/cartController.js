const User = require("../models/User");

exports.addToCart = async (req, res) => {
  try {
    const { userId, productId, quantity, color, size } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        message: "User ID and Product ID are required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const existingItem = user.cart.find(
      (item) =>
        item.product.toString() === productId &&
        item.color === color &&
        item.size === size
    );

    if (existingItem) {
      existingItem.quantity += quantity || 1;
    } else {
      user.cart.push({
        product: productId,
        quantity: quantity || 1,
        color: color || "",
        size: size || "",
      });
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Product added to cart",
      cart: user.cart,
    });
  } catch (error) {
    console.log("Add cart error:", error);

    res.status(500).json({
      success: false,
      message: "Cart update failed",
    });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const { userId, productId } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        message: "User ID and Product ID required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.cart = user.cart.filter(
      (item) => item.product.toString() !== productId.toString()
    );

    await user.save();

    res.status(200).json({
      success: true,
      message: "Removed from cart",
      cart: user.cart,
    });
  } catch (error) {
    console.log("Remove cart error:", error);
    res.status(500).json({
      success: false,
      message: "Remove cart failed",
    });
  }
};

exports.clearUserCart = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.cart = [];

    await user.save();

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
      cart: user.cart,
    });
  } catch (error) {
    console.log("Clear cart error:", error);

    res.status(500).json({
      success: false,
      message: "Clear cart failed",
    });
  }
};