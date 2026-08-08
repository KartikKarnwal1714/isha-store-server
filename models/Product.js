const mongoose = require("mongoose");

// ======================================================
// SIZE SCHEMA
// ======================================================

const sizeSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      required: [true, "Size is required"],
      trim: true,
    },

    stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },

    price: {
      type: Number,
      default: 0,
      min: [0, "Price cannot be negative"],
    },

    originalPrice: {
      type: Number,
      default: 0,
      min: [0, "Original price cannot be negative"],
    },

    sku: {
      type: String,
      default: "",
      trim: true,
    },

    barcode: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    _id: true,
  }
);

// ======================================================
// COLOR SCHEMA
// ======================================================

const colorSchema = new mongoose.Schema(
  {
    colorName: {
      type: String,
      required: [true, "Colour name is required"],
      trim: true,
    },

    colorCode: {
      type: String,
      default: "#000000",
      trim: true,
    },

    images: [
      {
        type: String,
        trim: true,
      },
    ],

    sizes: {
      type: [sizeSchema],
      default: [],
    },
  },
  {
    _id: true,
  }
);

// ======================================================
// PRODUCT SCHEMA
// ======================================================

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [2, "Product name is too short"],
      maxlength: [150, "Product name is too long"],
    },

    brand: {
      type: String,
      required: [true, "Brand is required"],
      trim: true,
    },

    category: {
      type: String,

      enum: {
        values: [
          "Men",
          "Women",
          "Kids",
          "Jewellery",
          "Mens-Cosmetics",
          "Womens-Cosmetics",
          "Kids-Cosmetics",
        ],
        message: "{VALUE} is not a valid category",
      },

      required: [true, "Category is required"],
    },

    subCategory: {
      type: String,
      default: "",
      trim: true,
    },

    jewelleryFor: {
      type: String,
      default: "",
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [
        5000,
        "Description cannot exceed 5000 characters",
      ],
    },

    // Fallback/default selling price
    price: {
      type: Number,
      default: 0,
      min: [0, "Price cannot be negative"],
    },

    // Fallback/default original price
    originalPrice: {
      type: Number,
      default: 0,
      min: [0, "Original price cannot be negative"],
    },

    // Automatically calculated lowest variant price
    minimumPrice: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    // Automatically calculated highest variant price
    maximumPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Automatically calculated lowest variant original price
    minimumOriginalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Automatically calculated highest variant original price
    maximumOriginalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    featured: {
      type: Boolean,
      default: false,
      index: true,
    },

    banner: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,

      enum: {
        values: ["active", "draft", "outofstock"],
        message: "{VALUE} is not a valid product status",
      },

      default: "active",
      index: true,
    },

    // Automatically calculated total stock
    totalStock: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    // Automatically calculated number of colours
    totalColors: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Automatically calculated number of all size variants
    totalSizes: {
      type: Number,
      default: 0,
      min: 0,
    },

    soldCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    totalRevenue: {
      type: Number,
      default: 0,
      min: 0,
    },

    views: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    averageRating: {
  type: Number,
  default: 0,
  min: 0,
  max: 5,
  index: true,
},

totalReviews: {
  type: Number,
  default: 0,
  min: 0,
},

ratingDistribution: {
  1: {
    type: Number,
    default: 0,
    min: 0,
  },

  2: {
    type: Number,
    default: 0,
    min: 0,
  },

  3: {
    type: Number,
    default: 0,
    min: 0,
  },

  4: {
    type: Number,
    default: 0,
    min: 0,
  },

  5: {
    type: Number,
    default: 0,
    min: 0,
  },
},

    brandImage: {
      type: String,
      default: "",
      trim: true,
    },

    colors: {
      type: [colorSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// ======================================================
// PRODUCT SUMMARY CALCULATION
// ======================================================

function calculateProductSummary(product) {
  const colors = Array.isArray(product.colors)
    ? product.colors
    : [];

  let totalStock = 0;
  let totalSizes = 0;

  const sellingPrices = [];
  const originalPrices = [];

  colors.forEach((color) => {
    const sizes = Array.isArray(color.sizes)
      ? color.sizes
      : [];

    sizes.forEach((size) => {
      totalSizes += 1;

      const stock = Number(size.stock || 0);
      const sellingPrice = Number(size.price || 0);
      const originalPrice = Number(
        size.originalPrice || 0
      );

      totalStock += stock > 0 ? stock : 0;

      if (
        Number.isFinite(sellingPrice) &&
        sellingPrice > 0
      ) {
        sellingPrices.push(sellingPrice);
      }

      if (
        Number.isFinite(originalPrice) &&
        originalPrice > 0
      ) {
        originalPrices.push(originalPrice);
      }
    });
  });

  const fallbackPrice = Number(product.price || 0);

  const fallbackOriginalPrice = Number(
    product.originalPrice || 0
  );

  if (
    sellingPrices.length === 0 &&
    fallbackPrice > 0
  ) {
    sellingPrices.push(fallbackPrice);
  }

  if (
    originalPrices.length === 0 &&
    fallbackOriginalPrice > 0
  ) {
    originalPrices.push(fallbackOriginalPrice);
  }

  const minimumPrice =
    sellingPrices.length > 0
      ? Math.min(...sellingPrices)
      : 0;

  const maximumPrice =
    sellingPrices.length > 0
      ? Math.max(...sellingPrices)
      : 0;

  const minimumOriginalPrice =
    originalPrices.length > 0
      ? Math.min(...originalPrices)
      : 0;

  const maximumOriginalPrice =
    originalPrices.length > 0
      ? Math.max(...originalPrices)
      : 0;

  product.totalStock = totalStock;
  product.totalColors = colors.length;
  product.totalSizes = totalSizes;

  product.minimumPrice = minimumPrice;
  product.maximumPrice = maximumPrice;

  product.minimumOriginalPrice =
    minimumOriginalPrice;

  product.maximumOriginalPrice =
    maximumOriginalPrice;

  /*
   * Keep top-level prices synchronized so old frontend
   * pages that use product.price still work correctly.
   */
  product.price = minimumPrice;

  product.originalPrice =
    minimumOriginalPrice > 0
      ? minimumOriginalPrice
      : maximumOriginalPrice;

  /*
   * Do not overwrite a manually selected draft status.
   */
  if (product.status !== "draft") {
    product.status =
      totalStock > 0 ? "active" : "outofstock";
  }

  return product;
}

// ======================================================
// AUTOMATIC CALCULATION BEFORE SAVE
// ======================================================

productSchema.pre("save", function () {
  calculateProductSummary(this);
});

// ======================================================
// AUTOMATIC CALCULATION BEFORE VALIDATION
// ======================================================

productSchema.pre("validate", function () {
  calculateProductSummary(this);
});

// ======================================================
// AUTOMATIC CALCULATION FOR EXCEL INSERTMANY
// ======================================================

productSchema.pre("insertMany", function (documents) {
  documents.forEach((document) => {
    calculateProductSummary(document);
  });
});

// ======================================================
// INDEXES FOR SEARCH, FILTERING AND SORTING
// ======================================================

productSchema.index({
  name: "text",
  brand: "text",
  category: "text",
  subCategory: "text",
  description: "text",
});

productSchema.index({
  category: 1,
  subCategory: 1,
  brand: 1,
  createdAt: -1,
});

productSchema.index({
  category: 1,
  minimumPrice: 1,
  totalStock: 1,
});

productSchema.index({
  averageRating: -1,
  totalReviews: -1,
});

module.exports = mongoose.model(
  "Product",
  productSchema
);