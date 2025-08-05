const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const { processTemplate } = require('./templateEngine');

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

// Load and process CSS
async function loadCSS(griffithsBase64, lilyWangBase64) {
  try {
    const cssPath = path.join(__dirname, '../templates/letter-styles.css');
    let css = await fs.readFile(cssPath, 'utf8');
    
    // Replace font placeholders with actual base64 data
    css = css.replace('GRIFFITHS_BASE64', `data:font/truetype;base64,${griffithsBase64}`);
    css = css.replace('LILYWANG_BASE64', `data:font/opentype;base64,${lilyWangBase64}`);
    
    return css;
  } catch (error) {
    console.error('Error loading CSS:', error);
    return '';
  }
}

// Dynamic text sizing script for letters
function getDynamicSizingScript() {
  return `
    // Wait for fonts to load
    setTimeout(() => {
      const container = document.querySelector('.letter-content');
      if (!container) return;
      
      const isFancy = document.querySelector('.fancy-font') !== null;
      
      // Starting font sizes in pt (converted from rem)
      let fontSize = isFancy ? 28 : 30; // Larger for Block since spacing is tighter
      const minSize = 10.8; // 0.9rem
      const maxSize = 45; // Larger max for Block
      
      // Binary search for best fit
      let low = minSize;
      let high = maxSize;
      let bestFit = fontSize;
      
      for (let attempts = 0; attempts < 25; attempts++) {
        const mid = (low + high) / 2;
        
        // Apply test size
        container.querySelectorAll('p').forEach(p => {
          p.style.fontSize = mid + 'pt';
          p.style.lineHeight = isFancy ? '1.15' : '1.3';
        });
        
        // Force reflow
        container.offsetHeight;
        
        // Check if content fits
        const containerHeight = container.clientHeight;
        const contentHeight = container.scrollHeight;
        
        // We want to use as much space as possible
        if (contentHeight <= containerHeight) {
          // Content fits, try larger
          bestFit = mid;
          low = mid;
        } else {
          // Content overflows, try smaller
          high = mid;
        }
        
        // Stop if we're close enough (0.1pt precision)
        if (high - low < 0.1) break;
      }
      
      // Apply best fit to all paragraphs
      container.querySelectorAll('p').forEach(p => {
        p.style.fontSize = bestFit + 'pt';
        p.style.lineHeight = isFancy ? '1.15' : '1.3';
      });
      
      // Handle P.S. message
      const psMessage = document.querySelector('.ps-message');
      const psInner = document.querySelector('.ps-message-inner');
      if (psMessage && psInner) {
        const psText = psInner.querySelector('p');
        if (psText) {
          // Start with SAME size as main text (inherit)
          psText.style.fontSize = bestFit + 'pt';
          psText.style.lineHeight = '1.05'; // Tight spacing for P.S.
          
          // Check if it overflows after a brief delay
          setTimeout(() => {
            const psHeight = psMessage.clientHeight;
            const psContentHeight = psInner.scrollHeight;
            
            // Only scale down if it actually overflows
            if (psContentHeight > psHeight) {
              // Less aggressive reduction - start at 90%
              psText.style.fontSize = (bestFit * 0.9) + 'pt';
              
              // Check again - if still too big, go to 80%
              setTimeout(() => {
                if (psInner.scrollHeight > psHeight) {
                  psText.style.fontSize = (bestFit * 0.8) + 'pt';
                  
                  // Last resort - 70%
                  setTimeout(() => {
                    if (psInner.scrollHeight > psHeight) {
                      psText.style.fontSize = (bestFit * 0.7) + 'pt';
                    }
                  }, 10);
                }
              }, 10);
            }
          }, 50);
        }
      }
    }, 500);
  `;
}

// Load and process envelope CSS
async function loadEnvelopeCSS(lilyWangBase64) {
  try {
    const cssPath = path.join(__dirname, '../templates/envelope-styles.css');
    let css = await fs.readFile(cssPath, 'utf8');
    
    // Replace font placeholder with actual base64 data
    css = css.replace('LILYWANG_BASE64', `data:font/opentype;base64,${lilyWangBase64}`);
    
    return css;
  } catch (error) {
    console.error('Error loading envelope CSS:', error);
    return '';
  }
}

// Script to handle dynamic centering of envelope text (keeping improved positioning)
function getEnvelopeScript() {
  return `
    // Center text vertically while keeping improved positioning logic
    setTimeout(() => {
      const nameElement = document.querySelector('.envelope-name');
      const addressElement = document.querySelector('.envelope-address');
      
      if (nameElement && addressElement) {
        // Log the text being displayed
        const nameText = nameElement.textContent || '';
        const nameLines = nameText.split('\\n').length;
        
        console.log('📝 Name text:', nameText);
        console.log('📏 Name lines:', nameLines);
        console.log('📏 Name length:', nameText.length, 'characters');
        
        // Dynamic font sizing for very long names
        let nameFontSize = 30; // Increased default size from 28pt to 30pt
        
        // Count actual rendered lines after wrapping
        const originalHeight = nameElement.offsetHeight;
        const lineHeight = parseFloat(getComputedStyle(nameElement).lineHeight);
        const actualLines = Math.round(originalHeight / lineHeight);
        
        console.log('📏 Actual rendered lines:', actualLines);
        
        // Reduce font size for long names or multiple lines (all sizes increased by 2pt)
        if (nameText.length > 90 || actualLines >= 3) {
          nameFontSize = 26; // Increased from 24pt to 26pt for 90+ chars or 3+ lines
        } else if (nameText.length > 70 || actualLines === 2) {
          nameFontSize = 28; // Increased from 26pt to 28pt for 70+ chars or 2 lines
        } else if (nameText.length > 50) {
          nameFontSize = 29; // Increased from 27pt to 29pt for 50+ chars
        }
        // Under 50 characters uses 30pt (the default)
        
        // Apply the calculated font size
        nameElement.style.fontSize = nameFontSize + 'pt';
        
        console.log('📏 Using font size:', nameFontSize + 'pt');
        
        // Force reflow to get accurate measurements after font size change
        nameElement.offsetHeight;
        addressElement.offsetHeight;
        
        // Get heights after text is rendered
        const nameHeight = nameElement.offsetHeight;
        const addressHeight = addressElement.offsetHeight;
        const gap = 8 * (96/72); // Reduced gap from 16px to 8px for closer spacing
        
        // Total height of text block
        const totalHeight = nameHeight + gap + addressHeight;
        
        // Available space: from 70mm to 120mm (50mm of space) - keeping improved spacing
        const availableSpace = 50 * 3.7795; // Convert to pixels
        const topBoundary = 70 * 3.7795; // Start 70mm from top (improved positioning)
        
        // Center the text block in available space
        const topOffset = topBoundary + (availableSpace - totalHeight) / 2;
        
        // Position name at calculated offset
        nameElement.style.top = (topOffset / 3.7795) + 'mm';
        
        // Position address below name with builder-specified gap
        addressElement.style.top = ((topOffset + nameHeight + gap) / 3.7795) + 'mm';
        
        console.log('📐 Positioning: Name at', (topOffset / 3.7795).toFixed(1) + 'mm, Address at', ((topOffset + nameHeight + gap) / 3.7795).toFixed(1) + 'mm');
      }
    }, 100);
  `;
}

// Generate envelope HTML
async function generateEnvelope(orderData, lilyWangBase64) {
  const envelopeBase64 = await fileToBase64(path.join(__dirname, '../envelope.png'));
  const css = await loadEnvelopeCSS(lilyWangBase64);
  
  // Format the name - preserve exactly as user entered (like builder does with pre-wrap)
  const envelopeName = orderData.childName || orderData.familyNames || '';
  console.log('📝 Name for envelope (preserving user line breaks):', envelopeName.replace(/\n/g, ' | '));
  
  // Format the address - preserve exact line breaks as intended
  let magicalAddress = orderData.magicalAddress || '';
  
  // First check for actual line breaks (preferred method)
  if (magicalAddress.includes('\n')) {
    magicalAddress = magicalAddress
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)  // Remove empty lines
      .join('<br>');
  } 
  // Fallback: check for pipe delimiters
  else if (magicalAddress.includes('|')) {
    magicalAddress = magicalAddress
      .split('|')
      .map(line => line.trim())
      .filter(line => line.length > 0)  // Remove empty lines
      .join('<br>');
  }
  
  console.log('🏠 Processed magical address:', magicalAddress);
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${css}</style>
</head>
<body>
  ${envelopeBase64 ? `<img src="data:image/png;base64,${envelopeBase64}" class="envelope-background" />` : ''}
  
  <div class="envelope-container">
    <div class="envelope-name">
      ${envelopeName}
    </div>
    
    <div class="envelope-address">
      ${magicalAddress}
    </div>
  </div>
  
  <script>${getEnvelopeScript()}</script>
</body>
</html>
  `;
  
  return html;
}

// Main PDF generation function (now generates both letter and envelope)
async function generatePDF(orderData) {
  console.log('🎅 Generating PDFs for order:', orderData.orderNumber);
  
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

  try {
    // Load all assets as base64
    const backgroundBase64 = await fileToBase64(path.join(__dirname, '../background.png'));
    const griffithsBase64 = await fileToBase64(path.join(__dirname, '../fonts/Griffiths.ttf'));
    const lilyWangBase64 = await fileToBase64(path.join(__dirname, '../fonts/LilyWang.otf'));

    // === GENERATE LETTER ===
    const letterPage = await browser.newPage();
    await letterPage.setViewport({
      width: 680,  // 180mm at 96 DPI
      height: 906  // 240mm at 96 DPI
    });

    // Load CSS with fonts embedded
    const styles = await loadCSS(griffithsBase64, lilyWangBase64);

    // Get processed template content
    const letterContent = processTemplate(orderData.template, {
      name: orderData.letterName || orderData.childName,
      achievement: orderData.achievement,
      location: orderData.location
    });

    // Determine font class
    const fontClass = orderData.font === 'Fancy' ? 'fancy-font' : 'block-font';
    
    // Determine year
    const year = orderData.letterYear || '2025';

    // Build letter HTML
    const letterHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    ${styles}
  </style>
</head>
<body>
  <!-- Background image -->
  ${backgroundBase64 ? `<img src="data:image/png;base64,${backgroundBase64}" class="background-image" />` : ''}
  
  <div class="letter-container ${fontClass}">
    <div class="date-display">
      <span>${year}</span>
    </div>
    
    <div class="letter-content">
      ${letterContent}
    </div>
    
    ${orderData.psMessage ? `
    <div class="ps-message ${fontClass}">
      <div class="ps-message-inner">
        <p><strong>P.S.</strong> ${orderData.psMessage}</p>
      </div>
    </div>
    ` : ''}
  </div>
  
  <script>
    ${getDynamicSizingScript()}
  </script>
</body>
</html>
    `;

    // Set content and generate letter PDF
    await letterPage.setContent(letterHtml, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 1000));

    const letterPdfBuffer = await letterPage.pdf({
      width: '180mm',
      height: '240mm',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    // Save letter PDF
    const letterFilename = `order-${orderData.orderNumber}-item-${orderData.itemNumber || '1'}-letter.pdf`;
    const letterFilepath = path.join(__dirname, '../output', letterFilename);
    await fs.writeFile(letterFilepath, letterPdfBuffer);

    await letterPage.close();

    // === GENERATE ENVELOPE ===
    const envelopePage = await browser.newPage();
    await envelopePage.setViewport({
      width: 718,  // 190mm at 96 DPI
      height: 491  // 130mm at 96 DPI
    });

    const envelopeHtml = await generateEnvelope(orderData, lilyWangBase64);
    
    await envelopePage.setContent(envelopeHtml, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 500));

    const envelopePdfBuffer = await envelopePage.pdf({
      width: '190mm',
      height: '130mm',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    // Save envelope PDF
    const envelopeFilename = `order-${orderData.orderNumber}-item-${orderData.itemNumber || '1'}-envelope.pdf`;
    const envelopeFilepath = path.join(__dirname, '../output', envelopeFilename);
    await fs.writeFile(envelopeFilepath, envelopePdfBuffer);

    await envelopePage.close();

    console.log('✅ Letter PDF generated:', letterFilename);
    console.log('✅ Envelope PDF generated:', envelopeFilename);

    return {
      success: true,
      letter: {
        filename: letterFilename,
        path: letterFilepath,
        url: `/pdfs/${letterFilename}`
      },
      envelope: {
        filename: envelopeFilename,
        path: envelopeFilepath,
        url: `/pdfs/${envelopeFilename}`
      }
    };

  } catch (error) {
    console.error('❌ PDF Generation Error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}


module.exports = { generatePDF };



