const mongoose = require("mongoose");
const User = require("../models/User");

exports.completeProfile = async (req, res) => {
  try {
    const {
      phone,
      name,
      email,
      address,
      city,
      state,
      pincode,
      landmark,
    } = req.body;

    if (!phone || !name || !address || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: "Required profile fields are missing",
      });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.name = name;
    user.email = email || user.email;
    user.isProfileComplete = true;

    // The User schema only stores addresses inside the
    // `addresses` array (there is no flat address/city/state
    // field on the document) — save it there so it actually
    // persists and shows up in the address book and delivery
    // location bar.
    const addressEntry = {
      fullName: name,
      phone,
      house: address,
      landmark: landmark || "",
      city,
      state,
      pincode,
      country: "India",
      addressType: "Home",
      isDefault: true,
    };

    const existingDefaultIndex = user.addresses.findIndex(
      (entry) => entry.isDefault
    );

    if (existingDefaultIndex !== -1) {
      user.addresses[existingDefaultIndex] = {
        ...user.addresses[existingDefaultIndex].toObject(),
        ...addressEntry,
      };
    } else {
      user.addresses.push(addressEntry);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile completed successfully",
      user: user,
    });
  } catch (error) {
    console.log("Complete profile error:", error);

    res.status(500).json({
      success: false,
      message: "Profile update failed",
    });
  }
};

exports.getAllCustomers = async (req, res) => {
  try {
    const users = await User.find()
      .populate("wishlist")
      .populate("cart.product")
      .populate("orders")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.log("Get customers error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
    });
  }
};

// ======================================================
// DELETE A CUSTOMER
//
// This removes the customer's account and personal details
// (profile, saved addresses, cart, wishlist, saved cards)
// only. Their past Orders are left untouched on purpose —
// every Order already stores its own snapshot of the
// customer's name/phone at the time of purchase, so revenue,
// sales figures and order history are completely unaffected.
// ======================================================

exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    console.log("Delete customer error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete customer",
    });
  }
};