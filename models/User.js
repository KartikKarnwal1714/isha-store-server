const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      default: "",
    },

    addresses: [
  {
    fullName: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      default: "",
    },

    house: {
      type: String,
      default: "",
    },

    area: {
      type: String,
      default: "",
    },

    landmark: {
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

    country: {
      type: String,
      default: "India",
    },

    addressType: {
      type: String,
      enum: [
        "Home",
        "Office",
        "Other",
      ],
      default: "Home",
    },

    isDefault: {
      type: Boolean,
      default: false,
    },
  },
],

    isProfileComplete: {
      type: Boolean,
      default: false,
    },

    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    cart: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },

        quantity: {
          type: Number,
          default: 1,
        },

        color: {
          type: String,
          default: "",
        },

        size: {
          type: String,
          default: "",
        },
      },
    ],

    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
    

    recentlyViewed: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  },
],


    savedCards: [
  {
    cardHolder: String,

    last4Digits: String,

    cardType: String,
  },
],



fcmTokens: [
  {
    token: String,

    platform: {
      type: String,
      enum: [
        "web",
        "android",
        "ios",
      ],
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
],

  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);