const mongoose = require("mongoose");
const Subcategory = require("../models/Subcategory");
const Product = require("../models/Product");

const VALID_CATEGORIES = [
  "Men",
  "Women",
  "Kids",
  "Jewellery",
  "Mens-Cosmetics",
  "Womens-Cosmetics",
  "Kids-Cosmetics",
];

exports.createSubcategory = async (req, res) => {
  try {
    const {
      name,
      category,
      image = "",
      description = "",
      displayOrder = 0,
      isActive = true,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subcategory name is required",
      });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category",
      });
    }

    const existing = await Subcategory.findOne({
      category,
      name: {
        $regex: `^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "This subcategory already exists",
      });
    }

    const subcategory = await Subcategory.create({
      name: name.trim(),
      category,
      image: image.trim(),
      description: description.trim(),
      displayOrder: Number(displayOrder) || 0,
      isActive,
    });

    res.status(201).json({
      success: true,
      message: "Subcategory created successfully",
      subcategory,
    });
  } catch (error) {
    console.error("Create subcategory error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to create subcategory",
    });
  }
};


exports.getAdminSubcategories = async (req, res) => {
  try {
    const { category = "" } = req.query;

    const filter = {};

    if (category) {
      filter.category = category;
    }

    const subcategories = await Subcategory.find(filter)
      .sort({
        category: 1,
        displayOrder: 1,
        name: 1,
      })
      .lean();

    const result = await Promise.all(
      subcategories.map(async (subcategory) => {
        const productCount = await Product.countDocuments({
          category: subcategory.category,
          subCategory: subcategory.name,
          status: "active",
        });

        return {
          ...subcategory,
          productCount,
        };
      })
    );

    res.json({
      success: true,
      subcategories: result,
    });
  } catch (error) {
    console.error(
      "Get admin subcategories error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to load subcategories",
    });
  }
};


exports.getFrontendSubcategories = async (req, res) => {
  try {
    const { category } = req.query;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    const subcategories = await Subcategory.find({
      category,
      isActive: true,
    })
      .sort({
        displayOrder: 1,
        name: 1,
      })
      .lean();

    const visibleSubcategories = [];

    for (const subcategory of subcategories) {
      const productCount =
        await Product.countDocuments({
          category: subcategory.category,
          subCategory: subcategory.name,
          status: "active",
        });

      if (productCount > 0) {
        visibleSubcategories.push({
          ...subcategory,
          productCount,
        });
      }
    }

    res.json({
      success: true,
      subcategories: visibleSubcategories,
    });
  } catch (error) {
    console.error(
      "Get frontend subcategories error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to load frontend subcategories",
    });
  }
};


exports.updateSubcategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subcategory ID",
      });
    }

    const {
      name,
      category,
      image = "",
      description = "",
      displayOrder = 0,
      isActive = true,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subcategory name is required",
      });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category",
      });
    }

    const duplicate = await Subcategory.findOne({
      _id: {
        $ne: id,
      },
      category,
      name: {
        $regex: `^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "Another subcategory with this name already exists",
      });
    }

    const oldSubcategory =
      await Subcategory.findById(id);

    if (!oldSubcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    const oldName = oldSubcategory.name;
    const oldCategory = oldSubcategory.category;

    const updated =
      await Subcategory.findByIdAndUpdate(
        id,
        {
          name: name.trim(),
          category,
          image: image.trim(),
          description: description.trim(),
          displayOrder:
            Number(displayOrder) || 0,
          isActive,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (
      oldName !== name.trim() ||
      oldCategory !== category
    ) {
      await Product.updateMany(
        {
          category: oldCategory,
          subCategory: oldName,
        },
        {
          $set: {
            category,
            subCategory: name.trim(),
          },
        }
      );
    }

    res.json({
      success: true,
      message: "Subcategory updated successfully",
      subcategory: updated,
    });
  } catch (error) {
    console.error(
      "Update subcategory error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to update subcategory",
    });
  }
};


exports.toggleSubcategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subcategory ID",
      });
    }

    const subcategory =
      await Subcategory.findById(id);

    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    subcategory.isActive =
      !subcategory.isActive;

    await subcategory.save();

    res.json({
      success: true,
      message: subcategory.isActive
        ? "Subcategory activated"
        : "Subcategory hidden",
      subcategory,
    });
  } catch (error) {
    console.error(
      "Toggle subcategory error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to change subcategory status",
    });
  }
};


exports.deleteSubcategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subcategory ID",
      });
    }

    const subcategory =
      await Subcategory.findById(id);

    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    subcategory.isActive = false;

    await subcategory.save();

    res.json({
      success: true,
      message: "Subcategory hidden successfully",
    });
  } catch (error) {
    console.error(
      "Delete subcategory error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to hide subcategory",
    });
  }
};