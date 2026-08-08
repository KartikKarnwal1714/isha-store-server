const express = require("express");

const router = express.Router();

const Order = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");
const Brand = require("../models/Brand");
const {
  protect,
  requireAdmin,
} = require("../middleware/authMiddleware");

// ======================================================
// HELPERS
// ======================================================

const REVENUE_ORDER_STATUSES = [
  "Confirmed",
  "Processing",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
];

const roundMoney = (value) => {
  return Number(Number(value || 0).toFixed(2));
};

const getStartOfDay = (date = new Date()) => {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
};

const getStartOfMonth = (date = new Date()) => {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
};

const getStartOfYear = (date = new Date()) => {
  return new Date(
    date.getFullYear(),
    0,
    1
  );
};

// ======================================================
// GET ADMIN DASHBOARD
// GET /api/dashboard
// ======================================================

router.get(
  "/",
  protect,
  requireAdmin,
  async (req, res) => {
  try {
    const now = new Date();

    const startOfDay = getStartOfDay(now);
    const startOfMonth = getStartOfMonth(now);
    const startOfYear = getStartOfYear(now);

    const [
      allOrders,
      products,
      totalCustomers,
      totalBrands,
    ] = await Promise.all([
      Order.find()
        .populate(
          "customerId",
          "name phone email"
        )
        .sort({ createdAt: -1 })
        .lean(),

      Product.find().lean(),

      User.countDocuments(),

      Brand.countDocuments(),
    ]);

    // ==================================================
    // ORDER COLLECTIONS
    // ==================================================

    const todayOrders = allOrders.filter(
      (order) =>
        new Date(order.createdAt) >= startOfDay
    );

    const monthlyOrders = allOrders.filter(
      (order) =>
        new Date(order.createdAt) >= startOfMonth
    );

    const yearlyOrders = allOrders.filter(
      (order) =>
        new Date(order.createdAt) >= startOfYear
    );

    const revenueOrders = allOrders.filter(
      (order) =>
        REVENUE_ORDER_STATUSES.includes(
          order.orderStatus
        )
    );

    const deliveredOrders = allOrders.filter(
      (order) =>
        order.orderStatus === "Delivered"
    );

    const cancelledOrders = allOrders.filter(
      (order) =>
        order.orderStatus === "Cancelled"
    );

    const pendingOrders = allOrders.filter(
      (order) =>
        [
          "Pending",
          "Confirmed",
          "Processing",
          "Packed",
          "Shipped",
          "Out for Delivery",
        ].includes(order.orderStatus)
    );

    const returnRequestedOrders =
      allOrders.filter((order) =>
        [
          "Return Requested",
          "Return Approved",
        ].includes(order.orderStatus)
      );

    const returnedOrders = allOrders.filter(
      (order) =>
        order.orderStatus === "Returned"
    );

    // ==================================================
    // REVENUE
    // ==================================================

    const calculateRevenue = (orders) =>
      orders
        .filter((order) =>
          REVENUE_ORDER_STATUSES.includes(
            order.orderStatus
          )
        )
        .reduce(
          (sum, order) =>
            sum + Number(order.total || 0),
          0
        );

    const todaysRevenue = calculateRevenue(
      todayOrders
    );

    const monthlyRevenue = calculateRevenue(
      monthlyOrders
    );

    const yearlyRevenue = calculateRevenue(
      yearlyOrders
    );

    const totalRevenue = calculateRevenue(
      revenueOrders
    );

    const averageOrderValue =
      revenueOrders.length > 0
        ? totalRevenue / revenueOrders.length
        : 0;

    const cancellationRate =
      allOrders.length > 0
        ? (cancelledOrders.length /
            allOrders.length) *
          100
        : 0;

    const returnRate =
      deliveredOrders.length > 0
        ? (returnedOrders.length /
            deliveredOrders.length) *
          100
        : 0;

    // ==================================================
    // PAYMENT ANALYTICS
    // ==================================================

    const paymentAnalytics = {
      pending: 0,
      paid: 0,
      failed: 0,
      refundPending: 0,
      refunded: 0,
    };

    allOrders.forEach((order) => {
      switch (order.paymentStatus) {
        case "Paid":
          paymentAnalytics.paid += 1;
          break;

        case "Failed":
          paymentAnalytics.failed += 1;
          break;

        case "Refund Pending":
          paymentAnalytics.refundPending += 1;
          break;

        case "Refunded":
          paymentAnalytics.refunded += 1;
          break;

        default:
          paymentAnalytics.pending += 1;
      }
    });

    // ==================================================
    // INVENTORY ANALYTICS
    // ==================================================

    let totalStock = 0;
    let totalInventoryValue = 0;

    const categoryMap = {};
    const brandMap = {};
    const colorMap = {};
    const sizeMap = {};

    const lowStockProducts = [];
    const outOfStockProducts = [];

    products.forEach((product) => {
      const productStock = Number(
        product.totalStock || 0
      );

      const productPrice = Number(
        product.minimumPrice ||
          product.price ||
          0
      );

      const productInventoryValue =
        productStock * productPrice;

      totalStock += productStock;

      totalInventoryValue +=
        productInventoryValue;

      const category =
        product.category || "Other";

      categoryMap[category] =
        (categoryMap[category] || 0) + 1;

      const brand =
        product.brand || "No Brand";

      if (!brandMap[brand]) {
        brandMap[brand] = {
          name: brand,
          products: 0,
          stock: 0,
          value: 0,
        };
      }

      brandMap[brand].products += 1;
      brandMap[brand].stock += productStock;
      brandMap[brand].value +=
        productInventoryValue;

      product.colors?.forEach((color) => {
        const colorName =
          color.colorName || "Unknown";

        if (!colorMap[colorName]) {
          colorMap[colorName] = {
            name: colorName,
            code:
              color.colorCode ||
              "#dddddd",
            count: 0,
          };
        }

        colorMap[colorName].count += 1;

        color.sizes?.forEach((size) => {
          const sizeName =
            size.size || "Default";

          if (!sizeMap[sizeName]) {
            sizeMap[sizeName] = {
              name: sizeName,
              stock: 0,
            };
          }

          sizeMap[sizeName].stock +=
            Number(size.stock || 0);
        });
      });

      if (
        productStock > 0 &&
        productStock <= 5
      ) {
        lowStockProducts.push({
          _id: product._id,
          name: product.name,
          brand: product.brand,
          totalStock: productStock,
          minimumPrice: productPrice,
        });
      }

      if (productStock <= 0) {
        outOfStockProducts.push({
          _id: product._id,
          name: product.name,
          brand: product.brand,
          totalStock: 0,
        });
      }
    });

    const totalProducts = products.length;

    const categoryAnalytics =
      Object.entries(categoryMap).map(
        ([name, count]) => ({
          name,
          count,

          percentage:
            totalProducts > 0
              ? Number(
                  (
                    (count /
                      totalProducts) *
                    100
                  ).toFixed(1)
                )
              : 0,
        })
      );

    const brandAnalytics =
      Object.values(brandMap)
        .map((brand) => ({
          ...brand,
          value: roundMoney(brand.value),
        }))
        .sort(
          (first, second) =>
            second.value - first.value
        );

    const colorAnalytics =
      Object.values(colorMap).sort(
        (first, second) =>
          second.count - first.count
      );

    const sizeAnalytics =
      Object.values(sizeMap).sort(
        (first, second) =>
          second.stock - first.stock
      );

    // ==================================================
    // PRODUCT SALES
    // ==================================================

    const productSales = {};

    revenueOrders.forEach((order) => {
      order.products?.forEach((item) => {
        const key = String(
          item.productId || item.name
        );

        if (!productSales[key]) {
          productSales[key] = {
            productId:
              item.productId || null,

            name: item.name,

            image: item.image || "",

            quantity: 0,

            revenue: 0,

            orderCount: 0,
          };
        }

        const quantity = Number(
          item.quantity || 0
        );

        const itemRevenue =
          Number(item.price || 0) *
          quantity;

        productSales[key].quantity +=
          quantity;

        productSales[key].revenue +=
          itemRevenue;

        productSales[key].orderCount += 1;
      });
    });

    const topSellingProducts =
      Object.values(productSales)
        .sort(
          (first, second) =>
            second.quantity -
            first.quantity
        )
        .slice(0, 10)
        .map((product) => ({
          ...product,
          revenue: roundMoney(
            product.revenue
          ),
        }));

    // ==================================================
    // CUSTOMER ANALYTICS
    // ==================================================

    const customerSales = {};

    revenueOrders.forEach((order) => {
      const customerKey = String(
        order.customerId?._id ||
          order.customerId ||
          order.customerPhone ||
          order.phone ||
          order.customerName
      );

      if (!customerSales[customerKey]) {
        customerSales[customerKey] = {
          customerId:
            order.customerId?._id ||
            order.customerId ||
            null,

          name:
            order.customerId?.name ||
            order.customerName ||
            "Customer",

          phone:
            order.customerId?.phone ||
            order.customerPhone ||
            order.phone ||
            "",

          email:
            order.customerId?.email ||
            order.email ||
            "",

          orders: 0,

          totalSpent: 0,
        };
      }

      customerSales[customerKey].orders += 1;

      customerSales[customerKey]
        .totalSpent += Number(
        order.total || 0
      );
    });

    const topCustomers =
      Object.values(customerSales)
        .sort(
          (first, second) =>
            second.totalSpent -
            first.totalSpent
        )
        .slice(0, 10)
        .map((customer) => ({
          ...customer,

          totalSpent: roundMoney(
            customer.totalSpent
          ),
        }));

    // ==================================================
    // MONTHLY SALES: CURRENT YEAR
    // ==================================================

    const monthlySales = Array.from(
      { length: 12 },
      (_, index) => ({
        monthNumber: index,
        month: new Date(
          now.getFullYear(),
          index,
          1
        ).toLocaleString("en-IN", {
          month: "short",
        }),

        revenue: 0,
        orders: 0,
      })
    );

    yearlyOrders.forEach((order) => {
      const orderDate = new Date(
        order.createdAt
      );

      const monthIndex =
        orderDate.getMonth();

      monthlySales[monthIndex].orders += 1;

      if (
        REVENUE_ORDER_STATUSES.includes(
          order.orderStatus
        )
      ) {
        monthlySales[
          monthIndex
        ].revenue += Number(
          order.total || 0
        );
      }
    });

    monthlySales.forEach((month) => {
      month.revenue = roundMoney(
        month.revenue
      );
    });

    // ==================================================
    // ORDER STATUS ANALYTICS
    // ==================================================

    const statusMap = {};

    allOrders.forEach((order) => {
      const status =
        order.orderStatus || "Unknown";

      statusMap[status] =
        (statusMap[status] || 0) + 1;
    });

    const orderStatusAnalytics =
      Object.entries(statusMap).map(
        ([status, count]) => ({
          status,
          count,

          percentage:
            allOrders.length > 0
              ? Number(
                  (
                    (count /
                      allOrders.length) *
                    100
                  ).toFixed(1)
                )
              : 0,
        })
      );

    // ==================================================
    // RECENT ORDERS
    // ==================================================

    const recentOrders = allOrders
      .slice(0, 10)
      .map((order) => ({
        ...order,

        customerName:
          order.customerId?.name ||
          order.customerName ||
          "Customer",

        customerPhone:
          order.customerId?.phone ||
          order.customerPhone ||
          order.phone ||
          "",
      }));

    return res.status(200).json({
      success: true,

      generatedAt: new Date(),

      totalOrders: allOrders.length,
      todaysOrders: todayOrders.length,
      monthlyOrders: monthlyOrders.length,

      pendingOrders:
        pendingOrders.length,

      deliveredOrders:
        deliveredOrders.length,

      cancelledOrders:
        cancelledOrders.length,

      returnRequestedOrders:
        returnRequestedOrders.length,

      returnedOrders:
        returnedOrders.length,

      todaysRevenue:
        roundMoney(todaysRevenue),

      monthlyRevenue:
        roundMoney(monthlyRevenue),

      yearlyRevenue:
        roundMoney(yearlyRevenue),

      totalRevenue:
        roundMoney(totalRevenue),

      averageOrderValue:
        roundMoney(averageOrderValue),

      cancellationRate: Number(
        cancellationRate.toFixed(1)
      ),

      returnRate: Number(
        returnRate.toFixed(1)
      ),

      totalCustomers,
      totalProducts,
      totalBrands,
      totalStock,

      totalInventoryValue:
        roundMoney(
          totalInventoryValue
        ),

      paymentAnalytics,

      topSellingProducts,
      topCustomers,
      recentOrders,
      monthlySales,

      orderStatusAnalytics,
      categoryAnalytics,
      brandAnalytics,
      colorAnalytics,
      sizeAnalytics,

      lowStockProducts:
        lowStockProducts.sort(
          (first, second) =>
            first.totalStock -
            second.totalStock
        ),

      outOfStockProducts,
    });
  } catch (error) {
    console.error(
      "Dashboard analytics error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Dashboard analytics failed",
    });
  }
}
);

module.exports = router;