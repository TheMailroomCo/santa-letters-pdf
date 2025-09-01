const express = require('express');
const path = require('path');
const { generatePDF } = require('./services/pdfGenerator');
const { generatePresentLabels } = require('./services/presentLabelGenerator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Serve PDFs statically
app.use('/pdfs', express.static(path.join(__dirname, 'output')));

// Health check endpoint
app.get('/', (req, res) => {
  res.send(`
    <h1>🎅 Santa Letter PDF Generator</h1>
    <p>Server is running!</p>
    <p><a href="/test">Run Letter Tests</a></p>
    <p><a href="/test-labels">Test Present Labels</a></p>
  `);
});

// Replace your existing /test endpoint with this version that tests both fonts:

app.get('/test', async (req, res) => {
  const testCases = [
    {
      orderNumber: "TEST-BLOCK",
      itemNumber: "1",
      template: "Snow Globe Heart",
      font: "Block",
      childName: "Master Parker Jack",
      magicalAddress: `In the Land Where Magic Never Sleeps
Under Star-Filled Skies of Midnight Blue
Perth, Australia`,
      letterName: "Parker Jack",
      location: "Windaroo",
      achievement: "handled your big feelings with such grace",
      psMessage: "Keep believing in magic, Parker Jack!",
      letterYear: "2025"
    },
    {
      orderNumber: "TEST-FANCY",
      itemNumber: "1", 
      template: "Snow Globe Heart",
      font: "Fancy",
      childName: "Master Parker Jack",
      magicalAddress: `In the Land Where Magic Never Sleeps
Under Star-Filled Skies of Midnight Blue
Perth, Australia`,
      letterName: "Parker Jack",
      location: "Windaroo",
      achievement: "handled your big feelings with such grace",
      psMessage: "Keep believing in magic, Parker Jack!",
      letterYear: "2025"
    }
  ];

  const results = [];
  
  for (const testCase of testCases) {
    try {
      const result = await generatePDF(testCase);
      results.push({
        font: testCase.font,
        letterUrl: result.letter.url,
        textUrl: result.letterText.url,
        envelopeUrl: result.envelope.url,
        success: true
      });
    } catch (error) {
      results.push({
        font: testCase.font,
        error: error.message,
        success: false
      });
    }
  }

  // Build HTML response with both test results
  let html = `
    <html>
    <head>
      <title>Font Test - Block vs Fancy</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          padding: 20px; 
          background: #f5f5f5;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .test-row {
          margin-bottom: 30px;
          padding: 20px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          background: #fafafa;
        }
        .test-row h3 {
          margin-top: 0;
          color: #333;
        }
        .block-font {
          border-left: 5px solid #4CAF50;
        }
        .fancy-font {
          border-left: 5px solid #2196F3;
        }
        a.button {
          display: inline-block;
          margin-right: 10px;
          padding: 8px 16px;
          background: #008CBA;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          font-size: 14px;
        }
        a.button:hover {
          background: #006687;
        }
        .letter-btn { background: #4CAF50; }
        .letter-btn:hover { background: #45a049; }
        .text-btn { background: #ff9800; }
        .text-btn:hover { background: #e68900; }
        .envelope-btn { background: #9C27B0; }
        .envelope-btn:hover { background: #7B1FA2; }
        .error {
          color: red;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎅 Font Test: Block vs Fancy</h1>
        <p style="color: #666;">Testing the same letter content with both font styles</p>
        <hr style="margin: 20px 0;">
  `;

  results.forEach(result => {
    const fontClass = result.font === 'Block' ? 'block-font' : 'fancy-font';
    html += `
      <div class="test-row ${fontClass}">
        <h3>${result.font} Font</h3>
        ${result.success ? `
          <p>
            <a href="${result.letterUrl}" target="_blank" class="button letter-btn">📄 Letter PDF</a>
            <a href="${result.textUrl}" target="_blank" class="button text-btn">📝 Text File</a>
            <a href="${result.envelopeUrl}" target="_blank" class="button envelope-btn">✉️ Envelope</a>
          </p>
        ` : `
          <p class="error">Error: ${result.error}</p>
        `}
      </div>
    `;
  });

  html += `
        <hr style="margin: 30px 0 20px 0;">
        <p><a href="/" class="button" style="background: #555;">← Back to Home</a></p>
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

// Webhook endpoint for Make.com
app.post('/generate-pdf', async (req, res) => {
  try {
    console.log('📥 Received webhook:', JSON.stringify(req.body, null, 2));
    
    const result = await generatePDF(req.body);
    
    res.json({
  success: true,
  letter: {
    filename: result.letter.filename,
    url: `${req.protocol}://${req.get('host')}${result.letter.url}`
  },
  letterText: {
    filename: result.letterText.filename,
    url: `${req.protocol}://${req.get('host')}${result.letterText.url}`
  },
  envelope: {
    filename: result.envelope.filename,
    url: `${req.protocol}://${req.get('host')}${result.envelope.url}`
  }
});
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// New endpoint for present labels
app.post('/generate-present-labels', async (req, res) => {
  try {
    console.log('🎁 Received present labels webhook:', JSON.stringify(req.body, null, 2));
    
    const result = await generatePresentLabels(req.body);
    
    res.json({
      success: true,
      filename: result.filename,
      url: `${req.protocol}://${req.get('host')}${result.url}`
    });
  } catch (error) {
    console.error('❌ Error generating present labels:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint for present labels
app.get('/test-labels', async (req, res) => {
  const testData = {
    orderNumber: "TEST001",
    childName: "Sophie"
  };
  
  try {
    const result = await generatePresentLabels(testData);
    res.send(`
      <h1>🎁 Present Labels Test</h1>
      <p>Generated successfully!</p>
      <p><a href="${result.url}" target="_blank">View PDF</a></p>
      <p><a href="/">Back to Home</a></p>
    `);
  } catch (error) {
    res.send(`
      <h1>Error</h1>
      <p>${error.message}</p>
      <p><a href="/">Back to Home</a></p>
    `);
  }
});

// Test endpoint for present labels
app.get('/test-labels', async (req, res) => {
  const testData = {
    orderNumber: "TEST001",
    childName: "Sophie"
  };
  
  try {
    const result = await generatePresentLabels(testData);
    res.send(`
      <h1>🎁 Present Labels Test</h1>
      <p>Generated successfully!</p>
      <p><a href="${result.url}" target="_blank">View PDF</a></p>
      <p><a href="/">Back to Home</a></p>
    `);
  } catch (error) {
    res.send(`
      <h1>Error</h1>
      <p>${error.message}</p>
      <p><a href="/">Back to Home</a></p>
    `);
  }
});

// ADD THIS NEW TEST ROUTE HERE
app.get('/test-merge', async (req, res) => {
  const testData = {
    orderNumber: "TEST001",
    template: "Magic & Stardust",
    font: "Block",
    letterType: "Individual Letter",
    childName: "Sophie",
    letterName: "Sophie",
    location: "Melbourne",
    achievement: "learning to ride her bike",
    psMessage: "keep being awesome",
    magicalAddress: "123 Snowflake Lane\nNorth Pole",
    letterYear: "2025"
  };
  
  try {
    const { getTemplateFilename, fetchTemplate, processTemplateContent } = require('./services/pdfGenerator');
    
    // Get template filename
    const templateFilename = getTemplateFilename(
      testData.template, 
      testData.letterYear, 
      testData.letterType
    );
    
    // Fetch template from GitHub
    const templateHtml = await fetchTemplate(templateFilename);
    
    // Process template with data
    const mergedContent = processTemplateContent(templateHtml, testData);
    
    // Convert HTML to plain text
    const plainText = mergedContent
      .replace(/<p>/g, '')
      .replace(/<\/p>/g, '\n\n')
      .replace(/<span[^>]*>/g, '')
      .replace(/<\/span>/g, '')
      .replace(/<br>/g, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    let fullLetter = plainText;
    if (testData.psMessage) {
      fullLetter += `\n\nP.S. ${testData.psMessage}`;
    }
    
    const envelopeText = `${testData.childName}\n${testData.magicalAddress}`;
    
    res.json({
      success: true,
      letterText: fullLetter,
      envelopeText: envelopeText,
      metadata: testData
    });
    
  } catch (error) {
    res.json({ error: error.message });
  }
});


// NEW ENDPOINT: Merge template without generating PDF
app.post('/merge-template', async (req, res) => {
  try {
    console.log('📝 Merging template for order:', req.body.orderNumber);
    
    // Import the functions we need from pdfGenerator
    const { getTemplateFilename, fetchTemplate, processTemplateContent } = require('./services/pdfGenerator');
    
    // Get template filename
    const templateFilename = getTemplateFilename(
      req.body.template, 
      req.body.letterYear, 
      req.body.letterType
    );
    
    // Fetch template from GitHub
    const templateHtml = await fetchTemplate(templateFilename);
    
    // Process template with data (this returns HTML with variables replaced)
    const mergedContent = processTemplateContent(templateHtml, req.body);
    
    // Convert HTML to plain text for Claude review
    const plainText = mergedContent
      .replace(/<p>/g, '')
      .replace(/<\/p>/g, '\n\n')
      .replace(/<span[^>]*>/g, '')
      .replace(/<\/span>/g, '')
      .replace(/<br>/g, '\n')
      .replace(/<[^>]*>/g, '') // Remove all other HTML tags
      .replace(/\n{3,}/g, '\n\n') // Clean up excess line breaks
      .trim();
    
    // Add P.S. if exists
    let fullLetter = plainText;
    if (req.body.psMessage) {
      fullLetter += `\n\nP.S. ${req.body.psMessage}`;
    }
    
    // Also prepare envelope text for review
    const envelopeText = `${req.body.childName || req.body.familyNames || ''}\n${req.body.magicalAddress || ''}`;
    
    res.json({
      success: true,
      letterText: fullLetter,
      envelopeText: envelopeText,
      metadata: {
        template: req.body.template,
        font: req.body.font,
        orderNumber: req.body.orderNumber,
        childName: req.body.childName
      }
    });
    
  } catch (error) {
    console.error('❌ Template merge error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🎅 Santa Letter PDF Server running on port ${PORT}`);
});




