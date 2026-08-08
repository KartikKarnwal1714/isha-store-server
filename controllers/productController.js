const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Product = require("../models/Product");
const User = require("../models/User");
const Order = require("../models/Order");
const xlsx = require("xlsx");
const fs = require("fs");
const cloudinary = require("../config/cloudinary");


// ======================================================
// HELPER FUNCTIONS
// ======================================================

const escapeRegex = (value = "") => {
  return String(value)
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const parseBoolean = (value, defaultValue = false) => {
  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false") {
    return false;
  }

  return defaultValue;
};

// ======================================================
// EXCEL IMPORT HELPERS
// ======================================================
//
// Supplier / stock-sheet Excel files don't always use the same header
// names as the app (e.g. "sub category" instead of "subCategory",
// "origional price" instead of "originalPrice", trailing spaces like
// "sku ", etc). These helpers make the importer tolerant of those
// header variations so any reasonably-formatted sheet keeps working
// without needing to edit this file every time.

// Every category that Add Product (and the storefront) understands.
const VALID_PRODUCT_CATEGORIES = [
  "Men",
  "Women",
  "Kids",
  "Jewellery",
  "Mens-Cosmetics",
  "Womens-Cosmetics",
  "Kids-Cosmetics",
];

// Turns a row's real keys (whatever casing/spacing the sheet used) into
// a lookup keyed by a "clean" version: trimmed, lower-cased, and with
// repeated whitespace collapsed to a single space.
const normalizeExcelRowKeys = (row) => {
  const normalized = {};

  Object.keys(row || {}).forEach((originalKey) => {
    const cleanKey = String(originalKey)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

    normalized[cleanKey] = row[originalKey];
  });

  return normalized;
};

// Reads a value out of a normalized row, trying every known alias for
// that field (e.g. "subcategory" and "sub category" both work).
const getExcelValue = (normalizedRow, aliases) => {
  for (const alias of aliases) {
    const value = normalizedRow[alias];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return "";
};

// Some supplier sheets don't use the app's exact category names
// (e.g. "hair color" instead of "Womens-Cosmetics"). When that happens
// we keep the sheet's own category text as the subCategory, and pick
// the closest valid app category using the "male female" / gender
// column as a hint, so the row still imports instead of being rejected.
const resolveExcelCategory = (rawCategory, rawGender) => {
  const cleanCategory = String(rawCategory || "").trim();
  const categoryKey = cleanCategory.toLowerCase().replace(/-/g, " ");

  const directMatch = VALID_PRODUCT_CATEGORIES.find((validCategory) => {
    return validCategory.toLowerCase().replace(/-/g, " ") === categoryKey;
  });

  if (directMatch) {
    return directMatch;
  }

  const gender = String(rawGender || "").trim().toLowerCase();

  if (gender.includes("female") || /\bwoman\b|\bwomen\b/.test(gender)) {
    return "Womens-Cosmetics";
  }

  if (gender.includes("male") || /\bman\b|\bmen\b/.test(gender)) {
    return "Mens-Cosmetics";
  }

  if (gender.includes("kid") || gender.includes("baby")) {
    return "Kids-Cosmetics";
  }

  // "unisex", blank, or anything unrecognized falls back here, since
  // most non-clothing/beauty items (like hair colors) are listed
  // under Women's Cosmetics in this store today.
  return "Womens-Cosmetics";
};


// ======================================================
// RECOMMENDATION HELPERS
// ======================================================

const getRecommendationProductFields = () => {
  return [
    "name",
    "brand",
    "category",
    "subCategory",
    "jewelleryFor",
    "description",
    "price",
    "originalPrice",
    "minimumPrice",
    "maximumPrice",
    "minimumOriginalPrice",
    "maximumOriginalPrice",
    "totalStock",
    "soldCount",
    "views",
    "averageRating",
    "totalReviews",
    "featured",
    "status",
    "brandImage",
    "colors",
    "createdAt",
  ].join(" ");
};

const createAvailableProductFilter = ({
  excludedProductIds = [],
} = {}) => {
  const filter = {
    status: "active",
    totalStock: {
      $gt: 0,
    },
  };

  const validExcludedIds = excludedProductIds
    .filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    )
    .map(
      (id) =>
        new mongoose.Types.ObjectId(id)
    );

  if (validExcludedIds.length > 0) {
    filter._id = {
      $nin: validExcludedIds,
    };
  }

  return filter;
};

const removeDuplicateProducts = (
  products = [],
  limit = 12
) => {
  const uniqueProducts = [];
  const productIds = new Set();

  for (const product of products) {
    const productId = String(product?._id || "");

    if (!productId || productIds.has(productId)) {
      continue;
    }

    productIds.add(productId);
    uniqueProducts.push(product);

    if (uniqueProducts.length >= limit) {
      break;
    }
  }

  return uniqueProducts;
};

const calculateRecommendationScore = (
  product,
  sourceProduct
) => {
  let score = 0;

  if (
    product.category &&
    product.category === sourceProduct.category
  ) {
    score += 40;
  }

  if (
    product.subCategory &&
    product.subCategory ===
      sourceProduct.subCategory
  ) {
    score += 35;
  }

  if (
    product.brand &&
    product.brand === sourceProduct.brand
  ) {
    score += 25;
  }

  if (
    product.jewelleryFor &&
    product.jewelleryFor ===
      sourceProduct.jewelleryFor
  ) {
    score += 10;
  }

  const sourcePrice = Number(
    sourceProduct.minimumPrice ||
      sourceProduct.price ||
      0
  );

  const productPrice = Number(
    product.minimumPrice ||
      product.price ||
      0
  );

  if (sourcePrice > 0 && productPrice > 0) {
    const priceDifference = Math.abs(
      sourcePrice - productPrice
    );

    const priceDifferencePercentage =
      priceDifference / sourcePrice;

    if (priceDifferencePercentage <= 0.15) {
      score += 20;
    } else if (
      priceDifferencePercentage <= 0.3
    ) {
      score += 12;
    } else if (
      priceDifferencePercentage <= 0.5
    ) {
      score += 5;
    }
  }

  score += Math.min(
    Number(product.averageRating || 0) * 2,
    10
  );

  score += Math.min(
    Number(product.soldCount || 0) / 10,
    10
  );

  score += Math.min(
    Number(product.views || 0) / 100,
    5
  );

  if (product.featured) {
    score += 5;
  }

  return score;
};


// ======================================================
// CREATE PRODUCT
// ======================================================

exports.createProduct = async (req, res) => {
  try {
    const uploadedImages = [];

    // Upload received image files to Cloudinary
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(
          `data:${file.mimetype};base64,${file.buffer.toString(
            "base64"
          )}`,
          {
            folder: "products",
          }
        );

        uploadedImages.push(result.secure_url);
      }
    }

    let colors = [];

    try {
      colors =
        typeof req.body.colors === "string"
          ? JSON.parse(req.body.colors || "[]")
          : req.body.colors || [];
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid colours data",
      });
    }

    let imageIndex = 0;

    colors = colors.map((color) => {
      const imageCount = Number(color.imageCount || 0);

      const assignedImages = uploadedImages.slice(
        imageIndex,
        imageIndex + imageCount
      );

      imageIndex += imageCount;

      const urlImages = Array.isArray(color.imageUrls)
        ? color.imageUrls
            .map((url) => String(url).trim())
            .filter(Boolean)
        : [];

      const sizes = Array.isArray(color.sizes)
        ? color.sizes.map((size) => ({
            size: size.size,
            stock: Number(size.stock || 0),
            price: Number(
              size.price || req.body.price || 0
            ),
            originalPrice: Number(
              size.originalPrice ||
                req.body.originalPrice ||
                0
            ),
            sku: size.sku || "",
            barcode: size.barcode || "",
          }))
        : [];

      return {
        colorName: color.colorName || "Default",
        colorCode: color.colorCode || "#000000",
        images: [...assignedImages, ...urlImages],
        sizes,
      };
    });

    const name = String(req.body.name || "").trim();
    const brand = String(req.body.brand || "").trim();
    const category = String(
      req.body.category || ""
    ).trim();

    if (!name || !brand || !category) {
      return res.status(400).json({
        success: false,
        message:
          "Product name, brand and category are required",
      });
    }

    if (colors.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "At least one colour and size variant is required",
      });
    }

    const product = await Product.create({
      name,
      brand,
      category,
      subCategory: String(
        req.body.subCategory || ""
      ).trim(),
      jewelleryFor: String(
        req.body.jewelleryFor || ""
      ).trim(),
      description: String(
        req.body.description || ""
      ).trim(),
      price: Number(req.body.price || 0),
      originalPrice: Number(
        req.body.originalPrice || 0
      ),
      featured: parseBoolean(req.body.featured),
      colors,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Create product error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Product creation failed",
    });
  }
};

// ======================================================
// GET PRODUCTS WITH SEARCH, FILTER, SORT AND PAGINATION
// ======================================================

exports.getProducts = async (req, res) => {
  try {
    const {
      search = "",
      brand = "",
      category = "",
      subCategory = "",
      minPrice = "",
      maxPrice = "",
      inStock = "",
      featured = "",
      sort = "newest",
      page = "1",
      limit = "12",
    } = req.query;

    const filter = {};

    // --------------------------------------------------
    // SEARCH
    // --------------------------------------------------

    const cleanSearch = String(search).trim();

    if (cleanSearch) {
      const searchRegex = new RegExp(
        escapeRegex(cleanSearch),
        "i"
      );

      filter.$or = [
        { name: searchRegex },
        { brand: searchRegex },
        { category: searchRegex },
        { subCategory: searchRegex },
        { description: searchRegex },
      ];
    }

    // --------------------------------------------------
    // BRAND FILTER
    // --------------------------------------------------

    if (String(brand).trim()) {
      filter.brand = {
        $regex: `^${escapeRegex(brand)}$`,
        $options: "i",
      };
    }

    // --------------------------------------------------
    // CATEGORY FILTER
    // --------------------------------------------------

    if (String(category).trim()) {
      filter.category = {
        $regex: `^${escapeRegex(category)}$`,
        $options: "i",
      };
    }

    // --------------------------------------------------
    // SUBCATEGORY FILTER
    // --------------------------------------------------

    if (String(subCategory).trim()) {
      filter.subCategory = {
        $regex: `^${escapeRegex(subCategory)}$`,
        $options: "i",
      };
    }

    // --------------------------------------------------
    // FEATURED FILTER
    // --------------------------------------------------

    if (featured === "true") {
      filter.featured = true;
    } else if (featured === "false") {
      filter.featured = false;
    }

    // --------------------------------------------------
    // STOCK FILTER
    //
    // totalStock is automatically calculated
    // in models/Product.js
    // --------------------------------------------------

    if (inStock === "true") {
      filter.totalStock = {
        $gt: 0,
      };
    } else if (inStock === "false") {
      filter.totalStock = {
        $lte: 0,
      };
    }

    // --------------------------------------------------
    // PRICE FILTER
    //
    // minimumPrice is automatically calculated
    // from all colour and size variants
    // --------------------------------------------------

    const parsedMinPrice = Number(minPrice);
    const parsedMaxPrice = Number(maxPrice);

    const hasMinPrice =
      minPrice !== "" &&
      Number.isFinite(parsedMinPrice) &&
      parsedMinPrice >= 0;

    const hasMaxPrice =
      maxPrice !== "" &&
      Number.isFinite(parsedMaxPrice) &&
      parsedMaxPrice >= 0;

    if (
      hasMinPrice &&
      hasMaxPrice &&
      parsedMinPrice > parsedMaxPrice
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Minimum price cannot be greater than maximum price",
      });
    }

    if (hasMinPrice || hasMaxPrice) {
      filter.minimumPrice = {};

      if (hasMinPrice) {
        filter.minimumPrice.$gte = parsedMinPrice;
      }

      if (hasMaxPrice) {
        filter.minimumPrice.$lte = parsedMaxPrice;
      }
    }

    // --------------------------------------------------
    // SORTING
    // --------------------------------------------------

    const sortOptions = {
      newest: {
        createdAt: -1,
      },

      oldest: {
        createdAt: 1,
      },

      nameAsc: {
        name: 1,
      },

      nameDesc: {
        name: -1,
      },

      priceLowToHigh: {
        minimumPrice: 1,
        createdAt: -1,
      },

      priceHighToLow: {
        minimumPrice: -1,
        createdAt: -1,
      },

      mostSold: {
        soldCount: -1,
        createdAt: -1,
      },

      mostViewed: {
        views: -1,
        createdAt: -1,
      },
    };

    const selectedSort =
      sortOptions[sort] || sortOptions.newest;

    // --------------------------------------------------
    // PAGINATION
    // --------------------------------------------------

    const parsedPage = Number.parseInt(page, 10);
    const parsedLimit = Number.parseInt(limit, 10);

    const currentPage =
      Number.isFinite(parsedPage) && parsedPage > 0
        ? parsedPage
        : 1;

    // The public storefront is capped at 50 per page to keep responses
    // light. The admin dashboard needs to load the entire catalog on
    // one screen, so a logged-in admin (Bearer token, role "admin") is
    // allowed a much higher limit. Any invalid/missing token is ignored
    // here rather than rejected, since this route stays public.
    let isAdminRequest = false;

    const authorizationHeader = req.headers.authorization || "";

    if (authorizationHeader.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(
          authorizationHeader.split(" ")[1],
          process.env.JWT_SECRET
        );

        isAdminRequest = decoded?.role === "admin";
      } catch (error) {
        isAdminRequest = false;
      }
    }

    const maxPageSize = isAdminRequest ? 5000 : 50;

    const pageSize =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, maxPageSize)
        : 12;

    const skip = (currentPage - 1) * pageSize;

    // --------------------------------------------------
    // DATABASE QUERY
    // --------------------------------------------------

    const [products, totalProducts] =
      await Promise.all([
        Product.find(filter)
          .sort(selectedSort)
          .skip(skip)
          .limit(pageSize)
          .lean(),

        Product.countDocuments(filter),
      ]);

    const totalPages =
      totalProducts === 0
        ? 0
        : Math.ceil(totalProducts / pageSize);

    return res.status(200).json({
      success: true,
      count: products.length,
      products,

      pagination: {
        currentPage,
        pageSize,
        totalProducts,
        totalPages,
        hasPreviousPage: currentPage > 1,
        hasNextPage:
          totalPages > 0 && currentPage < totalPages,
      },

      appliedFilters: {
        search: cleanSearch,
        brand: String(brand).trim(),
        category: String(category).trim(),
        subCategory: String(subCategory).trim(),
        minPrice: hasMinPrice
          ? parsedMinPrice
          : null,
        maxPrice: hasMaxPrice
          ? parsedMaxPrice
          : null,
        inStock,
        featured,
        sort:
          Object.prototype.hasOwnProperty.call(
            sortOptions,
            sort
          )
            ? sort
            : "newest",
      },
    });
  } catch (error) {
    console.error("Get products error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

// ======================================================
// GET SINGLE PRODUCT
// ======================================================

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(
      req.params.id
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Get single product error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
};

// ======================================================
// UPDATE PRODUCT
// ======================================================

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(
      req.params.id
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (req.body.name !== undefined) {
      product.name = String(req.body.name).trim();
    }

    if (req.body.brand !== undefined) {
      product.brand = String(req.body.brand).trim();
    }

    if (req.body.category !== undefined) {
      product.category = String(
        req.body.category
      ).trim();
    }

    if (req.body.subCategory !== undefined) {
      product.subCategory = String(
        req.body.subCategory
      ).trim();
    }

    if (req.body.jewelleryFor !== undefined) {
      product.jewelleryFor = String(
        req.body.jewelleryFor
      ).trim();
    }

    if (req.body.description !== undefined) {
      product.description = String(
        req.body.description
      ).trim();
    }

    if (req.body.price !== undefined) {
      product.price = Number(req.body.price);
    }

    if (req.body.originalPrice !== undefined) {
      product.originalPrice = Number(
        req.body.originalPrice
      );
    }

    if (req.body.featured !== undefined) {
      product.featured = parseBoolean(
        req.body.featured,
        product.featured
      );
    }

    // --------------------------------------------------
    // BASIC-INFO IMAGE EDITING
    //
    // Used by the "Edit Product" screen, which only touches
    // the main product photos (not colours/sizes/stock -
    // that stays in the Variant Editor). Images live inside
    // colors[0], so we keep whichever existing images the
    // admin didn't remove, upload any newly chosen files to
    // Cloudinary, and merge them into colors[0].images.
    // --------------------------------------------------

    if (req.body.existingImages !== undefined) {
      let keptImages = req.body.existingImages;

      if (typeof keptImages === "string") {
        try {
          keptImages = JSON.parse(keptImages);
        } catch {
          return res.status(400).json({
            success: false,
            message: "Invalid existingImages data",
          });
        }
      }

      if (!Array.isArray(keptImages)) {
        keptImages = [];
      }

      const uploadedImages = [];

      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const result = await cloudinary.uploader.upload(
            `data:${file.mimetype};base64,${file.buffer.toString(
              "base64"
            )}`,
            {
              folder: "products",
            }
          );

          uploadedImages.push(result.secure_url);
        }
      }

      const mergedImages = [
        ...keptImages,
        ...uploadedImages,
      ];

      if (
        Array.isArray(product.colors) &&
        product.colors.length > 0
      ) {
        product.colors[0].images = mergedImages;
      } else {
        product.colors = [
          {
            colorName: "Default",
            colorCode: "#000000",
            images: mergedImages,
            sizes: [],
          },
        ];
      }
    }

    if (req.body.colors !== undefined) {
      let updatedColors = req.body.colors;

      if (typeof updatedColors === "string") {
        try {
          updatedColors = JSON.parse(updatedColors);
        } catch {
          return res.status(400).json({
            success: false,
            message: "Invalid colours data",
          });
        }
      }

      if (!Array.isArray(updatedColors)) {
        return res.status(400).json({
          success: false,
          message: "Colours must be an array",
        });
      }

      product.colors = updatedColors.map((color) => ({
        colorName: color.colorName || "Default",
        colorCode: color.colorCode || "#000000",
        images: Array.isArray(color.images)
          ? color.images
          : [],
        sizes: Array.isArray(color.sizes)
          ? color.sizes.map((size) => ({
              size: size.size,
              stock: Number(size.stock || 0),
              price: Number(size.price || 0),
              originalPrice: Number(
                size.originalPrice || 0
              ),
              sku: size.sku || "",
              barcode: size.barcode || "",
            }))
          : [],
      }));
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("Update product error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Product update failed",
    });
  }
};

// ======================================================
// DELETE PRODUCT
// ======================================================

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(
      req.params.id
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Product deletion failed",
    });
  }
};

// ======================================================
// DASHBOARD ANALYTICS
// ======================================================

exports.dashboardAnalytics = async (req, res) => {
  try {
    const products = await Product.find().lean();

    const totalProducts = products.length;

    let totalStock = 0;
    let totalInventoryValue = 0;

    const categoryMap = {};
    const brandMap = {};
    const colorMap = {};
    const sizeMap = {};
    const lowStockProducts = [];

    products.forEach((product) => {
      const categoryName =
        product.category || "Uncategorized";

      const brandName = product.brand || "No Brand";

      categoryMap[categoryName] =
        (categoryMap[categoryName] || 0) + 1;

      if (!brandMap[brandName]) {
        brandMap[brandName] = {
          products: 0,
          stock: 0,
          value: 0,
        };
      }

      brandMap[brandName].products += 1;

      let productTotalStock = 0;

      product.colors?.forEach((color) => {
        const colorName =
          color.colorName || "Default";

        if (!colorMap[colorName]) {
          colorMap[colorName] = {
            count: 0,
            code: color.colorCode || "#000000",
          };
        }

        colorMap[colorName].count += 1;

        color.sizes?.forEach((size) => {
          const sizeStock = Number(size.stock || 0);

          const sizePrice = Number(
            size.price || product.price || 0
          );

          productTotalStock += sizeStock;
          totalStock += sizeStock;

          totalInventoryValue +=
            sizeStock * sizePrice;

          brandMap[brandName].stock += sizeStock;

          brandMap[brandName].value +=
            sizeStock * sizePrice;

          const sizeName = size.size || "Default";

          sizeMap[sizeName] =
            (sizeMap[sizeName] || 0) + sizeStock;
        });
      });

      if (productTotalStock <= 5) {
        lowStockProducts.push({
          _id: product._id,
          name: product.name,
          brand: brandName,
          totalStock: productTotalStock,
        });
      }
    });

    const totalBrands =
      Object.keys(brandMap).length;

    const categoryAnalytics = Object.keys(
      categoryMap
    ).map((key) => ({
      name: key,
      count: categoryMap[key],
      percentage:
        totalProducts > 0
          ? Number(
              (
                (categoryMap[key] /
                  totalProducts) *
                100
              ).toFixed(0)
            )
          : 0,
    }));

    const brandAnalytics = Object.keys(
      brandMap
    ).map((key) => ({
      name: key,
      products: brandMap[key].products,
      stock: brandMap[key].stock,
      value: brandMap[key].value,
    }));

    const colorAnalytics = Object.keys(
      colorMap
    ).map((key) => ({
      name: key,
      count: colorMap[key].count,
      code: colorMap[key].code,
    }));

    const sizeAnalytics = Object.keys(sizeMap).map(
      (key) => ({
        name: key,
        stock: sizeMap[key],
      })
    );

    return res.status(200).json({
      success: true,
      totalProducts,
      totalBrands,
      totalStock,
      totalInventoryValue,
      categoryAnalytics,
      brandAnalytics,
      colorAnalytics,
      sizeAnalytics,
      lowStockProducts,
    });
  } catch (error) {
    console.error("Dashboard analytics error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Dashboard analytics could not be generated",
    });
  }
};

// ======================================================
// GET DISTINCT PRODUCT BRANDS
// ======================================================

exports.getBrands = async (req, res) => {
  try {
    const brands = await Product.distinct("brand");

    const cleanedBrands = brands
      .filter(Boolean)
      .map((brand) => String(brand).trim())
      .filter(Boolean)
      .sort((first, second) =>
        first.localeCompare(second)
      );

    return res.status(200).json({
      success: true,
      count: cleanedBrands.length,
      brands: cleanedBrands,
    });
  } catch (error) {
    console.error("Get product brands error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch brands",
    });
  }
};

// ======================================================
// IMPORT PRODUCTS FROM EXCEL
// ======================================================

exports.importProductsExcel = async (req, res) => {
  let uploadedFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Excel file is required",
      });
    }

    uploadedFilePath = req.file.path;

    const workbook = xlsx.readFile(uploadedFilePath);
    const sheetName = workbook.SheetNames[0];

    const rows = xlsx.utils.sheet_to_json(
      workbook.Sheets[sheetName]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Excel file is empty",
      });
    }

    const productsMap = {};

    rows.forEach((row) => {
      // Normalize this row's headers first (trims spaces, lower-cases,
      // collapses "Sub Category " / "sub  category" / etc. into one
      // predictable key) so every alias lookup below just works.
      const normalizedRow = normalizeExcelRowKeys(row);

      const name = String(
        getExcelValue(normalizedRow, ["name"])
      ).trim();

      const brand = String(
        getExcelValue(normalizedRow, ["brand"])
      ).trim();

      const rawCategory = String(
        getExcelValue(normalizedRow, ["category"])
      ).trim();

      const rawSubCategory = String(
        getExcelValue(normalizedRow, [
          "subcategory",
          "sub category",
        ])
      ).trim();

      // "male female" is the gender/audience column used by supplier
      // sheets (male / female / unisex / kids). It doubles as a hint
      // for resolving loose categories (see resolveExcelCategory) and,
      // for Jewellery rows, as the jewelleryFor value.
      const genderOrAudience = String(
        getExcelValue(normalizedRow, [
          "jewelleryfor",
          "jewellery for",
          "male female",
          "gender",
        ])
      ).trim();

      const category = resolveExcelCategory(
        rawCategory,
        genderOrAudience
      );

      // Keep the sheet's own sub category text as-is (subCategory is
      // free text in the schema, no enum restriction) so nothing about
      // the product's original grouping ("hair color tube", etc.) is
      // lost even when the top-level category had to be resolved.
      const subCategory = rawSubCategory;

      const jewelleryFor =
        category === "Jewellery" ? genderOrAudience : "";

      const description = String(
        getExcelValue(normalizedRow, ["description"])
      ).trim();

      const originalPrice = Number(
        getExcelValue(normalizedRow, [
          "originalprice",
          "original price",
          "origional price",
          "origional  price",
        ]) || 0
      );

      // Some supplier sheets only fill in one price column (their
      // "origional price"), leaving "price" blank because there's no
      // separate discounted price. Fall back to originalPrice so the
      // product doesn't import at ₹0.
      const price = Number(
        getExcelValue(normalizedRow, ["price"]) ||
          originalPrice ||
          0
      );

      const featured =
        String(
          getExcelValue(normalizedRow, ["featured"])
        ).toLowerCase() === "true";

      const colorName = String(
        getExcelValue(normalizedRow, [
          "colorname",
          "color name",
        ]) || "Default"
      ).trim();

      const colorCode = String(
        getExcelValue(normalizedRow, [
          "colorcode",
          "color code",
        ]) || "#000000"
      ).trim();

      const image = String(
        getExcelValue(normalizedRow, ["image", "images"])
      ).trim();

      const size = String(
        getExcelValue(normalizedRow, ["size"]) || "Default"
      ).trim();

      const stock = Number(
        getExcelValue(normalizedRow, ["stock"]) || 0
      );

      const sizePrice = Number(
        getExcelValue(normalizedRow, [
          "sizeprice",
          "size price",
        ]) || price
      );

      const sizeOriginalPrice = Number(
        getExcelValue(normalizedRow, [
          "sizeoriginalprice",
          "size original price",
        ]) || originalPrice
      );

      const sku = String(
        getExcelValue(normalizedRow, ["sku"])
      ).trim();

      const barcode = String(
        getExcelValue(normalizedRow, ["barcode"])
      ).trim();

      if (
        !name ||
        !brand ||
        !category ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        return;
      }

      const productKey = [
        name,
        brand,
        category,
        subCategory,
      ]
        .join("-")
        .toLowerCase();

      if (!productsMap[productKey]) {
        productsMap[productKey] = {
          name,
          brand,
          category,
          subCategory,
          jewelleryFor,
          description,
          price,
          originalPrice,
          featured,
          colors: [],
        };
      }

      let color =
        productsMap[productKey].colors.find(
          (item) =>
            item.colorName.toLowerCase() ===
            colorName.toLowerCase()
        );

      if (!color) {
        color = {
          colorName,
          colorCode,
          images: image ? [image] : [],
          sizes: [],
        };

        productsMap[productKey].colors.push(color);
      }

      if (image && !color.images.includes(image)) {
        color.images.push(image);
      }

      color.sizes.push({
        size,
        stock:
          Number.isFinite(stock) && stock >= 0
            ? stock
            : 0,
        price:
          Number.isFinite(sizePrice) &&
          sizePrice >= 0
            ? sizePrice
            : price,
        originalPrice:
          Number.isFinite(sizeOriginalPrice) &&
          sizeOriginalPrice >= 0
            ? sizeOriginalPrice
            : originalPrice,
        sku,
        barcode,
      });
    });

    const products = Object.values(productsMap);

    if (products.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No valid products were found in the Excel file",
      });
    }

    const createdProducts =
      await Product.insertMany(products);

    return res.status(201).json({
      success: true,
      message: "Products imported successfully",
      count: createdProducts.length,
      products: createdProducts,
    });
  } catch (error) {
    console.error("Excel import error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Excel import failed",
    });
  } finally {
    if (
      uploadedFilePath &&
      fs.existsSync(uploadedFilePath)
    ) {
      try {
        fs.unlinkSync(uploadedFilePath);
      } catch (fileError) {
        console.error(
          "Failed to remove temporary Excel file:",
          fileError
        );
      }
    }
  }
};

// ======================================================
// TRACK PRODUCT VIEW
// POST /api/products/:productId/view
// ======================================================

exports.trackProductView = async (
  req,
  res
) => {
  try {
    const { productId } = req.params;

    const userId =
      req.body.userId ||
      req.body.customerId ||
      null;

    if (
      !mongoose.Types.ObjectId.isValid(productId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product =
      await Product.findByIdAndUpdate(
        productId,
        {
          $inc: {
            views: 1,
          },
        },
        {
          new: true,
        }
      ).select("_id views");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (
      userId &&
      mongoose.Types.ObjectId.isValid(userId)
    ) {
      await User.findByIdAndUpdate(userId, {
        $pull: {
          recentlyViewed: productId,
        },
      });

      await User.findByIdAndUpdate(userId, {
        $push: {
          recentlyViewed: {
            $each: [productId],
            $position: 0,
            $slice: 20,
          },
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product view recorded",
      views: product.views,
    });
  } catch (error) {
    console.error(
      "Track product view error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Product view could not be recorded",
    });
  }
};

// ======================================================
// GET PRODUCT RECOMMENDATIONS
// GET /api/products/:productId/recommendations
// ======================================================

exports.getProductRecommendations = async (
  req,
  res
) => {
  try {
    const { productId } = req.params;

    const requestedLimit = Number.parseInt(
      req.query.limit,
      10
    );

    const limit =
      Number.isFinite(requestedLimit) &&
      requestedLimit > 0
        ? Math.min(requestedLimit, 24)
        : 12;

    if (
      !mongoose.Types.ObjectId.isValid(productId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const sourceProduct =
      await Product.findById(productId).lean();

    if (!sourceProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const baseFilter =
      createAvailableProductFilter({
        excludedProductIds: [productId],
      });

    const recommendationConditions = [];

    if (sourceProduct.subCategory) {
      recommendationConditions.push({
        subCategory: sourceProduct.subCategory,
      });
    }

    if (sourceProduct.category) {
      recommendationConditions.push({
        category: sourceProduct.category,
      });
    }

    if (sourceProduct.brand) {
      recommendationConditions.push({
        brand: sourceProduct.brand,
      });
    }

    if (sourceProduct.jewelleryFor) {
      recommendationConditions.push({
        jewelleryFor:
          sourceProduct.jewelleryFor,
      });
    }

    const sourcePrice = Number(
      sourceProduct.minimumPrice ||
        sourceProduct.price ||
        0
    );

    if (sourcePrice > 0) {
      recommendationConditions.push({
        minimumPrice: {
          $gte: Math.max(
            0,
            sourcePrice * 0.5
          ),

          $lte: sourcePrice * 1.5,
        },
      });
    }

    let candidateProducts = [];

    if (
      recommendationConditions.length > 0
    ) {
      candidateProducts =
        await Product.find({
          ...baseFilter,
          $or: recommendationConditions,
        })
          .select(
            getRecommendationProductFields()
          )
          .limit(100)
          .lean();
    }

    if (candidateProducts.length < limit) {
      const fallbackProducts =
        await Product.find(baseFilter)
          .select(
            getRecommendationProductFields()
          )
          .sort({
            averageRating: -1,
            soldCount: -1,
            views: -1,
            createdAt: -1,
          })
          .limit(50)
          .lean();

      candidateProducts = [
        ...candidateProducts,
        ...fallbackProducts,
      ];
    }

    const scoredProducts =
      candidateProducts
        .map((product) => ({
          ...product,

          recommendationScore:
            calculateRecommendationScore(
              product,
              sourceProduct
            ),
        }))
        .sort((first, second) => {
          if (
            second.recommendationScore !==
            first.recommendationScore
          ) {
            return (
              second.recommendationScore -
              first.recommendationScore
            );
          }

          if (
            Number(
              second.averageRating || 0
            ) !==
            Number(first.averageRating || 0)
          ) {
            return (
              Number(
                second.averageRating || 0
              ) -
              Number(
                first.averageRating || 0
              )
            );
          }

          return (
            Number(second.soldCount || 0) -
            Number(first.soldCount || 0)
          );
        });

    const recommendations =
      removeDuplicateProducts(
        scoredProducts,
        limit
      );

    return res.status(200).json({
      success: true,
      sourceProductId: productId,
      count: recommendations.length,
      recommendations,
    });
  } catch (error) {
    console.error(
      "Product recommendations error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Recommendations could not be loaded",
    });
  }
};

// ======================================================
// GET PERSONALIZED CUSTOMER RECOMMENDATIONS
// GET /api/products/recommendations/customer/:customerId
// ======================================================
exports.getCustomerRecommendations =
  async (req, res) => {
    try {
      const { customerId } = req.params;

      const requestedLimit = Number.parseInt(
        req.query.limit,
        10
      );

      const limit =
        Number.isFinite(requestedLimit) &&
        requestedLimit > 0
          ? Math.min(requestedLimit, 36)
          : 12;

      if (
        !mongoose.Types.ObjectId.isValid(
          customerId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID",
        });
      }

      const customer = await User.findById(
        customerId
      )
        .select("recentlyViewed")
        .populate({
          path: "recentlyViewed",

          select: [
            "category",
            "subCategory",
            "brand",
            "jewelleryFor",
            "minimumPrice",
            "price",
          ].join(" "),
        })
        .lean();

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      const recentlyViewed = Array.isArray(
        customer.recentlyViewed
      )
        ? customer.recentlyViewed.filter(Boolean)
        : [];

      const excludedProductIds =
        recentlyViewed.map(
          (product) => product._id
        );

      const baseFilter =
        createAvailableProductFilter({
          excludedProductIds,
        });

      if (recentlyViewed.length === 0) {
        const popularProducts =
          await Product.find(baseFilter)
            .select(
              getRecommendationProductFields()
            )
            .sort({
              averageRating: -1,
              soldCount: -1,
              views: -1,
              createdAt: -1,
            })
            .limit(limit)
            .lean();

        return res.status(200).json({
          success: true,
          personalized: false,
          reason:
            "Popular products for new customers",
          count: popularProducts.length,
          recommendations: popularProducts,
        });
      }

      const categories = [
        ...new Set(
          recentlyViewed
            .map((product) => product.category)
            .filter(Boolean)
        ),
      ];

      const subCategories = [
        ...new Set(
          recentlyViewed
            .map(
              (product) =>
                product.subCategory
            )
            .filter(Boolean)
        ),
      ];

      const brands = [
        ...new Set(
          recentlyViewed
            .map((product) => product.brand)
            .filter(Boolean)
        ),
      ];

      const jewelleryTypes = [
        ...new Set(
          recentlyViewed
            .map(
              (product) =>
                product.jewelleryFor
            )
            .filter(Boolean)
        ),
      ];

      const preferenceConditions = [];

      if (categories.length > 0) {
        preferenceConditions.push({
          category: {
            $in: categories,
          },
        });
      }

      if (subCategories.length > 0) {
        preferenceConditions.push({
          subCategory: {
            $in: subCategories,
          },
        });
      }

      if (brands.length > 0) {
        preferenceConditions.push({
          brand: {
            $in: brands,
          },
        });
      }

      if (jewelleryTypes.length > 0) {
        preferenceConditions.push({
          jewelleryFor: {
            $in: jewelleryTypes,
          },
        });
      }

      let candidates = [];

      if (preferenceConditions.length > 0) {
        candidates = await Product.find({
          ...baseFilter,
          $or: preferenceConditions,
        })
          .select(
            getRecommendationProductFields()
          )
          .limit(100)
          .lean();
      }

      if (candidates.length < limit) {
        const fallbackProducts =
          await Product.find(baseFilter)
            .select(
              getRecommendationProductFields()
            )
            .sort({
              averageRating: -1,
              soldCount: -1,
              views: -1,
              createdAt: -1,
            })
            .limit(50)
            .lean();

        candidates = [
          ...candidates,
          ...fallbackProducts,
        ];
      }

      const recommendations =
        removeDuplicateProducts(
          candidates.sort(
            (first, second) => {
              let firstScore = 0;
              let secondScore = 0;

              if (
                categories.includes(
                  first.category
                )
              ) {
                firstScore += 30;
              }

              if (
                categories.includes(
                  second.category
                )
              ) {
                secondScore += 30;
              }

              if (
                subCategories.includes(
                  first.subCategory
                )
              ) {
                firstScore += 35;
              }

              if (
                subCategories.includes(
                  second.subCategory
                )
              ) {
                secondScore += 35;
              }

              if (
                brands.includes(first.brand)
              ) {
                firstScore += 20;
              }

              if (
                brands.includes(second.brand)
              ) {
                secondScore += 20;
              }

              firstScore +=
                Number(
                  first.averageRating || 0
                ) * 2;

              secondScore +=
                Number(
                  second.averageRating || 0
                ) * 2;

              firstScore += Math.min(
                Number(first.soldCount || 0) /
                  10,
                10
              );

              secondScore += Math.min(
                Number(
                  second.soldCount || 0
                ) / 10,
                10
              );

              return secondScore - firstScore;
            }
          ),
          limit
        );

      return res.status(200).json({
        success: true,
        personalized: true,
        reason:
          "Based on recently viewed products",
        count: recommendations.length,
        recommendations,
      });
    } catch (error) {
      console.error(
        "Customer recommendations error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Personalized recommendations could not be loaded",
      });
    }
  };

// ======================================================
// CUSTOMERS ALSO BOUGHT
// GET /api/products/:productId/frequently-bought
// ======================================================

exports.getFrequentlyBoughtTogether = async (req, res) => {
  try {
    const { productId } = req.params;

    const requestedLimit = Number.parseInt(
      req.query.limit,
      10
    );

    const limit =
      Number.isFinite(requestedLimit) &&
      requestedLimit > 0
        ? Math.min(requestedLimit, 12)
        : 8;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const sourceProduct = await Product.findById(
      productId
    ).select("_id category subCategory brand");

    if (!sourceProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const productObjectId =
      new mongoose.Types.ObjectId(productId);

    const result = await Order.aggregate([
      {
        $match: {
          status: {
            $in: [
              "Confirmed",
              "Processing",
              "Packed",
              "Shipped",
              "Out for Delivery",
              "Delivered",
              "confirmed",
              "processing",
              "packed",
              "shipped",
              "out for delivery",
              "delivered",
            ],
          },

          "items.product": productObjectId,
        },
      },

      {
        $unwind: "$items",
      },

      {
        $match: {
          "items.product": {
            $ne: productObjectId,
          },
        },
      },

      {
        $group: {
          _id: "$items.product",

          purchaseCount: {
            $sum: {
              $ifNull: ["$items.quantity", 1],
            },
          },

          orderCount: {
            $sum: 1,
          },
        },
      },

      {
        $sort: {
          orderCount: -1,
          purchaseCount: -1,
        },
      },

      {
        $limit: limit * 3,
      },

      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },

      {
        $unwind: "$product",
      },

      {
        $match: {
          "product.status": "active",
          "product.totalStock": {
            $gt: 0,
          },
        },
      },

      {
        $project: {
          _id: "$product._id",
          name: "$product.name",
          brand: "$product.brand",
          category: "$product.category",
          subCategory:
            "$product.subCategory",
          price: "$product.price",
          originalPrice:
            "$product.originalPrice",
          minimumPrice:
            "$product.minimumPrice",
          minimumOriginalPrice:
            "$product.minimumOriginalPrice",
          totalStock:
            "$product.totalStock",
          averageRating:
            "$product.averageRating",
          totalReviews:
            "$product.totalReviews",
          soldCount:
            "$product.soldCount",
          views: "$product.views",
          colors: "$product.colors",
          brandImage:
            "$product.brandImage",
          featured:
            "$product.featured",
          orderCount: 1,
          purchaseCount: 1,
        },
      },

      {
        $limit: limit,
      },
    ]);

    if (result.length > 0) {
      return res.status(200).json({
        success: true,
        basedOnOrders: true,
        count: result.length,
        products: result,
      });
    }

    const fallbackProducts = await Product.find({
      _id: {
        $ne: productObjectId,
      },

      status: "active",

      totalStock: {
        $gt: 0,
      },

      $or: [
        {
          category: sourceProduct.category,
        },
        {
          subCategory:
            sourceProduct.subCategory,
        },
        {
          brand: sourceProduct.brand,
        },
      ],
    })
      .select(
        [
          "name",
          "brand",
          "category",
          "subCategory",
          "price",
          "originalPrice",
          "minimumPrice",
          "minimumOriginalPrice",
          "totalStock",
          "averageRating",
          "totalReviews",
          "soldCount",
          "views",
          "colors",
          "brandImage",
          "featured",
        ].join(" ")
      )
      .sort({
        soldCount: -1,
        averageRating: -1,
        views: -1,
      })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      basedOnOrders: false,
      count: fallbackProducts.length,
      products: fallbackProducts,
    });
  } catch (error) {
    console.error(
      "Frequently bought products error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Frequently bought products could not be loaded",
    });
  }
};