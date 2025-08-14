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
      grid-template-columns: 1fr 1fr;
      grid-template-rows: repeat(4, 1fr);
      padding: 5mm; /* Outer margin of the sheet */
      gap: 3mm; /* Space between stickers */
    }
    
    .sticker {
      position: relative;
      display: flex;
      flex-direction: column;
      padding: 15mm 10mm 12mm 10mm; /* top right bottom left - adjust to fit within borders */
    }
    
    .sticker-content {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    
    /* "My dearest" text - positioned to align with line */
    .greeting {
      font-family: 'Griffiths', Georgia, serif;
      font-size: 10pt;
      color: #333;
      margin-top: 0;
      margin-bottom: 0;
      display: inline-block;
      -webkit-text-stroke: 0.05pt #000000;
      text-stroke: 0.05pt #000000;
    }
    
    /* Container for name with underline */
    .name-line {
      display: flex;
      align-items: baseline;
      margin-bottom: 5mm;
      position: relative;
    }
    
    /* Child's name - larger and with underline */
    .child-name {
      font-family: 'LilyWang', cursive;
      font-size: 20pt;
      color: #333;
      display: inline-block;
      margin-left: 3mm;
      position: relative;
      line-height: 1.2;
    }
    
    /* Underline for the name */
    .child-name::after {
      content: '';
      position: absolute;
      bottom: -1mm;
      left: 0;
      right: -10mm; /* Extend line beyond name */
      height: 0.5pt;
      background-color: #666;
    }
    
    /* Message text */
    .message {
      font-family: 'Griffiths', Georgia, serif;
      font-size: 7.5pt;
      line-height: 1.25;
      color: #333;
      text-align: left;
      flex-grow: 1;
      margin-bottom: 2mm;
      -webkit-text-stroke: 0.03pt #000000;
      text-stroke: 0.03pt #000000;
    }
    
    /* "With Love," above Santa signature */
    .with-love {
      font-family: 'Griffiths', Georgia, serif;
      font-size: 9pt;
      color: #333;
      margin-bottom: 0;
      -webkit-text-stroke: 0.05pt #000000;
      text-stroke: 0.05pt #000000;
    }
    
    /* Spacing for the pre-printed Santa Claus signature */
    .signature-space {
      height: 8mm; /* Reserve space for pre-printed signature */
    }
  `;
}

// Generate HTML for present labels
async function generateLabelsHTML(childName, griffithsBase64, lilyWangBase64, backgroundBase64) {
  const css = await generateLabelCSS(griffithsBase64, lilyWangBase64, backgroundBase64);
  
  // Create 8 stickers with the messages and personalized name
  const stickersHTML = SANTA_MESSAGES.map((message, index) => `
    <div class="sticker">
      <div class="sticker-content">
        <div class="name-line">
          <span class="greeting">My dearest</span>
          <span class="child-name">${childName}</span>
        </div>
        <div class="message">${message}</div>
        <div class="with-love">With Love,</div>
        <div class="signature-space"></div>
      </div>
    </div>
  `).join('');
  
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
