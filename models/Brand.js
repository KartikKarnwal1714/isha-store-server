const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    tagline: {
      type: String,
      default: "",
    },

    bannerImage: {
      type: String,
      default: "",
    },

    brandImage: {
      type: String,
      required: true,
    },

    nameColor: {
      type: String,
      default: "#000000",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Brand", brandSchema);