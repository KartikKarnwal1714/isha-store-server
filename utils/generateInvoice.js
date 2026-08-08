const PDFDocument = require("pdfkit");

// ======================================================
// FORMATTING HELPERS
// ======================================================

const formatCurrency = (value) => {
  return `Rs. ${Number(value || 0).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
};

const formatDate = (value) => {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
};

const getShortOrderId = (orderId) => {
  return String(orderId || "")
    .slice(-8)
    .toUpperCase();
};

const safeText = (value, fallback = "-") => {
  const cleanedValue = String(
    value ?? ""
  ).trim();

  return cleanedValue || fallback;
};

const drawHorizontalLine = (
  document,
  y,
  startX = 50,
  endX = 545
) => {
  document
    .strokeColor("#d1d5db")
    .lineWidth(1)
    .moveTo(startX, y)
    .lineTo(endX, y)
    .stroke();
};

const checkPageSpace = (
  document,
  requiredHeight = 80
) => {
  const bottomLimit =
    document.page.height -
    document.page.margins.bottom;

  if (
    document.y + requiredHeight >
    bottomLimit
  ) {
    document.addPage();
    return true;
  }

  return false;
};

// ======================================================
// TABLE HEADER
// ======================================================

const drawProductTableHeader = (
  document,
  y
) => {
  const columns = {
    product: 50,
    details: 255,
    quantity: 365,
    price: 415,
    amount: 485,
  };

  document
    .rect(50, y, 495, 28)
    .fill("#111827");

  document
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(9);

  document.text(
    "Product",
    columns.product + 5,
    y + 9,
    {
      width: 190,
    }
  );

  document.text(
    "Variant",
    columns.details,
    y + 9,
    {
      width: 100,
    }
  );

  document.text(
    "Qty",
    columns.quantity,
    y + 9,
    {
      width: 40,
      align: "center",
    }
  );

  document.text(
    "Price",
    columns.price,
    y + 9,
    {
      width: 65,
      align: "right",
    }
  );

  document.text(
    "Amount",
    columns.amount,
    y + 9,
    {
      width: 55,
      align: "right",
    }
  );

  document
    .fillColor("#111827")
    .font("Helvetica");

  return y + 28;
};

// ======================================================
// PRODUCT ROW
// ======================================================

const drawProductRow = (
  document,
  item,
  y,
  rowIndex
) => {
  const quantity = Number(
    item.quantity || 1
  );

  const price = Number(item.price || 0);

  const amount = price * quantity;

  const rowHeight = 48;

  if (rowIndex % 2 === 0) {
    document
      .rect(50, y, 495, rowHeight)
      .fill("#f9fafb");
  }

  document
    .fillColor("#111827")
    .font("Helvetica")
    .fontSize(9);

  document.text(
    safeText(item.name, "Product"),
    55,
    y + 8,
    {
      width: 190,
      height: 34,
      ellipsis: true,
    }
  );

  const variantText = [
    item.size
      ? `Size: ${item.size}`
      : "",
    item.color
      ? `Color: ${item.color}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  document.text(
    variantText || "-",
    255,
    y + 8,
    {
      width: 100,
      height: 34,
      ellipsis: true,
    }
  );

  document.text(
    String(quantity),
    365,
    y + 15,
    {
      width: 40,
      align: "center",
    }
  );

  document.text(
    formatCurrency(price),
    410,
    y + 15,
    {
      width: 70,
      align: "right",
    }
  );

  document
    .font("Helvetica-Bold")
    .text(
      formatCurrency(amount),
      480,
      y + 15,
      {
        width: 60,
        align: "right",
      }
    );

  document
    .strokeColor("#e5e7eb")
    .moveTo(50, y + rowHeight)
    .lineTo(545, y + rowHeight)
    .stroke();

  document.font("Helvetica");

  return y + rowHeight;
};

// ======================================================
// TOTAL ROW
// ======================================================

const drawTotalRow = (
  document,
  label,
  value,
  options = {}
) => {
  const {
    bold = false,
    negative = false,
    large = false,
  } = options;

  checkPageSpace(document, 30);

  const y = document.y;

  document
    .font(
      bold
        ? "Helvetica-Bold"
        : "Helvetica"
    )
    .fontSize(large ? 13 : 10)
    .fillColor("#111827");

  document.text(label, 350, y, {
    width: 100,
  });

  const formattedValue = negative
    ? `- ${formatCurrency(value)}`
    : formatCurrency(value);

  document.text(
    formattedValue,
    450,
    y,
    {
      width: 95,
      align: "right",
    }
  );

  document.moveDown(0.6);
};

// ======================================================
// GENERATE INVOICE
// ======================================================

const generateInvoice = (
  order,
  response
) => {
  const invoiceNumber = `INV-${getShortOrderId(
    order._id
  )}`;

  const document = new PDFDocument({
    size: "A4",
    margins: {
      top: 45,
      bottom: 45,
      left: 50,
      right: 50,
    },
    bufferPages: true,
    info: {
      Title: `Invoice ${invoiceNumber}`,
      Author: "ISHA STORE",
      Subject: `Invoice for order ${order._id}`,
    },
  });

  response.setHeader(
    "Content-Type",
    "application/pdf"
  );

  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${invoiceNumber}.pdf"`
  );

  document.pipe(response);

  // ====================================================
  // HEADER
  // ====================================================

  document
    .font("Helvetica-Bold")
    .fontSize(24)
    .fillColor("#111827")
    .text("ISHA STORE", 50, 45);

  document
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#6b7280")
    .text(
      "Premium Fashion, Jewellery and Lifestyle Store",
      50,
      75
    );

  document
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor("#111827")
    .text("INVOICE", 380, 45, {
      width: 165,
      align: "right",
    });

  document
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#4b5563")
    .text(
      `Invoice: ${invoiceNumber}`,
      360,
      76,
      {
        width: 185,
        align: "right",
      }
    )
    .text(
      `Order: #${getShortOrderId(
        order._id
      )}`,
      360,
      90,
      {
        width: 185,
        align: "right",
      }
    )
    .text(
      `Date: ${formatDate(
        order.createdAt
      )}`,
      360,
      104,
      {
        width: 185,
        align: "right",
      }
    );

  drawHorizontalLine(document, 130);

  // ====================================================
  // CUSTOMER AND SHIPPING DETAILS
  // ====================================================

  document
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#111827")
    .text("BILLED TO", 50, 150);

  document
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#374151")
    .text(
      safeText(order.customerName),
      50,
      170,
      {
        width: 210,
      }
    )
    .text(
      safeText(
        order.customerPhone ||
          order.phone
      ),
      50,
      185,
      {
        width: 210,
      }
    )
    .text(
      safeText(order.email),
      50,
      200,
      {
        width: 210,
      }
    );

  document
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#111827")
    .text("DELIVERY ADDRESS", 310, 150);

  const addressLines = [
    order.address?.house,
    order.address?.area,
    order.address?.landmark,
    [
      order.address?.city,
      order.address?.state,
    ]
      .filter(Boolean)
      .join(", "),
    order.address?.pincode,
    order.address?.country,
  ]
    .filter(Boolean)
    .map((line) => String(line).trim())
    .filter(Boolean);

  document
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#374151")
    .text(
      addressLines.length > 0
        ? addressLines.join("\n")
        : "Address not available",
      310,
      170,
      {
        width: 235,
        lineGap: 3,
      }
    );

  document.y = 245;

  // ====================================================
  // ORDER INFORMATION
  // ====================================================

  document
    .roundedRect(
      50,
      document.y,
      495,
      54,
      6
    )
    .fill("#f3f4f6");

  const orderInfoY = document.y + 11;

  document
    .fillColor("#6b7280")
    .font("Helvetica")
    .fontSize(8)
    .text(
      "ORDER STATUS",
      65,
      orderInfoY
    )
    .text(
      "PAYMENT METHOD",
      190,
      orderInfoY
    )
    .text(
      "PAYMENT STATUS",
      330,
      orderInfoY
    )
    .text(
      "COUPON",
      460,
      orderInfoY
    );

  document
    .fillColor("#111827")
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(
      safeText(order.orderStatus),
      65,
      orderInfoY + 18,
      {
        width: 110,
      }
    )
    .text(
      safeText(order.paymentMethod),
      190,
      orderInfoY + 18,
      {
        width: 120,
      }
    )
    .text(
      safeText(order.paymentStatus),
      330,
      orderInfoY + 18,
      {
        width: 115,
      }
    )
    .text(
      safeText(order.couponCode),
      460,
      orderInfoY + 18,
      {
        width: 70,
      }
    );

  document.y += 74;

  // ====================================================
  // PRODUCTS TABLE
  // ====================================================

  let currentY = drawProductTableHeader(
    document,
    document.y
  );

  const products = Array.isArray(
    order.products
  )
    ? order.products
    : [];

  products.forEach((item, index) => {
    const bottomLimit =
      document.page.height -
      document.page.margins.bottom -
      100;

    if (
      currentY + 48 >
      bottomLimit
    ) {
      document.addPage();

      document
        .font("Helvetica-Bold")
        .fontSize(15)
        .fillColor("#111827")
        .text(
          `Invoice ${invoiceNumber}`,
          50,
          45
        );

      currentY =
        drawProductTableHeader(
          document,
          75
        );
    }

    currentY = drawProductRow(
      document,
      item,
      currentY,
      index
    );
  });

  document.y = currentY + 25;

  // ====================================================
  // TOTALS
  // ====================================================

  drawTotalRow(
    document,
    "Subtotal",
    order.subtotal
  );

  drawTotalRow(
    document,
    "Shipping",
    order.shipping
  );

  drawTotalRow(
    document,
    "Tax",
    order.tax
  );

  if (Number(order.discount || 0) > 0) {
    drawTotalRow(
      document,
      "Discount",
      order.discount,
      {
        negative: true,
      }
    );
  }

  checkPageSpace(document, 55);

  document
    .moveTo(350, document.y + 2)
    .lineTo(545, document.y + 2)
    .strokeColor("#111827")
    .lineWidth(1.5)
    .stroke();

  document.moveDown(0.8);

  drawTotalRow(
    document,
    "Grand Total",
    order.total,
    {
      bold: true,
      large: true,
    }
  );

  // ====================================================
  // FOOTER
  // ====================================================

  checkPageSpace(document, 100);

  document.moveDown(1.5);

  document
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#111827")
    .text(
      "Thank you for shopping with ISHA STORE.",
      50,
      document.y,
      {
        align: "center",
        width: 495,
      }
    );

  document
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#6b7280")
    .text(
      "This invoice was generated electronically and does not require a physical signature.",
      50,
      document.y + 8,
      {
        align: "center",
        width: 495,
      }
    );

  // ====================================================
  // PAGE NUMBERS
  // ====================================================

  const pageRange =
    document.bufferedPageRange();

  for (
    let pageIndex = pageRange.start;
    pageIndex <
    pageRange.start + pageRange.count;
    pageIndex += 1
  ) {
    document.switchToPage(pageIndex);

    document
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#9ca3af")
      .text(
        `Page ${
          pageIndex + 1
        } of ${pageRange.count}`,
        50,
        document.page.height - 30,
        {
          width: 495,
          align: "center",
        }
      );
  }

  document.end();
};

module.exports = generateInvoice;