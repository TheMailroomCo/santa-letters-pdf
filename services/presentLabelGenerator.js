const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs').promises;
const path = require('path');

// The 8 Santa messages from your screenshot
const SANTA_MESSAGES = [
  "Watching your kindness was the best part of my year. This is just a little something to celebrate the magic you bring.",
  "I've been watching your brave heart all year long. The way you stand up for others makes the North Pole shine a little brighter.",
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
async function generateLabelCSS(griffithsBase64, lilyWangBase64) {
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
    }
    
    .sheet {
      width: 219mm;
      height: 251mm;
      position: relative;
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: repeat(4, 1fr);
      gap: 0;
      padding: 10mm; /* Adjust based on your printer margins */
    }
    
    .sticker {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 8mm;
      overflow: hidden;
      border: 1px dashed #e0e0e0; /* Guide lines for testing - remove for production */
    }
    
    .sticker-content {
      text-align: center;
      width: 100%;
      max-width: 85%; /* Keep text away from edges */
    }
    
    .santa-says {
      font-family: 'LilyWang', cursive;
      font-size: 13pt;
      color: #c41e3a; /* Christmas red */
      margin-bottom: 3mm;
    }
    
    .child-name {
      font-family: 'LilyWang', cursive;
      font-size: 22pt;
      color: #2c5234; /* Christmas green */
      margin-bottom: 4mm;
      line-height: 1.1;
    }
    
    .message {
      font-family: 'Griffiths', Georgia, serif;
      font-size: 9.5pt;
      line-height: 1.3;
      color: #333;
      text-align: center;
      -webkit-text-stroke: 0.1pt #000000;
      text-stroke: 0.1pt #000000;
    }
    
    .santa-signature {
      font-family: 'LilyWang', cursive;
      font-size: 14pt;
      color: #c41e3a;
      margin-top: 3mm;
    }
    
    /* Border styling - matches your screenshot */
    .sticker::before {
      content: '';
      position: absolute;
      top: 3mm;
      left: 3mm;
      right: 3mm;
      bottom: 3mm;
      border: 2pt solid #c41e3a;
      border-radius: 8mm;
      opacity: 0.8;
    }
    
    .sticker::after {
      content: '';
      position: absolute;
      top: 5mm;
      left: 5mm;
      right: 5mm;
      bottom: 5mm;
      border: 1pt solid #2c5234;
      border-radius: 6mm;
      opacity: 0.6;
    }
  `;
}

// Generate HTML for present labels
async function generateLabelsHTML(childName, griffithsBase64, lilyWangBase64) {
  const css = await generateLabelCSS(griffithsBase64, lilyWangBase64);
  
  // Create 8 stickers with the messages and personalized name
  const stickersHTML = SANTA_MESSAGES.map((message, index) => `
    <div class="sticker">
      <div class="sticker-content">
        <div class="santa-says">My Dearest</div>
        <div class="child-name">${childName}</div>
        <div class="message">${message}</div>
        <div class="santa-signature">With Love, Santa Claus</div>
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
    // Load fonts as base64
    const griffithsBase64 = await fileToBase64(path.join(__dirname, '../fonts/Griffiths.ttf'));
    const lilyWangBase64 = await fileToBase64(path.join(__dirname, '../fonts/LilyWang.otf'));
    
    // Create page
    const page = await browser.newPage();
    
    // Set viewport to match sheet size (219mm x 251mm at 96 DPI)
    await page.setViewport({
      width: 827,  // 219mm at 96 DPI
      height: 948  // 251mm at 96 DPI
    });
    
    // Generate HTML with personalized name
    const html = await generateLabelsHTML(
      orderData.childName || 'Your Little One',
      griffithsBase64,
      lilyWangBase64
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
