const mongoose = require("mongoose");
const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");

async function updateProductReviewSummary(productId) {
  const rows = await Review.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        status: "published",
      },
    },
    {
      $group: {
        _id: "$product",
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
        ratings: { $push: "$rating" },
      },
    },
  ]);

  const summary = rows[0] || {
    averageRating: 0,
    totalReviews: 0,
    ratings: [],
  };

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  summary.ratings.forEach((rating) => {
    distribution[rating] = (distribution[rating] || 0) + 1;
  });

  await Product.findByIdAndUpdate(productId, {
    averageRating: Number(summary.averageRating.toFixed(1)),
    totalReviews: summary.totalReviews,
    ratingDistribution: distribution,
  });
}

async function hasPurchased(userId, productId) {
  if (!userId) return false;

 const order = await Order.findOne({
  customerId: userId,

  status: {
    $in: [
      "Delivered",
      "delivered",
    ],
  },

  "items.product": productId,
}).lean();

  return Boolean(order);
}

exports.createReview = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.userId || req.body.userId;
    const { productId, userName, rating, title, comment, images = [] } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Login required" });
    }

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    if (!userName?.trim() || !comment?.trim() || !Number(rating)) {
      return res.status(400).json({
        success: false,
        message: "Name, rating and review comment are required",
      });
    }

    const product = await Product.findById(productId).select("_id");
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const review = await Review.create({
      product: productId,
      user: userId,
      userName: userName.trim(),
      rating: Number(rating),
      title: String(title || "").trim(),
      comment: comment.trim(),
      images: Array.isArray(images) ? images.filter(Boolean) : [],
      verifiedPurchase: await hasPurchased(userId, productId),
    });

    await updateProductReviewSummary(productId);

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      review,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product",
      });
    }

    console.error("Create review error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 50);
    const rating = Number(req.query.rating || 0);
    const sort = req.query.sort || "newest";

    const filter = { product: productId, status: "published" };
    if (rating >= 1 && rating <= 5) filter.rating = rating;

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      highest: { rating: -1, createdAt: -1 },
      lowest: { rating: 1, createdAt: -1 },
      mostHelpful: { likes: -1, createdAt: -1 },
    };

    const [reviews, totalReviews, product] = await Promise.all([
      Review.find(filter)
        .sort(sortMap[sort] || sortMap.newest)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
      Product.findById(productId)
        .select("averageRating totalReviews ratingDistribution")
        .lean(),
    ]);

    return res.json({
      success: true,
      reviews,
      summary: {
        averageRating: product?.averageRating || 0,
        totalReviews: product?.totalReviews || 0,
        ratingDistribution: product?.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      },
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalReviews / limit),
        totalReviews,
      },
    });
  } catch (error) {
    console.error("Get reviews error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.userId || req.body.userId;
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    if (String(review.user) !== String(userId)) {
      return res.status(403).json({ success: false, message: "You can edit only your own review" });
    }

    if (req.body.rating !== undefined) review.rating = Number(req.body.rating);
    if (req.body.title !== undefined) review.title = String(req.body.title).trim();
    if (req.body.comment !== undefined) review.comment = String(req.body.comment).trim();
    if (Array.isArray(req.body.images)) review.images = req.body.images.filter(Boolean);

    await review.save();
    await updateProductReviewSummary(review.product);

    return res.json({ success: true, message: "Review updated", review });
  } catch (error) {
    console.error("Update review error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.userId || req.body.userId;
    const isAdmin = req.user?.role === "admin";
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    if (!isAdmin && String(review.user) !== String(userId)) {
      return res.status(403).json({ success: false, message: "You cannot delete this review" });
    }

    const productId = review.product;
    await review.deleteOne();
    await updateProductReviewSummary(productId);

    return res.json({ success: true, message: "Review deleted" });
  } catch (error) {
    console.error("Delete review error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleHelpful = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.userId || req.body.userId;
    const { type } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) return res.status(404).json({ success: false, message: "Review not found" });
    if (!userId) return res.status(401).json({ success: false, message: "Login required" });

    review.likes = review.likes.filter((id) => String(id) !== String(userId));
    review.dislikes = review.dislikes.filter((id) => String(id) !== String(userId));

    if (type === "like") review.likes.push(userId);
    if (type === "dislike") review.dislikes.push(userId);

    await review.save();

    return res.json({
      success: true,
      likes: review.likes.length,
      dislikes: review.dislikes.length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllReviewsForAdmin = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = {};

    if (req.query.rating) filter.rating = Number(req.query.rating);
    if (req.query.status) filter.status = req.query.status;

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate("product", "name brand minimumPrice")
        .populate("user", "name phone email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      reviews,
      pagination: { currentPage: page, totalPages: Math.ceil(total / limit), total },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.changeReviewStatus = async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );

    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    await updateProductReviewSummary(review.product);
    return res.json({ success: true, review });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
