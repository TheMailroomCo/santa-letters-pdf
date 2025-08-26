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

// Convert Shopify template name to GitHub filename
function getTemplateFilename(templateName, letterYear, letterType) {
  // Individual Letter (Backdated) should use the template field even if it exists
  // For backdated individual letters, the template IS required
  if (letterType === 'Individual Letter (Backdated)') {
    // Individual backdated MUST have a template selected
    if (!templateName) {
      console.error('❌ Individual Letter (Backdated) requires a template but none provided');
      // Default to a safe fallback or throw error
      throw new Error('Individual Letter (Backdated) requires a template selection');
    }
    // Use the template map below to get the right file
  }
  
  // Handle letter types that don't use template field
  if (!templateName || templateName === '') {
    if (letterType === 'Write Your Own Letter') {
      return 'write-your-own.html';
    }
    // Check if letterType contains "Family Letter"
    if (letterType && letterType.includes('Family Letter')) {
      // Check if it's backdated based on the letterType string
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
    'Write Your Own': 'write-your-own.html'
  };
  
  return templateMap[templateName] || kebabCase(templateName) + '.html';
}

// Convert string to kebab-case
function kebabCase(str) {
  if (!str) return '';  // This fixes the null error
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
  
  // Handle Write Your Own Letter FIRST, before other replacements
  if (orderData.letterType === 'Write Your Own Letter' && orderData.achievement) {
    // First, check what we're receiving
    console.log('🔍 Raw achievement:', orderData.achievement);
    console.log('🔍 Raw achievement character codes:', orderData.achievement.split('').slice(0, 100).map(c => c.charCodeAt(0)));
    
    let content = orderData.achievement;
    
    // Handle different types of line breaks that might come from Make.com
    // First, normalize all line breaks to a consistent format
    content = content
      .replace(/\\n/g, '\n')  // Convert literal \n to actual newlines
      .replace(/\r\n/g, '\n') // Convert Windows line breaks
      .replace(/\r/g, '\n');  // Convert old Mac line breaks
    
    console.log('📝 Content after normalization:', content);
    console.log('📝 Looking for double newlines:', content.includes('\n\n'));
    
    let paragraphs;
    
    // Check if we have <br> tags
    if (content.includes('<br>')) {
      console.log('📝 Found <br> tags, processing as HTML');
      // Look for double <br> as paragraph separators
      if (content.includes('<br><br>') || content.includes('<br> <br>')) {
        // Split on double <br> tags for paragraphs
        paragraphs = content
          .split(/<br>\s*<br>/)
          .filter(p => p.trim())
          .map(p => {
            // Keep single <br> tags within paragraphs
            const cleaned = p.trim();
            return `<p>${cleaned}</p>`;
          })
          .join('\n');
      } else {
        // No double <br>, so treat the whole thing as one paragraph with line breaks
        paragraphs = `<p>${content.trim()}</p>`;
      }
    } 
    // Otherwise use newlines
    else {
      console.log('📝 Processing newline-separated content');
      
      // Check if we have double newlines (paragraph breaks)
      if (content.includes('\n\n')) {
        console.log('📝 Found double newlines, treating as paragraph breaks');
        // Split on double newlines for paragraphs
        paragraphs = content
          .split(/\n\s*\n/)  // Split on double newlines
          .filter(p => p.trim())
          .map(p => {
            // Keep single newlines as <br> within paragraphs
            const cleaned = p.trim().replace(/\n/g, '<br>');
            return `<p>${cleaned}</p>`;
          })
          .join('\n');
      } else {
        console.log('📝 No double newlines found, treating as single paragraph with line breaks');
        // No double newlines, so it's all one paragraph with line breaks
        // Replace single newlines with <br> tags
        const lines = content.trim().replace(/\n/g, '<br>');
        paragraphs = `<p>${lines}</p>`;
      }
    }
    
    console.log('📝 Generated HTML:', paragraphs);
    console.log('📊 Number of paragraphs created:', (paragraphs.match(/<p>/g) || []).length);
    
    // Replace the {achievement} placeholder with our formatted paragraphs
    processedHtml = processedHtml.replace('{achievement}', paragraphs);
    
    console.log('✅ Replaced achievement placeholder');
    console.log('📄 Final content preview:', processedHtml.substring(0, 500));
    console.log('🎨 Font inheritance check - container has font class:', orderData.font);
    
    return processedHtml;  // Return early, skip other processing for Write Your Own
  }
  
  // Process pronouns based on parentPronouns field
  let pronouns = {
    they: 'They',
    their: 'their',
    Their: 'Their'
  };
  
  // If single parent, use their pronouns
  if (orderData.parentPronouns) {
    if (orderData.parentPronouns.includes('she')) {
      pronouns = { they: 'She', their: 'her', Their: 'Her' };
    } else if (orderData.parentPronouns.includes('he')) {
      pronouns = { they: 'He', their: 'his', Their: 'His' };
    }
    // Keep default they/their if pronouns are they/them or not specified
  }
  
  // Map of placeholders to data fields
  const placeholderMap = {
    '{name}': orderData.childName || orderData.letterName || '',
    '{childName}': orderData.childName || '',
    '{letterName}': orderData.letterName || '',
    '{achievement}': orderData.achievement || '',
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
    '{font}': orderData.font || '',  // No default - should come from Shopify (Fancy or Block)
    '{envelopeColor}': orderData.envelopeColor || '',  // No default - should come from Shopify (Red or Green)
    '{pronoun_They}': pronouns.they,
    '{pronoun_their}': pronouns.their,
    '{pronoun_Their}': pronouns.Their
  };
  
  // Replace all placeholders
  Object.entries(placeholderMap).forEach(([placeholder, value]) => {
    // Escape special characters in the value for HTML
    const escapedValue = escapeHtml(value);
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
    processedHtml = processedHtml.replace(regex, escapedValue);
  });
  
  return processedHtml;  // Return for all other letter types
}

// Escape HTML special characters
function escapeHtml(text) {
  if (!text) return '';
  
  // Check if this text has <br> tags that should be preserved
  if (text.includes('<br>')) {
    return text
      .replace(/<br>/g, '|||LINEBREAK|||')  // Temporarily hide <br>
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\|\|\|LINEBREAK\|\|\|/g, '<br>');  // Restore <br>
  }
  
  // Normal escaping for other fields
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
    // Wait for fonts to load
    setTimeout(() => {
      const container = document.querySelector('.letter-content');
      if (!container) return;
      
      const isFancy = document.querySelector('.fancy-font') !== null;
      const isBlockFont = document.querySelector('.block-font') !== null;
      
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
          // IMPORTANT: Preserve font family and text stroke for block font
          if (isBlockFont) {
            p.style.fontFamily = 'Griffiths, Georgia, serif';
            p.style.webkitTextStroke = '0.142pt #000000';
            p.style.textStroke = '0.142pt #000000';
          } else if (isFancy) {
            p.style.fontFamily = 'LilyWang, cursive';
          }
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
      
      // Apply best fit to all paragraphs with font styles
      container.querySelectorAll('p').forEach(p => {
        p.style.fontSize = bestFit + 'pt';
        p.style.lineHeight = isFancy ? '1.15' : '1.3';
        // IMPORTANT: Apply font family and stroke
        if (isBlockFont) {
          p.style.fontFamily = 'Griffiths, Georgia, serif';
          p.style.webkitTextStroke = '0.142pt #000000';
          p.style.textStroke = '0.142pt #000000';
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
          // Start with SAME size as main text (inherit)
          psText.style.fontSize = bestFit + 'pt';
          psText.style.lineHeight = '1.05'; // Tight spacing for P.S.
          
          // Apply font styles to P.S. as well
          if (isBlockFont) {
            psText.style.fontFamily = 'Griffiths, Georgia, serif';
            psText.style.webkitTextStroke = '0.142pt #000000';
            psText.style.textStroke = '0.142pt #000000';
          } else if (isFancy) {
            psText.style.fontFamily = 'LilyWang, cursive';
          }
          
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

// Script to handle dynamic centering of envelope text
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
   
  // Declare cleanOrderNumber ONCE at the top
  const cleanOrderNumber = orderData.orderNumber.replace('#', '');
  
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });

  try {
    // Load all assets as base64  
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

    // FETCH TEMPLATE FROM GITHUB
    const templateFilename = getTemplateFilename(orderData.template, orderData.letterYear, orderData.letterType);
    console.log(`📄 Using template: ${templateFilename}`);
    const templateHtml = await fetchTemplate(templateFilename);
    
    // Process template content with order data
    const letterContent = processTemplateContent(templateHtml, orderData);

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

    // CSS DEBUG CODE for Write Your Own
    if (orderData.letterType === 'Write Your Own Letter') {
      console.log('🎨 CSS Debug for Write Your Own:');
      console.log('  Font class being used:', fontClass);
      console.log('  Font value from order:', orderData.font);
      console.log('  Letter content preview (first 500 chars):', letterContent.substring(0, 500));
      console.log('  Letter content includes <p> tags:', letterContent.includes('<p>'));
      console.log('  Full HTML includes letter-content div:', letterHtml.includes('class="letter-content"'));
      console.log('  Font class in container:', letterHtml.includes(`class="letter-container ${fontClass}"`));
    }

    // Ensure output directory exists
    const outputDir = path.join(__dirname, '../output');
    await fs.mkdir(outputDir, { recursive: true });
    console.log('📁 Output directory ready:', outputDir);

    // Set content and generate letter PDF
    await letterPage.setContent(letterHtml, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    const letterPdfBuffer = await letterPage.pdf({
      width: '180mm',
      height: '240mm',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    
    // Create a clean filename using letterName, childrenNames, familyNames, or "Unknown" as fallback
    const nameForFile = orderData.letterName || orderData.childrenNames || orderData.familyNames || orderData.childName || 'Unknown';
    const nameClean = nameForFile
      .replace(/[^a-z0-9]/gi, '-')  // Replace non-alphanumeric with dashes
      .replace(/-+/g, '-')           // Replace multiple dashes with single
      .replace(/^-|-$/g, '')         // Remove leading/trailing dashes
      .toLowerCase()
      .substring(0, 50);             // Limit length
    
    // Save letter PDF
    const letterFilename = `order-${cleanOrderNumber}-${nameClean}-letter.pdf`;
    const letterFilepath = path.join(__dirname, '../output', letterFilename);
    await fs.writeFile(letterFilepath, letterPdfBuffer);
    console.log('✅ Letter PDF saved to:', letterFilepath);
    console.log('📄 Letter file size:', letterPdfBuffer.length, 'bytes');
    // Generate plain text version for editing
const textFilename = `order-${cleanOrderNumber}-${nameClean}-letter.txt`;
const textFilepath = path.join(__dirname, '../output', textFilename);

let plainText = letterContent
  .replace(/<p>/g, '\n')           
  .replace(/<\/p>/g, '\n')         
  .replace(/<br>/g, '\n')          
  .replace(/<strong>/g, '')        
  .replace(/<\/strong>/g, '')
  .replace(/<[^>]*>/g, '')         
  .replace(/\n\n\n+/g, '\n\n')    
  .trim();

if (orderData.psMessage) {
  plainText += `\n\nP.S. ${orderData.psMessage}`;
}

// Save text file alongside PDF
await fs.writeFile(textFilepath, plainText, 'utf8');
console.log('📝 Text file saved:', textFilename);
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
    
    // Save envelope PDF (using same nameClean from above)
    const envelopeFilename = `order-${cleanOrderNumber}-${nameClean}-envelope.pdf`;
    const envelopeFilepath = path.join(__dirname, '../output', envelopeFilename);
    await fs.writeFile(envelopeFilepath, envelopePdfBuffer);
    console.log('✅ Envelope PDF saved to:', envelopeFilepath);
    console.log('📄 Envelope file size:', envelopePdfBuffer.length, 'bytes');
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

module.exports = { generatePDF };







