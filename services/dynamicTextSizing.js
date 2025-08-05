// services/dynamicTextSizing.js

// Convert rem to pt for PDF (1rem = 12pt typically)
const REM_TO_PT = 12;

const dynamicTextSizingScript = `
  function applyDynamicTextSizing() {
    const container = document.querySelector('.letter-content');
    if (!container) return;
    
    // Get the actual available height in pixels
    const containerRect = container.getBoundingClientRect();
    const availableHeight = containerRect.height;
    
    // Check if using Fancy font
    const letterContainer = document.querySelector('.letter-container');
    const isFancyFont = letterContainer && letterContainer.classList.contains('fancy-font');
    
    // Starting values (converted from rem to pt)
    let fontSize = isFancyFont ? 26.4 : 25.2; // 2.2rem : 2.1rem in pt
    const minFontSize = 10.8; // 0.9rem in pt
    const maxFontSize = 42; // 3.5rem in pt
    
    const paragraphs = container.querySelectorAll('p');
    
    function applyFontSize(size) {
      paragraphs.forEach(paragraph => {
        paragraph.style.fontSize = size + 'pt';
        paragraph.style.lineHeight = isFancyFont ? '1.15' : '1.3';
      });
    }
    
    // Binary search algorithm
    let low = minFontSize;
    let high = maxFontSize;
    let bestFit = fontSize;
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts && (high - low) > 0.5) {
      const mid = (low + high) / 2;
      applyFontSize(mid);
      
      // Force reflow
      container.offsetHeight;
      
      const contentHeight = container.scrollHeight;
      
      if (contentHeight <= availableHeight) {
        bestFit = mid;
        low = mid;
      } else {
        high = mid;
      }
      
      attempts++;
    }
    
    // Apply the best fit
    applyFontSize(bestFit);
    
    // Handle P.S. message sizing
    const psMessage = document.querySelector('.ps-message');
    if (psMessage) {
      const psText = psMessage.querySelector('p');
      if (psText) {
        // Start with the same size as main text
        let psFontSize = bestFit;
        psText.style.fontSize = psFontSize + 'pt';
        
        // Check if it overflows and scale down to 85% if needed
        const psHeight = psMessage.getBoundingClientRect().height;
        if (psText.scrollHeight > psHeight) {
          psFontSize = bestFit * 0.85;
          psText.style.fontSize = psFontSize + 'pt';
        }
      }
    }
    
    return bestFit;
  }
  
  // Execute the sizing
  applyDynamicTextSizing();
`;

module.exports = { dynamicTextSizingScript };
