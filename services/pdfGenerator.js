const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

// GitHub repository base URL for templates
const GITHUB_TEMPLATE_BASE = 'https://raw.githubusercontent.com/TheMailroomCo/santa-letters-pdf/main/templates/';

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
async function loadCSS(griffithsBoldBase64, lilyWangBase64) {
  try {
    const cssPath = path.join(__dirname, '../templates/letter-styles.css');
    let css = await fs.readFile(cssPath, 'utf8');
    
    // Replace font placeholders with actual base64 data
    css = css.replace('GRIFFITHS_BOLD_BASE64', `data:font/truetype;base64,${griffithsBoldBase64}`);
    css = css.replace('LILYWANG_BASE64', `data:font/truetype;base64,${lilyWangBase64}`);
    
    return css;
  } catch (error) {
    console.error('Error loading CSS:', error);
    return '';
  }
}

// Convert Shopify template name to GitHub filename
function getTemplateFilename(templateName, letterYear, letterType) {
  // Individual Letter (Backdated) should use the template field even if it exists
  if (letterType === 'Individual Letter (Backdated)') {
    if (!templateName) {
      console.error('❌ Individual Letter (Backdated) requires a template but none provided');
      throw new Error('Individual Letter (Backdated) requires a template selection');
    }
  }
  
  // Handle letter types that don't use template field
  if (!templateName || templateName === '') {
    if (letterType === 'Write Your Own Letter') {
      return 'write-your-own.html';
    }
    if (letterType === 'Toddler Letter' || letterType === 'Toddler' || letterType === 'Toddler Letter (Second Christmas)') {
      return 'toddler-letter.html';
    }

    // Check if letterType contains "Family Letter"
    if (letterType && letterType.includes('Family Letter')) {
      if (letterType.includes('Backdated')) {
        return 'family-letter-backdated.html';
      }
      return 'family-letter.html';
    }
    // Check for both variations of Baby's First
    if (letterType === 'Baby\'s First Christmas' || letterType === 'First Christmas Letter') {
      return 'babys-first-christmas.html';
    }
    if (letterType === 'Non-Believer Letter') {
      return 'non-believer-letter.html';
    }
  }
  
  // Handle special cases first
  if (templateName === 'Family Letter') {
    return 'family-letter.html';
  }
  
  // Convert template name to kebab-case filename
  const templateMap = {
    'The Grand Library of Kind Hearts': 'the-grand-library-of-kind-hearts.html',
    'Snow Globe Heart': 'snow-globe-heart.html',
    'The Brave One': 'the-brave-one.html',
    'Royal Winter Gala': 'royal-winter-gala.html',
    'Magic and Stardust': 'magic-and-stardust.html',
    'Magic & Stardust': 'magic-and-stardust.html',
    'The Watchful Elf': 'the-watchful-elf.html',
    'The Helpful Reindeer': 'the-helpful-reindeer.html',
    'The Night Sky': 'the-night-sky.html',
    "Baby's First Christmas": 'babys-first-christmas.html',
    'Non-Believer Letter': 'non-believer-letter.html',
    'Write Your Own Letter': 'write-your-own.html',
    'Write Your Own': 'write-your-own.html',
    'Toddler Letter': 'toddler-letter.html',
    'Toddler': 'toddler-letter.html',
    'Toddler Letter (Second Christmas)': 'toddler-letter.html'
  };
  
  return templateMap[templateName] || kebabCase(templateName) + '.html';
}

// Convert string to kebab-case
function kebabCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Fetch template from GitHub
async function fetchTemplate(templateFilename) {
  try {
    const url = `${GITHUB_TEMPLATE_BASE}${templateFilename}`;
    console.log(`🌐 Fetching template from GitHub: ${url}`);
    
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`❌ Error fetching template ${templateFilename}:`, error.message);
    throw new Error(`Failed to fetch template: ${templateFilename}`);
  }
}

// Process template with data placeholders
function processTemplateContent(templateHtml, orderData) {
  let processedHtml = templateHtml;
  
  // Handle Write Your Own Letter - map the customer's content properly
  if (orderData.letterType === 'Write Your Own Letter') {
    console.log('🔍 Processing Write Your Own Letter');
    console.log('🔍 Available fields:', Object.keys(orderData));
    
    // Check multiple possible field names where the content might be
    // Priority order: yourLetter, "Your Letter", achievement
    let content = orderData.yourLetter || orderData['Your Letter'] || orderData.achievement || '';
    
    console.log('🔍 Found content in field:', content ? 'yes' : 'no');
    console.log('🔍 Content length:', content.length);
    console.log('🔍 First 200 chars:', content.substring(0, 200));
    
    if (!content) {
      console.error('❌ No content found for Write Your Own Letter!');
      console.log('All orderData fields:', JSON.stringify(orderData, null, 2));
      // Return a placeholder message if no content
      processedHtml = processedHtml.replace('{yourLetter}', '<p>Letter content not found. Please check the order data mapping.</p>');
      processedHtml = processedHtml.replace('{achievement}', '<p>Letter content not found. Please check the order data mapping.</p>');
      return processedHtml;
    }
    
    // Handle different types of line breaks
    content = content
      .replace(/\\n/g, '\n')  // Convert literal \n to actual newlines
      .replace(/\r\n/g, '\n') // Convert Windows line breaks
      .replace(/\r/g, '\n');  // Convert old Mac line breaks
    
    let paragraphs;
    
    // Check if we have HTML breaks
    if (content.includes('<br>')) {
      console.log('📝 Found <br> tags, processing as HTML');
      if (content.includes('<br><br>') || content.includes('<br> <br>')) {
        paragraphs = content
          .split(/<br>\s*<br>/)
          .filter(p => p.trim())
          .map(p => `<p>${p.trim()}</p>`)
          .join('\n');
      } else {
        paragraphs = `<p>${content.trim()}</p>`;
      }
    } 
    // Check for double newlines (paragraph breaks)
    else if (content.includes('\n\n')) {
      console.log('📝 Found double newlines, treating as paragraph breaks');
      paragraphs = content
        .split(/\n\s*\n/)
        .filter(p => p.trim())
        .map(p => {
          const cleaned = p.trim().replace(/\n/g, '<br>');
          return `<p>${cleaned}</p>`;
        })
        .join('\n');
    } 
    // Single paragraph with possible line breaks
    else {
      console.log('📝 No double newlines, treating as single paragraph with line breaks');
      const lines = content.trim().replace(/\n/g, '<br>');
      paragraphs = `<p>${lines}</p>`;
    }
    
    console.log('📝 Generated HTML (first 300 chars):', paragraphs.substring(0, 300));
    
    // Replace BOTH possible placeholders (for compatibility)
    processedHtml = processedHtml.replace('{yourLetter}', paragraphs);
    processedHtml = processedHtml.replace('{achievement}', paragraphs);
    
    return processedHtml;
  }
  
  // Process pronouns
  let pronouns = {
    they: 'They',
    their: 'their',
    Their: 'Their'
  };
  
  if (orderData.parentPronouns) {
    if (orderData.parentPronouns.includes('she')) {
      pronouns = { they: 'She', their: 'her', Their: 'Her' };
    } else if (orderData.parentPronouns.includes('he')) {
      pronouns = { they: 'He', their: 'his', Their: 'His' };
    }
  }
  
  // Map of placeholders to data fields
  const placeholderMap = {
    '{name}': orderData.childName || orderData.letterName || '',
    '{childName}': orderData.childName || '',
    '{letterName}': orderData.letterName || '',
    '{achievement}': orderData.achievement || orderData.actOfKindness || '',
    '{braveMoment}': orderData.braveMoment || '', // ADD THIS LINE
    '{location}': orderData.location || '',
    '{magicalAddress}': orderData.magicalAddress || '',
    '{psMessage}': orderData.psMessage || '',
    '{familyAchievement}': orderData.familyAchievement || '',
    '{actOfKindness}': orderData.actOfKindness || '',
    '{familyNames}': orderData.familyNames || '',
    '{childrenNames}': orderData.childrenNames || '',
    '{familyLastName}': orderData.familyLastName || '',
    '{parentsNames}': orderData.parentsNames || '',
    '{parentPronouns}': orderData.parentPronouns || '',
    '{numberOfChristmases}': orderData.numberOfChristmases || '',
    '{characteristics}': orderData.characteristics || '',
    '{letterYear}': orderData.letterYear || '2025',
    '{font}': orderData.font || '',
    '{envelopeColor}': orderData.envelopeColor || '',
    '{pronoun_They}': pronouns.they,
    '{pronoun_their}': pronouns.their,
    '{pronoun_Their}': pronouns.Their,
    '{correctedLetter}': orderData.correctedLetter || '',
    '{yourLetter}': orderData.yourLetter || orderData['Your Letter'] || ''
  };
  
  // Replace all placeholders
  Object.entries(placeholderMap).forEach(([placeholder, value]) => {
    const escapedValue = escapeHtml(value);
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
    processedHtml = processedHtml.replace(regex, escapedValue);
  });
  
  return processedHtml;
}

// Escape HTML special characters
function escapeHtml(text) {
  if (!text) return '';
  
  if (text.includes('<br>')) {
    return text
      .replace(/<br>/g, '|||LINEBREAK|||')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\|\|\|LINEBREAK\|\|\|/g, '<br>');
  }
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Dynamic text sizing script for letters
function getDynamicSizingScript() {
  return `
    setTimeout(() => {
      const container = document.querySelector('.letter-content');
      if (!container) return;
      
      const isFancy = document.querySelector('.fancy-font') !== null;
      const isBlockFont = document.querySelector('.block-font') !== null;
      
      // Check if this is Snow Globe Heart template
      const letterText = container.innerText || '';
      const isSnowGlobeHeart = letterText.includes('snow globe heart') || 
                               letterText.includes('Snow Globe Heart');
      
      // Standard starting sizes
      let fontSize = isFancy ? 28 : 30;
      
      // Boost ONLY Block font for Snow Globe Heart
      if (isSnowGlobeHeart && isBlockFont) {
        fontSize = 32; // Boost Block font from 30 to 32 for this template
        console.log('Snow Globe Heart detected with Block font - boosting to 32pt');
      }
      
      const minSize = 10.8;
      const maxSize = 45;
      
      let low = minSize;
      let high = maxSize;
      let bestFit = fontSize;
      
      for (let attempts = 0; attempts < 25; attempts++) {
        const mid = (low + high) / 2;
        
        container.querySelectorAll('p').forEach(p => {
          p.style.fontSize = mid + 'pt';
          p.style.lineHeight = isFancy ? '1.15' : '1.3';
          if (isBlockFont) {
            p.classList.add('block-font-bold');
          } else if (isFancy) {
            p.style.fontFamily = 'LilyWang, cursive';
          }
        });
        
        container.offsetHeight;
        
        const containerHeight = container.clientHeight;
        const contentHeight = container.scrollHeight;
        
        if (contentHeight <= containerHeight) {
          bestFit = mid;
          low = mid;
        } else {
          high = mid;
        }
        
        if (high - low < 0.1) break;
      }
      
      container.querySelectorAll('p').forEach(p => {
        p.style.fontSize = bestFit + 'pt';
        p.style.lineHeight = isFancy ? '1.15' : '1.3';
        if (isBlockFont) {
          p.classList.add('block-font-bold');
        } else if (isFancy) {
          p.style.fontFamily = 'LilyWang, cursive';
        }
      });
      
      // Handle P.S. message
      const psMessage = document.querySelector('.ps-message');
      const psInner = document.querySelector('.ps-message-inner');
      if (psMessage && psInner) {
        const psText = psInner.querySelector('p');
        if (psText) {
          psText.style.fontSize = bestFit + 'pt';
          psText.style.lineHeight = '1.05';
          
          if (isBlockFont) {
            psText.classList.add('block-font-bold');
          } else if (isFancy) {
            psText.style.fontFamily = 'LilyWang, cursive';
          }
          
          setTimeout(() => {
            const psHeight = psMessage.clientHeight;
            const psContentHeight = psInner.scrollHeight;
            
            if (psContentHeight > psHeight) {
              psText.style.fontSize = (bestFit * 0.9) + 'pt';
              
              setTimeout(() => {
                if (psInner.scrollHeight > psHeight) {
                  psText.style.fontSize = (bestFit * 0.8) + 'pt';
                  
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
      
      // Handle date display font-weight - ONLY for Block font
      if (isBlockFont) {
        const dateDisplay = document.querySelector('.date-display');
        if (dateDisplay) {
          dateDisplay.classList.add('block-font-bold');
          console.log('Date class applied:', dateDisplay.className);
        }
      }
      
      // Debug: Check if class is applied to paragraphs
      if (isBlockFont) {
        const firstParagraph = container.querySelector('p');
        if (firstParagraph) {
          console.log('Paragraph classes:', firstParagraph.className);
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
    
    css = css.replace('LILYWANG_BASE64', `data:font/opentype;base64,${lilyWangBase64}`);
    
    return css;
  } catch (error) {
    console.error('Error loading envelope CSS:', error);
    return '';
  }
}

// Script to handle dynamic centering of envelope text - FIXED VERSION
function getEnvelopeScript() {
  return `
    // Center text vertically while keeping different font sizes
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
        
        // Dynamic font sizing for very long names (name only)
        let nameFontSize = 30; // Default from CSS
        
        // Count actual rendered lines after wrapping
        const originalHeight = nameElement.offsetHeight;
        const lineHeight = parseFloat(getComputedStyle(nameElement).lineHeight);
        const actualLines = Math.round(originalHeight / lineHeight);
        
        console.log('📏 Actual rendered lines:', actualLines);
        
        // Reduce font size for long names or multiple lines
        if (nameText.length > 90 || actualLines >= 3) {
          nameFontSize = 26;
        } else if (nameText.length > 70 || actualLines === 2) {
          nameFontSize = 28;
        } else if (nameText.length > 50) {
          nameFontSize = 29;
        }
        
        // Apply the calculated font size to NAME only
        nameElement.style.fontSize = nameFontSize + 'pt';
        
        // DO NOT override address font size - let CSS handle it (19pt)
        // REMOVED: addressElement.style.fontSize = '19pt';
        
        console.log('📏 Using name font size:', nameFontSize + 'pt');
        console.log('📏 Address uses CSS default: 19pt');
        
        // Force reflow to get accurate measurements after font size change
        nameElement.offsetHeight;
        addressElement.offsetHeight;
        
        // Get heights after text is rendered
        const nameHeight = nameElement.offsetHeight;
        const addressHeight = addressElement.offsetHeight;
        const gap = 8 * (96/72); // Reduced gap from 16px to 8px for closer spacing
        
        // Total height of text block
        const totalHeight = nameHeight + gap + addressHeight;
        
        // Available space: from 70mm to 120mm (50mm of space)
        const availableSpace = 50 * 3.7795; // Convert to pixels
        const topBoundary = 70 * 3.7795; // Start 70mm from top
        
        // Center the text block in available space
        const topOffset = topBoundary + (availableSpace - totalHeight) / 2;
        
        // Position name at calculated offset
        nameElement.style.top = (topOffset / 3.7795) + 'mm';
        
        // Position address below name with specified gap
        addressElement.style.top = ((topOffset + nameHeight + gap) / 3.7795) + 'mm';
        
        console.log('📐 Positioning: Name at', (topOffset / 3.7795).toFixed(1) + 'mm, Address at', ((topOffset + nameHeight + gap) / 3.7795).toFixed(1) + 'mm');
      }
    }, 100);
  `;
}

// Generate envelope HTML
async function generateEnvelope(orderData, lilyWangBase64) {  
  const css = await loadEnvelopeCSS(lilyWangBase64);
  
  console.log('🔍 ENVELOPE CSS DEBUG:');
  console.log('CSS contains .envelope-name font-size:', css.includes('envelope-name') && css.includes('30pt'));
  console.log('CSS contains .envelope-address font-size:', css.includes('envelope-address') && css.includes('19pt'));
  console.log('CSS length:', css.length);
  
  // Check if we have a combined envelope field or separate fields
  let envelopeName = '';
  let magicalAddress = '';
  
  // If childName contains \n, it's likely a combined field that needs splitting
  if (orderData.childName && orderData.childName.includes('\\n')) {
    console.log('📦 Detected combined envelope field, splitting...');
    const combined = orderData.childName.replace(/\\n/g, '\n');
    const lines = combined.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length > 0) {
      // First line is the name
      envelopeName = lines[0];
      // Rest is the address
      magicalAddress = lines.slice(1).join('\n');
    }
    
    console.log('📝 Split name:', envelopeName);
    console.log('🏠 Split address:', magicalAddress);
  } else {
    // Use separate fields as normal
    envelopeName = orderData.childName || orderData.familyNames || '';
    magicalAddress = orderData.magicalAddress || '';
    
    // Handle literal \n characters
    envelopeName = envelopeName.replace(/\\n/g, '\n');
    magicalAddress = magicalAddress.replace(/\\n/g, '\n');
  }

  // Format name for HTML
  const formattedEnvelopeName = envelopeName
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('<br>');
    
  console.log('📝 Formatted name for HTML:', formattedEnvelopeName);
  
  // Format address for HTML
  let formattedAddress = '';
  if (magicalAddress.includes('\n')) {
    formattedAddress = magicalAddress
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('<br>');
  } 
  else if (magicalAddress.includes('|')) {
    formattedAddress = magicalAddress
      .split('|')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('<br>');
  } else {
    formattedAddress = magicalAddress;
  }
  
  console.log('🏠 Formatted address for HTML:', formattedAddress);
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${css}</style>
</head>
<body>
  <div class="envelope-container">
    <div class="envelope-name">
      ${formattedEnvelopeName}
    </div>
    
    <div class="envelope-address">
      ${formattedAddress}
    </div>
  </div>
  
  <script>${getEnvelopeScript()}</script>
</body>
</html>
  `;
  
  return html;
}

// Main PDF generation function
async function generatePDF(orderData) {
  console.log('🎅 Generating PDFs for order:', orderData.orderNumber);
   
  const cleanOrderNumber = orderData.orderNumber.replace('#', '');
  
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });

  try {
    const griffithsBoldBase64 = await fileToBase64(path.join(__dirname, '../fonts/GriffithsBold.ttf'));
    const lilyWangBase64 = await fileToBase64(path.join(__dirname, '../fonts/LilyWang.otf'));
    const backgroundBase64 = await fileToBase64(path.join(__dirname, '../background.png'));

    // === GENERATE LETTER ===
    const letterPage = await browser.newPage();
    await letterPage.setViewport({
      width: 680,
      height: 906
    });

    const styles = await loadCSS(griffithsBoldBase64, lilyWangBase64);

    let letterContent;
    let finalTextForFile; // This will hold the corrected text for the .txt file

    // Check if we're using corrected text directly
    if (orderData.directLetterContent) {
      console.log('📝 Using corrected text directly');
      console.log('📝 Raw text received:', orderData.directLetterContent);
      
      let fullText = orderData.directLetterContent;
      
      // Handle literal \n characters and remove escaped asterisks
      fullText = fullText
        .replace(/\\n/g, '\n')
        .replace(/\\\*/g, '*')     // Convert \* to *
        .replace(/\\\"/g, '"')     // Convert \" to "
        .replace(/\\\'/g, "'");    // Convert \' to '
        
      console.log('📝 After cleaning escaped characters:', fullText);
      
      // Extract P.S. message
      const psMatch = fullText.match(/P\.S\.\s+(.+)$/m);
      if (psMatch) {
        orderData.psMessage = psMatch[1];
        fullText = fullText.substring(0, psMatch.index).trim();
        console.log('📝 Extracted P.S.:', orderData.psMessage);
      }
      
      // Store the corrected text for the .txt file
      finalTextForFile = fullText;
      if (orderData.psMessage) {
        finalTextForFile += `\n\nP.S. ${orderData.psMessage}`;
      }
      
      // Convert to HTML for PDF rendering
      let paragraphs;
      if (fullText.includes('\n\n')) {
        console.log('📝 Found double newlines - treating as paragraph breaks');
        paragraphs = fullText
          .split('\n\n')
          .filter(p => p.trim())
          .map(p => {
            const formattedP = p.trim().replace(/\n/g, '<br>');
            return `<p>${formattedP}</p>`;
          })
          .join('\n');
      } else {
        console.log('📝 No double newlines found - creating single paragraph with line breaks');
        paragraphs = `<p>${fullText.trim().replace(/\n/g, '<br>')}</p>`;
      }
      
      letterContent = paragraphs;
      console.log('📝 Final processed paragraphs:', paragraphs.substring(0, 300) + '...');
    } else {
      // Normal template processing
      const templateFilename = getTemplateFilename(orderData.template, orderData.letterYear, orderData.letterType);
      console.log(`📄 Using template: ${templateFilename}`);
      const templateHtml = await fetchTemplate(templateFilename);
      letterContent = processTemplateContent(templateHtml, orderData);
      
      // For normal templates, we'll extract text from the rendered page
      finalTextForFile = null; // Will be extracted from rendered page
    }

    const fontClass = orderData.font === 'Fancy' ? 'fancy-font' : 'block-font';
    const year = orderData.letterYear || '2025';

    // Build letter HTML
    const letterHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${styles}</style>
</head>
<body>
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
  
  <script>${getDynamicSizingScript()}</script>
</body>
</html>
    `;

    // Ensure output directory exists
    const outputDir = path.join(__dirname, '../output');
    await fs.mkdir(outputDir, { recursive: true });

    // Set content and generate letter PDF
    await letterPage.setContent(letterHtml, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    const letterPdfBuffer = await letterPage.pdf({
      width: '180mm',
      height: '240mm',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    
    // Create filename
    const nameForFile = orderData.letterName || orderData.childrenNames || orderData.familyNames || orderData.childName || 'Unknown';
    const nameClean = nameForFile
      .replace(/[^a-z0-9]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .substring(0, 50);
    
    // Save letter PDF
    const letterFilename = `order-${cleanOrderNumber}-${nameClean}-letter.pdf`;
    const letterFilepath = path.join(__dirname, '../output', letterFilename);
    await fs.writeFile(letterFilepath, letterPdfBuffer);
    console.log('✅ Letter PDF saved:', letterFilename);
    
    // Generate text file - use corrected text if available, otherwise extract from page
    const textFilename = `order-${cleanOrderNumber}-${nameClean}-letter.txt`;
    const textFilepath = path.join(__dirname, '../output', textFilename);

    let finalText;
    if (finalTextForFile) {
      // Use the corrected text we stored earlier
      finalText = finalTextForFile;
      console.log('📝 Using corrected text for .txt file');
    } else {
      // Extract from rendered page (for normal templates)
      const plainText = await letterPage.evaluate(() => {
        const content = document.querySelector('.letter-content');
        if (!content) return '';
        
        const paragraphs = content.querySelectorAll('p');
        const textArray = [];
        
        paragraphs.forEach(p => {
          const text = p.innerText || p.textContent || '';
          const cleanText = text.trim();
          if (cleanText && cleanText.length > 0) {
            textArray.push(cleanText);
          }
        });
        
        return textArray.join('\n\n');
      });

      finalText = plainText;
      if (orderData.psMessage) {
        const cleanPS = orderData.psMessage.replace(/<[^>]*>/g, '').trim();
        if (cleanPS) {
          finalText += `\n\nP.S. ${cleanPS}`;
        }
      }
    }

    // Save text file
    await fs.writeFile(textFilepath, finalText, 'utf8');
    console.log('📝 Text file saved:', textFilename);
    console.log('📝 Text content preview:', finalText.substring(0, 200) + '...');
    
    await letterPage.close();
    
    // === GENERATE ENVELOPE ===
    const envelopePage = await browser.newPage();
    await envelopePage.setViewport({
      width: 718,
      height: 491
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
    const envelopeFilename = `order-${cleanOrderNumber}-${nameClean}-envelope.pdf`;
    const envelopeFilepath = path.join(__dirname, '../output', envelopeFilename);
    await fs.writeFile(envelopeFilepath, envelopePdfBuffer);
    console.log('✅ Envelope PDF saved:', envelopeFilename);
    
    await envelopePage.close();
    console.log('✅ Both PDFs generated successfully');
    
    return {
      success: true,
      letter: {
        filename: letterFilename,
        path: letterFilepath,
        url: `/pdfs/${letterFilename}`
      },
      letterText: {
        filename: textFilename,
        path: textFilepath,
        url: `/pdfs/${textFilename}`
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

module.exports = { 
  generatePDF,
  getTemplateFilename,
  fetchTemplate,
  processTemplateContent
};



