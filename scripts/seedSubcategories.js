const mongoose = require("mongoose");
require("dotenv").config();

const Subcategory = require("../models/Subcategory");

const subCategories = {
  Men: [
    "T-Shirts",
    "Lowers",
    "UGs (Innerwear)",
    "Belts",
    "Purses/Wallets",
    "Shorts",
    "Swimming Costumes",
    "Gym Lowers",
    "Gym T-Shirts",
    "Socks",
    "Handkerchiefs",
    "Umbrellas",
    "Raincoats",
  ],

  Women: [
    "T-Shirts",
    "Lowers",
    "Night Suits",
    "Shorts",
    "Capris",
    "Swimming Costumes",
    "Co-Ord Sets",
    "UGs (Innerwear)",
    "Jeans",
    "Jeggings",
    "Palazzos",
    "Cargo Pants",
    "Cotton Pants",
    "Flare Pants",
    "Relax Pants",
    "Yoga Pants",
    "Gym Lowers",
    "Gym T-Shirts",
    "Socks",
    "Handkerchiefs",
    "Umbrellas",
    "Raincoats",
  ],

  Kids: [
    "T-Shirts",
    "Lowers",
    "Shorts",
    "Capris",
    "Night Suits",
    "New Born Suits",
    "Nappies",
    "Co-Ord Sets",
    "Swimming Costumes",
    "Caps",
    "Socks",
    "Handkerchiefs",
    "Umbrellas",
    "Raincoats",
  ],

  Jewellery: [
    "Earrings",
    "Necklaces",
    "Chains",
    "Bangles",
    "Bracelets",
    "Rings",
    "Anklets",
    "Hair Accessories",
  ],

  "Mens-Cosmetics": [
    "Deodorants",
    "Perfumes",
    "Face Wash",
    "Body Wash",
    "Shaving Creams",
    "Blades",
    "Razors",
    "Face Creams",
    "Roll-Ons",
    "Hair Combs",
    "Hair Color",
    "Toiletries",
  ],

  "Womens-Cosmetics": [
    "Deodorants",
    "Perfumes",
    "Face Wash",
    "Body Wash",
    "Face Creams",
    "Roll-Ons",
    "Hair Combs",
    "Professional Shampoos",
    "Hair Color",
    "Serums",
    "Masks",
    "Conditioners",
    "Makeup",
    "Lakme Products",
    "Color Bar Products",
    "Toiletries",
  ],

  "Kids-Cosmetics": [
    "Baby Face Creams",
    "Baby Shampoos",
    "Baby Soaps",
    "Toiletries",
  ],
};

async function seedSubcategories() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB Connected");

    let added = 0;
    let existing = 0;

    for (const category of Object.keys(subCategories)) {
      const names = subCategories[category];

      for (let i = 0; i < names.length; i++) {
        const name = names[i];

        const found = await Subcategory.findOne({
          category,
          name,
        });

        if (found) {
          existing++;
          console.log(`Already exists: ${category} → ${name}`);
          continue;
        }

        await Subcategory.create({
          category,
          name,
          image: "",
          description: "",
          displayOrder: i,
          isActive: true,
        });

        added++;
        console.log(`Added: ${category} → ${name}`);
      }
    }

    console.log("");
    console.log("====================================");
    console.log("SUBCATEGORY MIGRATION COMPLETED");
    console.log("====================================");
    console.log(`Added: ${added}`);
    console.log(`Already existed: ${existing}`);
    console.log(`Total: ${added + existing}`);
    console.log("====================================");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:");
    console.error(error);

    await mongoose.disconnect();
    process.exit(1);
  }
}

seedSubcategories();