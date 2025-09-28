const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs').promises;
const path = require('path');

// Convert string to Title Case
function toTitleCase(str) {
  if (!str) return str;
  
  return str
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Handle special cases like McDonald, O'Brien, etc.
      if (word.includes("'")) {
        return word.split("'")
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join("'");
      }
      // Handle hyphenated names like Mary-Jane
      if (word.includes("-")) {
        return word.split("-")
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join("-");
      }
      // Standard title case
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

// Convert file to base64
async function fileToBase64(filePath) {
  try {
    const file = await fs.readFile(filePath);
    return file.toString('base64');
  } catch (error) {
    console.error('Error reading file:', filePath, error);
    return null;
  }
}

// Generate the CSS for belly band
async function generateBellyBandCSS(griffithsBase64, lilyWangBase64) {
  return `
    @font-face {
      font-family: 'Griffiths';
      src: url('data:font/truetype;base64,${griffithsBase64}') format('truetype');
    }
    @font-face {
      font-family: 'LilyWang';  
      src: url('data:font/opentype;base64,${lilyWangBase64}') format('opentype');
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    /* Custom page size for belly band */
    @page {
      size: 50mm 297mm;
      margin: 0;
    }
    
    body {
      width: 50mm;
      height: 297mm;
      margin: 0;
      padding: 0;
      background: white;
      position: relative;
    }
    
    /* Fold guide line at 82.5mm from top - now only 15mm wide, centered */
    .fold-guide-top {
      position: absolute;
      top: 82.5mm;
      left: 17.5mm;  /* Center the 15mm line (50mm - 15mm) / 2 */
      width: 15mm;
      height: 0.25pt;
      background-color: #e0e0e0;
      z-index: 1;
    }
    
    /* Fold guide line at 212.5mm from top (82.5mm + 130mm) - now only 15mm wide, centered */
    .fold-guide-bottom {
      position: absolute;
      top: 212.5mm;  /* 82.5mm + 130mm envelope height */
      left: 17.5mm;  /* Center the 15mm line (50mm - 15mm) / 2 */
      width: 15mm;
      height: 0.25pt;
      background-color: #e0e0e0;
      z-index: 1;
    }
    
    /* Main content container - centered in middle section */
    .content-wrapper {
      position: absolute;
      top: 82.5mm;  /* Start at top fold line */
      left: 0;
      width: 50mm;
      height: 130mm;  /* Height of envelope */
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8mm 5mm;  /* Padding for margins */
    }
    
    /* Top section - before ribbon gap */
    .top-section {
      width: 100%;
      text-align: center;
      margin-bottom: 0;
    }
    
    /* Customer name */
    .customer-name {
      font-family: 'LilyWang', cursive;
      font-size: 16pt;
      color: #4b0000;
      text-align: center;
      margin-bottom: 4mm;
      line-height: 1.1;
    }
    
    /* Main message text - top part */
    .message-top {
      font-family: 'Griffiths', Georgia, serif;
      font-size: 7.5pt;
      line-height: 1.35;
      color: #4b0000;
      text-align: center;
      margin-bottom: 3mm;
      font-weight: 700;
      letter-spacing: 0.3pt;
    }
    
    /* Ribbon gap */
    .ribbon-gap {
      width: 100%;
      height: 35mm;  /* Space for ribbon */
      position: relative;
    }
    
    /* Bottom section - after ribbon gap */
    .bottom-section {
      width: 100%;
      text-align: center;
    }
    
    /* Main message text - bottom part */
    .message-bottom {
      font-family: 'Griffiths', Georgia, serif;
      font-size: 7.5pt;
      line-height: 1.35;
      color: #4b0000;
      text-align: center;
      margin-bottom: 3mm;
      font-weight: 700;
      letter-spacing: 0.3pt;
    }
    
    /* Signature section */
    .signature {
      font-family: 'Griffiths', Georgia, serif;
      font-size: 7.5pt;
      text-align: center;
      color: #4b0000;
      line-height: 1.2;
      font-weight: 700;
      letter-spacing: 0.2pt;
    }
    
    .signature strong {
      font-weight: 700;
    }
    
    .signature em {
      font-style: italic;
      font-size: 6pt;
    }
    
    /* Optional decorative elements */
    .decorative-star {
      font-size: 8pt;
      color: #d4d4d4;
      margin: 0 2mm;
    }
  `;
}

// Generate HTML for belly band
async function generateBellyBandHTML(shippingFirstName, griffithsBase64, lilyWangBase64) {
  const css = await generateBellyBandCSS(griffithsBase64, lilyWangBase64);
  
  // Split the message into two parts - before and after ribbon gap
  const messageTop = `Every year, I witness something extraordinary. Adults who move mountains to keep wonder alive. Who guard childhood's fleeting sparkle with fierce devotion.

You are one of these remarkable souls.

Thank you for inviting me into your family's story this Christmas and for knowing that some magic is worth preserving, one careful detail at a time.`;

  const messageBottom = `This year's letters were crafted with particular care by my trusted Magic Keeper, Tash, who helps ensure each word reaches exactly where it needs to be. May your home be filled with the wonder you so lovingly create.`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>${css}</style>
    </head>
    <body>
      <!-- Fold guide lines -->
      <div class="fold-guide-top"></div>
      <div class="fold-guide-bottom"></div>
      
      <!-- Main content centered in middle section -->
      <div class="content-wrapper">
        <!-- Top section before ribbon -->
        <div class="top-section">
          <div class="customer-name">${shippingFirstName}</div>
          <div class="message-top">${messageTop}</div>
        </div>
        
        <!-- Gap for ribbon -->
        <div class="ribbon-gap"></div>
        
        <!-- Bottom section after ribbon -->
        <div class="bottom-section">
          <div class="message-bottom">${messageBottom}</div>
          <div class="signature">
            <strong>With all my love,</strong><br>
            Santa Claus<br>
            <em>&amp; Tash, Magic Maker</em>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Main function to generate belly band PDF
async function generateBellyBand(orderData) {
  console.log('🎀 Generating Belly Band for order:', orderData.orderNumber);
  console.log('📝 Shipping First Name:', orderData.shippingFirstName);
  
  const cleanOrderNumber = orderData.orderNumber.replace('#', '');
  
  // Use shipping first name from order data and convert to Title Case
  const rawName = orderData.shippingFirstName || orderData.customerName || 'Dear Friend';
  const displayName = toTitleCase(rawName);
  
  console.log('📝 Formatted Name:', displayName, '(from:', rawName, ')');
  
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
  
  try {
    // Load fonts as base64 - using regular Griffiths with bold styling
    const griffithsBase64 = await fileToBase64(path.join(__dirname, '../fonts/Griffiths.ttf'));
    const lilyWangBase64 = await fileToBase64(path.join(__dirname, '../fonts/LilyWang.otf'));
    
    // Create page
    const page = await browser.newPage();
    
    // Set viewport to match belly band size (50mm x 297mm at 96 DPI)
    await page.setViewport({
      width: 189,  // 50mm at 96 DPI
      height: 1123  // 297mm at 96 DPI
    });
    
    // Generate HTML with Title Case shipping first name
    const html = await generateBellyBandHTML(
      displayName,
      griffithsBase64,
      lilyWangBase64
    );
    
    // Set content and wait for rendering
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Generate PDF with exact dimensions
    const pdfBuffer = await page.pdf({
      width: '50mm',
      height: '297mm',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    
    // Save PDF
    const filename = `order-${cleanOrderNumber}-belly-band.pdf`;
    const filepath = path.join(__dirname, '../output', filename);
    await fs.writeFile(filepath, pdfBuffer);
    
    await page.close();
    
    console.log('✅ Belly Band PDF generated:', filename);
    
    return {
      success: true,
      filename: filename,
      path: filepath,
      url: `/pdfs/${filename}`
    };
    
  } catch (error) {
    console.error('❌ Belly Band Generation Error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = { generateBellyBand };
