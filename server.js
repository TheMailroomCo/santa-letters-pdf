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

// Test endpoint with all envelope variations
app.get('/test', async (req, res) => {
  const testCases = [
    // SHORT: Single child + standard address
    {
      orderNumber: "ENV001",
      itemNumber: "1",
      template: "Magic & Stardust",
      font: "Block",
      childName: "Miss Charlotte Ella Smith",
      magicalAddress: `In the house by the beach, where dreams are had
While best friend Bella sleeps at the foot of her bed.
Byron Bay, Nsw`,
      letterName: "Charlotte",
      location: "Byron Bay",
      achievement: "helped teach her baby sister to walk",
      psMessage: "Keep being an amazing big sister!",
      letterYear: "2025"
    },
    
    // MEDIUM: 2-3 kids
    {
      orderNumber: "ENV002",
      itemNumber: "1",
      template: "Magic & Stardust",
      font: "Fancy",
      childName: "Miss Alexander Smith & Miss Charlotte Thompson-Williams",
      magicalAddress: `In the white house names Rosie.
Where children are often heard playing
in the magnificent green pool
Geelong West, Victoria`,
      letterName: "Alexander and Charlotte",
      location: "Canberra",
      achievement: "shared their toys without being asked",
      letterYear: "2025"
    },
    
    // MAXIMUM: Max characters test (exactly 95 characters for name)
    {
      orderNumber: "ENV003",
      itemNumber: "1",
      template: "Magic & Stardust",
      font: "Block",
      childName: "Master Alexander Benjamin Christopher Davidson-Montgomery III & Miss Elizabeth Victoria Rose II",
      magicalAddress: `In the white house names Rosie.
Where children are often heard playing
in the magnificent green pool
Geelong West, Victoria`,
      letterName: "Alexander and Elizabeth",
      location: "Darwin",
      achievement: "showed exceptional patience and understanding",
      letterYear: "2025"
    }
  ];

  // Generate all PDFs
  const results = [];
  
  for (const testCase of testCases) {
    try {
      const result = await generatePDF(testCase);
      results.push({
        orderNumber: testCase.orderNumber,
        childName: testCase.childName,
        nameLength: testCase.childName.length,
        font: testCase.font,
        addressLines: testCase.magicalAddress.split('\n').length,
        letterUrl: result.letter.url,
        envelopeUrl: result.envelope.url,
        success: true
      });
    } catch (error) {
      results.push({
        orderNumber: testCase.orderNumber,
        childName: testCase.childName,
        nameLength: testCase.childName.length,
        error: error.message,
        success: false
      });
    }
  }

  // Build simple HTML response with clickable links
  let html = `
    <html>
    <head>
      <title>Santa Letters Test Results</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .test { margin-bottom: 30px; padding: 20px; border: 1px solid #ccc; }
        .success { background-color: #e7f5e7; }
        .error { background-color: #f5e7e7; }
        a { margin-right: 20px; }
        .char-count { font-weight: bold; color: #0066cc; }
      </style>
    </head>
    <body>
      <h1>🎅 Santa Letters Test Results</h1>
      <p><a href="/">Back to Home</a></p>
      <hr>
  `;

  results.forEach((result, index) => {
    const testType = index === 0 ? "SHORT" : index === 1 ? "MEDIUM" : "MAXIMUM";
    const isMaxTest = index === 2;
    const charCountStyle = isMaxTest && result.nameLength === 95 ? 'color: green;' : isMaxTest ? 'color: red;' : '';
    
    html += `
      <div class="test ${result.success ? 'success' : 'error'}">
        <h3>Test ${index + 1} (${testType}): ${result.orderNumber}</h3>
        <p><strong>Child Name:</strong> ${result.childName}</p>
        <p><strong>Name Length:</strong> <span class="char-count" style="${charCountStyle}">${result.nameLength} characters</span> ${isMaxTest ? '(Target: 95)' : ''}</p>
        <p><strong>Font:</strong> ${result.font}</p>
        <p><strong>Address Lines:</strong> ${result.addressLines}</p>
        ${result.success ? `
          <p>
            <a href="${result.letterUrl}" target="_blank">📄 View Letter PDF</a>
            <a href="${result.envelopeUrl}" target="_blank">✉️ View Envelope PDF</a>
          </p>
        ` : `
          <p style="color: red;"><strong>Error:</strong> ${result.error}</p>
        `}
      </div>
    `;
  });

  html += `
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

// Start server
app.listen(PORT, () => {
  console.log(`🎅 Santa Letter PDF Server running on port ${PORT}`);
});
