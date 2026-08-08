const express = require("express");

const router = express.Router();

// ======================================================
// PINCODE LOOKUP (India Post API)
// GET /api/location/pincode/:pincode
//
// The India Post pincode API does not send CORS headers,
// so it can never be called directly from a browser.
// We proxy it through our own server instead.
// ======================================================

router.get("/pincode/:pincode", async (req, res) => {
  try {
    const pincode = String(req.params.pincode || "").trim();

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 6-digit pincode",
      });
    }

    const response = await fetch(
      `https://api.postalpincode.in/pincode/${pincode}`
    );

    if (!response.ok) {
      throw new Error(
        `Pincode lookup failed with status ${response.status}`
      );
    }

    const data = await response.json();
    const result = data?.[0];
    const postOffice = result?.PostOffice?.[0];

    if (result?.Status !== "Success" || !postOffice) {
      return res.status(404).json({
        success: false,
        message: "No location found for this pincode",
      });
    }

    return res.status(200).json({
      success: true,
      city: postOffice.District || "",
      state: postOffice.State || "",
      country: postOffice.Country || "India",
    });
  } catch (error) {
    console.error("Pincode lookup error:", error);

    return res.status(500).json({
      success: false,
      message: "Pincode lookup failed",
    });
  }
});

// ======================================================
// REVERSE GEOCODE (OpenStreetMap Nominatim)
// GET /api/location/reverse?lat=..&lon=..
//
// Nominatim requires a real User-Agent identifying the
// application, which browsers do not allow JavaScript to
// set. Proxying through our server lets us set it properly
// and avoids the shared server blocking generic browser
// requests.
// ======================================================

router.get("/reverse", async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const url = new URL(
      "https://nominatim.openstreetmap.org/reverse"
    );

    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lon);

    const response = await fetch(url, {
      headers: {
        // Nominatim's usage policy requires a real
        // User-Agent identifying the application.
        "User-Agent":
          "IshaStore/1.0 (contact: support@ishastore.example)",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Reverse geocoding failed with status ${response.status}`
      );
    }

    const data = await response.json();
    const address = data?.address || {};

    return res.status(200).json({
      success: true,
      area:
        [address.suburb, address.neighbourhood]
          .filter(Boolean)
          .join(", ") || "",
      landmark: address.road || "",
      city:
        address.city ||
        address.town ||
        address.village ||
        address.county ||
        "",
      state: address.state || "",
      pincode: address.postcode || "",
      country: address.country || "",
    });
  } catch (error) {
    console.error("Reverse geocoding error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not detect your address",
    });
  }
});

// ======================================================
// SEARCH BY PLACE NAME (OpenStreetMap Nominatim)
// GET /api/location/search?q=hyderabad
//
// Used when the user types a city/place name instead of a
// pincode. Same CORS/User-Agent issue as reverse geocoding,
// so this is proxied through our own server too.
// ======================================================

router.get("/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Enter a place name or pincode to search",
      });
    }

    const url = new URL(
      "https://nominatim.openstreetmap.org/search"
    );

    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "in");
    url.searchParams.set("q", query);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "IshaStore/1.0 (contact: support@ishastore.example)",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Place search failed with status ${response.status}`
      );
    }

    const results = await response.json();
    const bestMatch = results?.[0];

    if (!bestMatch) {
      return res.status(404).json({
        success: false,
        message: "No matching location found",
      });
    }

    const address = bestMatch.address || {};

    return res.status(200).json({
      success: true,
      label:
        bestMatch.display_name ||
        address.city ||
        query,
      city:
        address.city ||
        address.town ||
        address.village ||
        address.county ||
        "",
      state: address.state || "",
      pincode: address.postcode || "",
      country: address.country || "",
    });
  } catch (error) {
    console.error("Place search error:", error);

    return res.status(500).json({
      success: false,
      message: "Location search failed",
    });
  }
});

module.exports = router;

