const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");

const router = express.Router();

// ======================================================
// GET ALL CUSTOMER ADDRESSES
// GET /api/addresses/:customerId
// ======================================================

router.get("/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const user = await User.findById(customerId).select(
      "name phone email addresses"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      addresses: user.addresses || [],
    });
  } catch (error) {
    console.error("Get addresses error:", error);

    return res.status(500).json({
      success: false,
      message: "Addresses could not be loaded",
    });
  }
});

// ======================================================
// ADD NEW ADDRESS
// POST /api/addresses/:customerId
// ======================================================

router.post("/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const {
      fullName,
      phone,
      house,
      area = "",
      landmark = "",
      city,
      state,
      pincode,
      country = "India",
      addressType = "Home",
      isDefault = false,
    } = req.body;

    if (!fullName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Full name is required",
      });
    }

    if (!phone?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    if (!house?.trim()) {
      return res.status(400).json({
        success: false,
        message: "House or flat number is required",
      });
    }

    if (!city?.trim()) {
      return res.status(400).json({
        success: false,
        message: "City is required",
      });
    }

    if (!state?.trim()) {
      return res.status(400).json({
        success: false,
        message: "State is required",
      });
    }

    if (!pincode?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Pincode is required",
      });
    }

    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit phone number",
      });
    }

    if (!/^\d{6}$/.test(pincode.trim())) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 6-digit pincode",
      });
    }

    const user = await User.findById(customerId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const shouldBeDefault =
      isDefault || user.addresses.length === 0;

    if (shouldBeDefault) {
      user.addresses.forEach((address) => {
        address.isDefault = false;
      });
    }

    user.addresses.push({
      fullName: fullName.trim(),
      phone: phone.trim(),
      house: house.trim(),
      area: area.trim(),
      landmark: landmark.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      country: country.trim() || "India",
      addressType,
      isDefault: shouldBeDefault,
    });

    await user.save();

    return res.status(201).json({
      success: true,
      message: "Address added successfully",
      addresses: user.addresses,
      address: user.addresses[user.addresses.length - 1],
    });
  } catch (error) {
    console.error("Add address error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Address could not be added",
    });
  }
});

// ======================================================
// UPDATE ADDRESS
// PUT /api/addresses/:customerId/:addressId
// ======================================================

router.put("/:customerId/:addressId", async (req, res) => {
  try {
    const { customerId, addressId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(customerId) ||
      !mongoose.Types.ObjectId.isValid(addressId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer or address ID",
      });
    }

    const user = await User.findById(customerId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const address = user.addresses.id(addressId);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const {
      fullName,
      phone,
      house,
      area,
      landmark,
      city,
      state,
      pincode,
      country,
      addressType,
      isDefault,
    } = req.body;

    if (phone && !/^[6-9]\d{9}$/.test(phone.trim())) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit phone number",
      });
    }

    if (pincode && !/^\d{6}$/.test(pincode.trim())) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 6-digit pincode",
      });
    }

    if (isDefault === true) {
      user.addresses.forEach((savedAddress) => {
        savedAddress.isDefault = false;
      });
    }

    if (fullName !== undefined) {
      address.fullName = fullName.trim();
    }

    if (phone !== undefined) {
      address.phone = phone.trim();
    }

    if (house !== undefined) {
      address.house = house.trim();
    }

    if (area !== undefined) {
      address.area = area.trim();
    }

    if (landmark !== undefined) {
      address.landmark = landmark.trim();
    }

    if (city !== undefined) {
      address.city = city.trim();
    }

    if (state !== undefined) {
      address.state = state.trim();
    }

    if (pincode !== undefined) {
      address.pincode = pincode.trim();
    }

    if (country !== undefined) {
      address.country = country.trim() || "India";
    }

    if (addressType !== undefined) {
      address.addressType = addressType;
    }

    if (isDefault !== undefined) {
      address.isDefault = isDefault;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      address,
      addresses: user.addresses,
    });
  } catch (error) {
    console.error("Update address error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Address could not be updated",
    });
  }
});

// ======================================================
// SET DEFAULT ADDRESS
// PUT /api/addresses/:customerId/:addressId/default
// ======================================================

router.put(
  "/:customerId/:addressId/default",
  async (req, res) => {
    try {
      const { customerId, addressId } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(customerId) ||
        !mongoose.Types.ObjectId.isValid(addressId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer or address ID",
        });
      }

      const user = await User.findById(customerId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      const selectedAddress = user.addresses.id(addressId);

      if (!selectedAddress) {
        return res.status(404).json({
          success: false,
          message: "Address not found",
        });
      }

      user.addresses.forEach((address) => {
        address.isDefault =
          String(address._id) === String(addressId);
      });

      await user.save();

      return res.status(200).json({
        success: true,
        message: "Default address updated",
        addresses: user.addresses,
      });
    } catch (error) {
      console.error("Set default address error:", error);

      return res.status(500).json({
        success: false,
        message: "Default address could not be updated",
      });
    }
  }
);

// ======================================================
// DELETE ADDRESS
// DELETE /api/addresses/:customerId/:addressId
// ======================================================

router.delete(
  "/:customerId/:addressId",
  async (req, res) => {
    try {
      const { customerId, addressId } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(customerId) ||
        !mongoose.Types.ObjectId.isValid(addressId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer or address ID",
        });
      }

      const user = await User.findById(customerId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      const address = user.addresses.id(addressId);

      if (!address) {
        return res.status(404).json({
          success: false,
          message: "Address not found",
        });
      }

      const wasDefault = address.isDefault;

      user.addresses.pull(addressId);

      if (wasDefault && user.addresses.length > 0) {
        user.addresses[0].isDefault = true;
      }

      await user.save();

      return res.status(200).json({
        success: true,
        message: "Address deleted successfully",
        addresses: user.addresses,
      });
    } catch (error) {
      console.error("Delete address error:", error);

      return res.status(500).json({
        success: false,
        message: "Address could not be deleted",
      });
    }
  }
);

module.exports = router;