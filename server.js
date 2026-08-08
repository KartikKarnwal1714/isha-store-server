const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

require("dotenv").config();

const app = express();

// HTTP SERVER + SOCKET.IO
// (needed so the admin panel can receive real-time "new order" events)
const httpServer = http.createServer(app);

// Local dev servers (Vite storefront + admin) are always allowed, on top of
// whatever CLIENT_URLS lists. This means CLIENT_URLS only needs to hold your
// production domains — you no longer have to remember to add localhost back
// in every time, and switching between local dev and prod can't accidentally
// break the other.
const DEFAULT_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

const configuredOrigins = process.env.CLIENT_URLS
  ? process.env.CLIENT_URLS.split(",").map((url) => url.trim())
  : [];

const allowedOrigins =
  configuredOrigins.length > 0
    ? [...new Set([...configuredOrigins, ...DEFAULT_DEV_ORIGINS])]
    : "*";

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
  },
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// Make io accessible inside controllers via req.app.get("io")
app.set("io", io);


// MIDDLEWARE
app.use(
  cors({
    origin: allowedOrigins,
  })
);
app.use(
  express.json({
    limit: "50mb",
  })
);

app.use(
  express.urlencoded({
    limit: "50mb",
    extended: true,
  })
);

// DATABASE
mongoose
  .connect(process.env.MONGO_URI)
  .then(() =>
    console.log("MongoDB Connected")
  )
  .catch((err) =>
    console.log(err)
  );

// ROUTES

const orderRoutes =
  require("./routes/orderRoutes");

const productRoutes =
  require("./routes/productRoutes");

const brandRoutes =
  require("./routes/brandRoutes");

const notificationRoutes =
  require("./routes/notificationRoutes");

const couponRoutes = 
require("./routes/couponRoutes");

const authRoutes = 
require("./routes/authRoutes");

const userRoutes =
require("./routes/userRoutes");

const wishlistRoutes = 
require("./routes/wishlistRoutes");

const cartRoutes = 
require("./routes/cartRoutes");

const dashboardRoutes =
require("./routes/dashboardRoutes");

const reviewRoutes = 
require("./routes/reviewRoutes");

const addressRoutes = 
require("./routes/addressRoutes");

const locationRoutes =
require("./routes/locationRoutes");

const paymentRoutes =
require("./routes/paymentRoutes");


app.use(
  "/api/orders",
  orderRoutes
);

app.use(
  "/api/products",
  productRoutes
);

app.use(
  "/api/brands",
  brandRoutes
);

app.use(
  "/api/notifications",
  notificationRoutes
);

app.use("/api/coupons", couponRoutes);

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

app.use("/api/wishlist", wishlistRoutes);

app.use("/api/cart", cartRoutes);

app.use(
  "/api/dashboard",
  dashboardRoutes
);

app.use("/api/reviews", reviewRoutes);

app.use("/api/addresses", addressRoutes);

app.use("/api/location", locationRoutes);

app.use("/api/payment", paymentRoutes);

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("API Running");
});

// SERVER
const PORT =
  process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(
    `Server running on ${PORT}`
  );
});