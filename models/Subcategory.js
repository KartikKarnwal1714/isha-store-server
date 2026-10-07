const mongoose = require("mongoose");

const subcategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      enum: [
        "Men",
        "Women",
        "Kids",
        "Jewellery",
        "Mens-Cosmetics",
        "Womens-Cosmetics",
        "Kids-Cosmetics",
      ],
    },

    image: {
      type: String,
      default: "",
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    displayOrder: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

subcategorySchema.index({
  category: 1,
  name: 1,
});

module.exports = mongoose.model(
  "Subcategory",
  subcategorySchema
);