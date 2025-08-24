const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs').promises;
const path = require('path');

// The 8 Santa messages from your screenshot
const SANTA_MESSAGES = [
  "Watching your kindness was the best part of my year. This is just a little something to celebrate the magic you bring.",
  "I've been watching your brave heart all year long. The way you look out for others makes the North Pole shine a little brighter.",
  "Your generous spirit reminds me why I love Christmas so much. Thank you for showing the world how beautiful sharing can be.",
  "The compassion you show to everyone around you warms my heart more than any fireplace ever could. Keep spreading that love.",
  "I noticed how you always help others without being asked. That helpful heart of yours is the real Christmas magic.",
  "Your curiosity and love of learning lights up the whole workshop! Never stop asking questions and dreaming big.",
  "The way you include everyone and make new friends wherever you go is truly magical. Thank you for being such a wonderful friend.",
  "Your honesty and the way you always try to do the right thing makes you one of the most wonderful people I know. Stay true to that beautiful heart."
];

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

// Generate the CSS for present labels
async function generateLabelCSS(griffithsBase64, lilyWangBase64, backgroundBase64) {
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
    
    @page {
      size: 219mm 251mm;
      margin: 0;
    }
    
    body {
      width: 219mm;
      height: 251mm;
      margin: 0;
      padding: 0;
      background: white;
      position: relative;
    }
    
    /* Background image - full sheet */
    .background {
      position: absolute;
      top: 0;
      left: 0;
      width: 219mm;
      height: 251mm;
      z-index: 1;
    }
    
    /* Container for all stickers positioned over background */
    .sheet {
      position: absolute;
      top: 0;
      left: 0;
      width: 219mm;
      height: 251mm;
      z-index: 2;
      display: grid;
      grid-template-columns: 95mm 95mm;
      grid-template-rows: repeat(4, 60mm);
      padding-top: 3.632mm;
      padding-bottom: 3.632mm;
      padding-left: 12.637mm;
      padding-right: 12.637mm;
      column-gap: 2.524mm;
      row-gap: 2.732mm;
      overflow: hidden; /* Prevent any overflow */
    }
    
    .sticker {
      position: relative;
      display: flex;
      flex-direction: column;
      width: 95mm;
      height: 60mm;
      padding: 10mm 13mm 10mm 14.377mm;
      overflow: hidden; /* Prevent text overflow */
      page-break-inside: avoid; /* Prevent page breaks inside stickers */
    }
    
    .sticker-content {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    
    /* "My dearest" text */
    .greeting {
      font-family: 'Griffiths', Georgia, serif;
      font-size: 10pt;
      color: #333;
      position: absolute;
      top: 21mm; /* Moved down 1mm more */
      left: 14.377mm;
      -webkit-text-stroke: 0.05pt #000000;
      text-stroke: 0.05pt #000000;
    }
    
    /* Container for name with line - positioned absolutely */
    .name-container {
      position: absolute;
      top: 18mm; /* Keep at 18mm for line position */
      left: 14.377mm;
      width: 68mm;
      height: 10mm;
    }
    
    /* The line under the name */
    .name-line {
      position: absolute;
      bottom: 4mm;
      left: 18.232mm; /* 32.609mm from edge minus the 14.377mm padding */
      width: 50mm;
      height: 0.5pt;
      background-color: #666;
    }
    
    /* Child's name - sits ON the line */
    .child-name {
      font-family: 'LilyWang', cursive;
      font-size: 14mm;
      color: #333;
      position: absolute;
      bottom: 0; /* Sits directly on the line */
      left: 18.232mm; /* Aligned with line start */
      width: 50mm; /* Exact width for name box */
      text-align: center;
      line-height: 1;
    }
    
    /* Dynamic sizing for longer names */
    .child-name.long-name {
      font-size: 11mm; /* For 11-15 characters */
    }
    
    .child-name.very-long-name {
      font-size: 9mm; /* For 16-20 characters */
    }
    
    /* Message text */
    .message {
      font-family: 'Griffiths', Georgia, serif;
      font-size: 8.5pt;  /* Increased from 7.5pt to 8.5pt */
      line-height: 1.35;  /* Slightly increased from 1.25 for better spacing with larger text */
      color: #333;
      text-align: left;
      width: 68mm;
      position: absolute;
      top: 31mm;
      left: 14.377mm;
      -webkit-text-stroke: 0.03pt #000000;
      text-stroke: 0.03pt #000000;
      white-space: pre-line;  /* This preserves the line breaks from \n */
    }

    
    /* "With love," above Santa signature */
    .with-love {
      font-family: 'Griffiths', Georgia, serif;
      font-size: 9pt;
      color: #333;
      position: absolute;
      bottom: 9mm; /* Moved up 1mm */
      left: 14.377mm;
      -webkit-text-stroke: 0.05pt #000000;
      text-stroke: 0.05pt #000000;
    }
    
    /* Spacing for the pre-printed Santa Claus signature */
    .signature-space {
      height: 0; /* No extra space needed since padding handles it */
    }
  `;
}

// Generate HTML for present labels
async function generateLabelsHTML(childName, griffithsBase64, lilyWangBase64, backgroundBase64) {
  const css = await generateLabelCSS(griffithsBase64, lilyWangBase64, backgroundBase64);
  
  // Create 8 stickers with the messages and personalized name
  const stickersHTML = SANTA_MESSAGES.map((message, index) => {
    // Determine name length for dynamic sizing
    let nameClass = '';
    if (childName.length > 15) {
      nameClass = 'very-long-name';
    } else if (childName.length > 10) {
      nameClass = 'long-name';
    }
    
    return `
    <div class="sticker">
      <div class="sticker-content">
        <div class="greeting">My dearest</div>
        <div class="name-container">
          <span class="child-name ${nameClass}">${childName}</span>
          <div class="name-line"></div>
        </div>
        <div class="message">${message}</div>
        <div class="with-love">With love,</div>
        <div class="signature-space"></div>
      </div>
    </div>
  `;
  }).join('');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>${css}</style>
    </head>
    <body>
      ${backgroundBase64 ? `<img src="data:image/png;base64,${backgroundBase64}" class="background" />` : ''}
      <div class="sheet">
        ${stickersHTML}
      </div>
    </body>
    </html>
  `;
}

// Main function to generate present labels PDF
async function generatePresentLabels(orderData) {
  console.log('🎁 Generating Present Labels for order:', orderData.orderNumber);
  
  const cleanOrderNumber = orderData.orderNumber.replace('#', '');
  
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
  
  try {
    // Load fonts and background as base64
    const griffithsBase64 = await fileToBase64(path.join(__dirname, '../fonts/Griffiths.ttf'));
    const lilyWangBase64 = await fileToBase64(path.join(__dirname, '../fonts/LilyWang.otf'));
    const backgroundBase64 = await fileToBase64(path.join(__dirname, '../PresentLabels.png'));
    
    // Create page
    const page = await browser.newPage();
    
    // Set viewport to match sheet size (219mm x 251mm at 96 DPI)
    await page.setViewport({
      width: 827,  // 219mm at 96 DPI
      height: 948  // 251mm at 96 DPI
    });
    
    // Generate HTML with personalized name and background
    const html = await generateLabelsHTML(
      orderData.childName || 'Your Little One',
      griffithsBase64,
      lilyWangBase64,
      backgroundBase64
    );
    
    // Set content and wait for rendering
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      width: '219mm',
      height: '251mm',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    
    // Save PDF
    const filename = `order-${cleanOrderNumber}-present-labels.pdf`;
    const filepath = path.join(__dirname, '../output', filename);
    await fs.writeFile(filepath, pdfBuffer);
    
    await page.close();
    
    console.log('✅ Present Labels PDF generated:', filename);
    
    return {
      success: true,
      filename: filename,
      path: filepath,
      url: `/pdfs/${filename}`
    };
    
  } catch (error) {
    console.error('❌ Present Labels Generation Error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = { generatePresentLabels };
