const Brand = require("../models/Brand");

exports.createBrand = async (req, res) => {
  try {
    const { name, tagline, bannerImage, brandImage, nameColor } = req.body;

    if (!name || !brandImage) {
      return res.status(400).json({
        success: false,
        message: "Brand name and brand image are required",
      });
    }

    const existingBrand = await Brand.findOne({
      name: name.trim(),
    });

    if (existingBrand) {
      return res.status(400).json({
        success: false,
        message: "Brand already exists",
      });
    }

    const brand = await Brand.create({
      name: name.trim(),
      tagline,
      bannerImage,
      brandImage,
      nameColor,
    });

    res.status(201).json({
      success: true,
      message: "Brand created successfully",
      brand,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Brand creation failed",
    });
  }
};

exports.getBrands = async (req, res) => {
  try {
    const brands = await Brand.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      brands,
    });
  } catch (error) {
    console.error("Fetch brands error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch brands",
    });
  }
};

exports.deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    await Brand.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Brand deleted successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Brand delete failed",
    });
  }
};