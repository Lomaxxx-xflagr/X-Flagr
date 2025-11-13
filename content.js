/**
 * X-Flagr (X.com Mod Community Tool)
 * Content Script
 * 
 * Professional moderation tool for X.com/Twitter. Handles user marking 
 * and label display on X.com/Twitter pages.
 * 
 * @version 1.0.1
 * 
 * Copyright (c) 2025 by Lomaxxx
 * 
 * This software and associated documentation files (the "Software") are 
 * proprietary and confidential. Unauthorized copying, modification, 
 * distribution, or use of this Software, via any medium, is strictly 
 * prohibited without the express written permission of Lomaxxx.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, 
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 */

/**
 * Security Utilities - HTML and CSS escaping functions
 */
class SecurityUtils {
  /**
   * Escape HTML special characters to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  static escapeHtml(text) {
    if (typeof text !== 'string') {
      text = String(text);
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Validate and sanitize hex color value
   * @param {string} color - Color value to validate
   * @returns {string} Validated hex color or default
   */
  static validateHexColor(color) {
    if (typeof color !== 'string') {
      return '#ff405c'; // Default color
    }
    // Remove any whitespace
    color = color.trim();
    // Check if it's a valid hex color
    if (/^#[0-9A-F]{6}$/i.test(color)) {
      return color;
    }
    // If invalid, return default
    return '#ff405c';
  }
}

class XModHelper {
  constructor() {
    this.markedUsers = {};
    this.rules = [];
    this.labelsEnabled = true;
    this.observer = null;
    this.quickMarkPopup = null;
    this.processedButtons = new WeakSet();
    this.buttonCheckInterval = null;
    this.isCommunityCached = null;
    this.lastUrl = location.href;
    this.init();
  }

  async init() {
    // Always bind message listener (needed for communication)
    this.bindMessageListener();
    
    // Check if we're on a community page - if not, don't initialize
    if (!this.isCommunityPage()) {
      // Still start button check interval to detect when we enter a community
      this.startButtonCheckInterval();
      return;
    }
    
    await this.loadRules();
    await this.loadMarkedUsers();
    await this.loadSettings();
    this.startObserving();
    this.startButtonCheckInterval();
  }

  isCommunityPage() {
    // Check if URL changed - if so, clear cache
    const currentUrl = location.href;
    if (currentUrl !== this.lastUrl) {
      this.isCommunityCached = null;
      this.lastUrl = currentUrl;
    }
    
    // Return cached result if available
    if (this.isCommunityCached !== null) {
      return this.isCommunityCached;
    }
    
    // Method 1: Check if current URL is a community page (most reliable)
    const pathname = window.location.pathname;
    if (pathname.includes('/i/communities/')) {
      this.isCommunityCached = true;
      return true;
    }
    
    // Method 2: Check if we're viewing a single tweet that belongs to a community
    // Only check if we're on a status page (single tweet view)
    if (pathname.match(/^\/\w+\/status\/\d+$/)) {
      // Look for community breadcrumb in the navigation/header area ONLY
      // Must be in a navigation context, not in tweet content
      const nav = document.querySelector('nav[role="navigation"]') || 
                  document.querySelector('nav') ||
                  document.querySelector('[role="navigation"]');
      
      if (nav) {
        // Check for community links in navigation ONLY
        const navCommunityLinks = nav.querySelectorAll('a[href*="/i/communities/"]');
        for (const link of navCommunityLinks) {
          const href = link.getAttribute('href') || '';
          // Must be a community link (not a status link)
          if (href.includes('/i/communities/') && !href.includes('/status/')) {
            // Verify it's not in tweet content by checking if it's in a tweet article
            const isInTweet = link.closest('article[data-testid="tweet"]');
            if (!isInTweet) {
              this.isCommunityCached = true;
              return true;
            }
          }
        }
      }
      
      // Also check for community-specific data attributes in the main content area
      // (but NOT in tweet content itself)
      const mainContent = document.querySelector('main[role="main"]');
      if (mainContent) {
        // Look for community indicators that are NOT inside tweets
        const communityIndicators = mainContent.querySelectorAll('[data-testid*="community"]');
        for (const indicator of communityIndicators) {
          // Must NOT be inside a tweet
          const isInTweet = indicator.closest('article[data-testid="tweet"]');
          if (!isInTweet) {
            // Check if it's in a header/navigation context
            const isInHeader = indicator.closest('header') || 
                              indicator.closest('nav') ||
                              indicator.closest('[role="navigation"]');
            if (isInHeader) {
              this.isCommunityCached = true;
              return true;
            }
          }
        }
      }
    }
    
    // If we're not on a community URL and not on a status page with community context, it's not a community
    this.isCommunityCached = false;
    return false;
  }

  async loadRules() {
    try {
      const result = await chrome.storage.local.get(['rules']);
      this.rules = result.rules || [];
    } catch (error) {
      this.rules = [];
    }
  }

  async loadMarkedUsers() {
    try {
      const result = await chrome.storage.local.get(['markedUsers']);
      this.markedUsers = result.markedUsers || {};
    } catch (error) {
      this.markedUsers = {};
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['labelsEnabled']);
      this.labelsEnabled = result.labelsEnabled !== false; // Default to true
    } catch (error) {
      this.labelsEnabled = true;
    }
  }

  startObserving() {
    // Only start observing if we're on a community page
    if (!this.isCommunityPage()) {
      return;
    }
    
    // Use MutationObserver to watch for new content
    this.observer = new MutationObserver((mutations) => {
      // Check if still on community page before processing
      if (!this.isCommunityPage()) {
        return;
      }
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.processNewContent(node);
            }
          });
        }
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });

    // Process existing content with delays to ensure page is fully loaded
    const processWithDelay = () => {
      setTimeout(() => {
    this.processExistingContent();
      }, 100);
    };
    
    // Process immediately
    processWithDelay();
    
    // Process after short delay
    setTimeout(() => {
      this.processExistingContent();
    }, 500);
    
    // Process after longer delay to catch late-loading content
    setTimeout(() => {
      this.processExistingContent();
    }, 2000);
    
    // Process again after page is fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          this.processExistingContent();
        }, 1000);
      });
    } else {
      // Page already loaded, process after a delay
      setTimeout(() => {
        this.processExistingContent();
      }, 1000);
    }
    
    // Handle X.com's SPA navigation
    this.lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== this.lastUrl) {
        this.lastUrl = url;
        // Clear community cache on navigation
        this.isCommunityCached = null;
        
        // Clear processed buttons cache on navigation
        this.processedButtons = new WeakSet();
        
        // Re-check community status after navigation
        setTimeout(() => {
          this.isCommunityCached = null; // Force re-check
          const isCommunity = this.isCommunityPage();
          
          if (!isCommunity) {
            // If we navigated away from community, stop processing
            this.removeAllLabels();
            // Remove all mark buttons
            const buttons = document.querySelectorAll('.xmod-mark-button');
            buttons.forEach(btn => btn.remove());
            // Stop observer
            if (this.observer) {
              this.observer.disconnect();
              this.observer = null;
            }
            return;
          }
          
          // If we're in a community, ensure everything is initialized
          if (isCommunity && !this.observer) {
            this.startObserving();
          }
          
          // Process content
          this.processExistingContent();
        }, 1000);
      }
    }).observe(document, { subtree: true, childList: true });
    
    // Continuous button check - ensures buttons are always present
    this.startButtonCheckInterval();
  }

  startButtonCheckInterval() {
    // Clear existing interval if any
    if (this.buttonCheckInterval) {
      clearInterval(this.buttonCheckInterval);
    }
    
    // Check for missing buttons every 2 seconds
    this.buttonCheckInterval = setInterval(() => {
      // Always clear cache to re-check community status
      // (community indicators might appear later in SPA navigation)
      this.isCommunityCached = null;
      
      const isCommunity = this.isCommunityPage();
      
      if (!isCommunity) {
        // If not in community, remove any existing buttons and labels
        const buttons = document.querySelectorAll('.xmod-mark-button');
        if (buttons.length > 0) {
          buttons.forEach(btn => btn.remove());
        }
        // Also stop observer if running
        if (this.observer && !this.isCommunityPage()) {
          this.observer.disconnect();
          this.observer = null;
        }
        return;
      }
      
      // If we're in a community but observer is not running, start it
      if (!this.observer && isCommunity) {
        this.startObserving();
        // Also load data if not loaded
        if (this.rules.length === 0) {
          this.loadRules();
        }
        if (Object.keys(this.markedUsers).length === 0) {
          this.loadMarkedUsers();
        }
      }
      
      // Find all username elements and ensure they have buttons
      const usernameElements = document.querySelectorAll('[data-testid="User-Name"], [data-testid="UserName"]');
      usernameElements.forEach(element => {
        const username = this.extractUsername(element);
        if (!username) {
          return;
        }
        
        // Check if button exists for this username in the tweet
        const tweetContainer = element.closest('article[data-testid="tweet"]') || 
                              element.closest('[data-testid="tweet"]') ||
                              element.closest('[role="article"]') ||
                              element.closest('article');
        
        if (tweetContainer) {
          const existingButton = tweetContainer.querySelector(`.xmod-mark-button[data-username="${username}"]`);
          if (!existingButton) {
            // Button is missing, inject it
            this.injectMarkButton(element);
          }
        } else {
          // Even without tweet container, try to inject button
          // (for tweet details view)
          const existingButton = document.querySelector(`.xmod-mark-button[data-username="${username}"]`);
          if (!existingButton) {
            this.injectMarkButton(element);
          }
        }
      });
    }, 2000);
  }

  processExistingContent() {
    // Only process if we're on a community page
    if (!this.isCommunityPage()) {
      return;
    }
    
    // Find all username elements using multiple selectors
    const selectors = [
      '[data-testid="User-Name"]',
      '[data-testid="UserName"]'
    ];
    
    const processedElements = new Set();
    
    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          // Use element itself as unique identifier
          if (!processedElements.has(element)) {
            processedElements.add(element);
            if (this.labelsEnabled) {
      this.markUser(element);
            }
            // Always inject mark buttons (don't check processedButtons here)
            this.injectMarkButton(element);
          }
        });
      } catch (e) {
        // Silently ignore selector errors
      }
    });
  }

  processNewContent(node) {
    // Only process if we're on a community page
    if (!this.isCommunityPage()) {
      return;
    }
    
    // Check if the node is a username element
    if (node.matches && (node.matches('[data-testid="User-Name"]') || node.matches('[data-testid="UserName"]'))) {
      if (this.labelsEnabled) {
        this.markUser(node);
      }
      this.injectMarkButton(node);
      return;
    }
    
    // Check if the node is a tweet container
    const isTweetContainer = node.matches && (
      node.matches('article[data-testid="tweet"]') || 
      node.matches('[data-testid="tweet"]') || 
      node.matches('[role="article"]') ||
      node.matches('article')
    );
    
    if (isTweetContainer) {
      const usernameElement = node.querySelector('[data-testid="User-Name"], [data-testid="UserName"]');
      if (usernameElement) {
        if (this.labelsEnabled) {
          this.markUser(usernameElement);
        }
        this.injectMarkButton(usernameElement);
      }
    } else if (node.querySelectorAll) {
      // Check if node contains username elements or tweet containers
      const usernameElements = node.querySelectorAll('[data-testid="User-Name"], [data-testid="UserName"]');
      usernameElements.forEach(element => {
        if (this.labelsEnabled) {
          this.markUser(element);
        }
        this.injectMarkButton(element);
      });
      
      // Also check for tweet containers
      const tweetContainers = node.querySelectorAll('article[data-testid="tweet"], [data-testid="tweet"], [role="article"], article');
      tweetContainers.forEach(container => {
        const usernameElement = container.querySelector('[data-testid="User-Name"], [data-testid="UserName"]');
        if (usernameElement) {
          if (this.labelsEnabled) {
            this.markUser(usernameElement);
          }
          this.injectMarkButton(usernameElement);
        }
      });
    }
  }

  findUsernameElements() {
    // X.com uses different selectors for usernames
    const selectors = [
      '[data-testid="User-Name"]',
      '[data-testid="UserName"]',
      'a[href*="/"] span',
      '[role="link"] span',
      'article div[dir="ltr"] span',
      'div[data-testid="tweet"] a[role="link"] span',
      'div[data-testid="tweetText"] + div a span',
      'article a[href*="/"] span',
      'div[role="article"] a[href*="/"] span'
    ];

    let elements = [];
    selectors.forEach(selector => {
      try {
        const found = Array.from(document.querySelectorAll(selector));
        elements = elements.concat(found);
      } catch (e) {
        // Silently ignore selector errors
      }
    });

    // Filter out duplicates and invalid elements
    return elements.filter((element, index, arr) => {
      return arr.indexOf(element) === index && 
             element.textContent && 
             element.textContent.trim().length > 0;
    });
  }

  markUser(element) {
    // Only mark users if we're on a community page
    if (!this.isCommunityPage()) {
      return;
    }

    if (!this.labelsEnabled) {
      return;
    }

    const username = this.extractUsername(element);
    
    if (!username) {
      return;
    }
    
    if (!this.markedUsers[username.toLowerCase()]) {
      return;
    }

    const userData = this.markedUsers[username.toLowerCase()];
    
    // Find the tweet container - try multiple methods
    let tweetContainer = element.closest('article[data-testid="tweet"]');
    if (!tweetContainer) {
      tweetContainer = element.closest('[data-testid="tweet"]');
    }
    if (!tweetContainer) {
      tweetContainer = element.closest('[role="article"]');
    }
    if (!tweetContainer) {
      tweetContainer = element.closest('article');
    }
    
    // Find the User-Name container - try multiple methods
    let container = null;
    if (tweetContainer) {
      container = tweetContainer.querySelector('[data-testid="User-Name"]');
      if (!container) {
        container = tweetContainer.querySelector('[data-testid="UserName"]');
      }
    }
    
    // Fallback: use the element's parent or closest User-Name container
    if (!container) {
      container = element.closest('[data-testid="User-Name"], [data-testid="UserName"]');
    }
    if (!container) {
      container = element.parentElement;
    }
    
    if (!container) {
      return;
    }
    
    // Remove ALL existing labels and wrappers in this tweet container first to avoid duplicates
    if (tweetContainer) {
      const existingLabels = tweetContainer.querySelectorAll('.xmod-label');
      existingLabels.forEach(label => {
        label.remove();
      });
      const existingWrappers = tweetContainer.querySelectorAll('.xmod-labels-wrapper');
      existingWrappers.forEach(wrapper => {
        wrapper.remove();
      });
    } else {
      // Fallback: remove labels and wrappers from container
      const existingLabels = container.querySelectorAll('.xmod-label');
      existingLabels.forEach(label => {
        label.remove();
      });
      const existingWrappers = container.querySelectorAll('.xmod-labels-wrapper');
      existingWrappers.forEach(wrapper => {
        wrapper.remove();
      });
    }
    
    // Support both old and new data structure
    let rulesToDisplay = [];
    
    if (userData.rules && typeof userData.rules === 'object') {
      // New structure: multiple rules
      Object.keys(userData.rules).forEach(ruleId => {
        const ruleData = userData.rules[ruleId];
        rulesToDisplay.push({
          ruleId: ruleId,
          count: ruleData.count || 1,
          firstTimestamp: ruleData.firstTimestamp || userData.timestamp
        });
      });
    } else if (userData.rule) {
      // Old structure: single rule (migration support)
      rulesToDisplay.push({
        ruleId: userData.rule,
        count: userData.count || 1,
        firstTimestamp: userData.timestamp
      });
    }
    
    if (rulesToDisplay.length === 0) {
      return;
    }
    
    // Find the insertion point: header row, insert directly before GROK/options icons
    let insertionPoint = null;
    let referenceElement = null;
    
    if (tweetContainer && container) {
      // Find the parent container that holds both User-Name and the icons
      // This is typically the first row/header of the tweet
      const headerRow = container.parentElement;
      
      if (headerRow) {
        // Ensure header row is a flex container
        const computedStyle = window.getComputedStyle(headerRow);
        if (computedStyle.display !== 'flex' && computedStyle.display !== 'inline-flex') {
          headerRow.style.display = 'flex';
          headerRow.style.alignItems = 'center';
        }
        
        // Look for GROK icon or options menu icons specifically
        // X.com uses various selectors for these icons
        const grokIcon = tweetContainer.querySelector('[aria-label*="Grok"], [aria-label*="grok"], [data-testid*="grok"]');
        const optionsMenu = tweetContainer.querySelector('[data-testid="caret"]')?.closest('div[role="button"]');
        const moreButton = tweetContainer.querySelector('div[role="button"][aria-label*="More"], div[role="button"][aria-label*="Mehr"]');
        
        // Find the icon container (parent of the icon) that is a direct child of headerRow
        if (grokIcon) {
          let iconContainer = grokIcon.closest('div');
          // Make sure it's a direct child of headerRow or find the direct child that contains it
          while (iconContainer && iconContainer.parentElement !== headerRow && iconContainer !== headerRow) {
            iconContainer = iconContainer.parentElement;
          }
          if (iconContainer && iconContainer.parentElement === headerRow) {
            referenceElement = iconContainer;
            insertionPoint = headerRow;
          }
        }
        
        if (!referenceElement && optionsMenu) {
          let iconContainer = optionsMenu.closest('div');
          while (iconContainer && iconContainer.parentElement !== headerRow && iconContainer !== headerRow) {
            iconContainer = iconContainer.parentElement;
          }
          if (iconContainer && iconContainer.parentElement === headerRow) {
            referenceElement = iconContainer;
            insertionPoint = headerRow;
          }
        }
        
        if (!referenceElement && moreButton) {
          let iconContainer = moreButton.closest('div');
          while (iconContainer && iconContainer.parentElement !== headerRow && iconContainer !== headerRow) {
            iconContainer = iconContainer.parentElement;
          }
          if (iconContainer && iconContainer.parentElement === headerRow) {
            referenceElement = iconContainer;
            insertionPoint = headerRow;
          }
        }
        
        if (!referenceElement) {
          // Fallback: Look for any div with role="button" or containing SVG icons
          const headerChildren = Array.from(headerRow.children || []);
          
          // Find the rightmost element that contains buttons or SVGs
          for (let i = headerChildren.length - 1; i >= 0; i--) {
            const child = headerChildren[i];
            
            // Skip if it's the User-Name container
            if (child === container || child.contains(container)) {
              continue;
            }
            
            // Check if this child contains icons (buttons, SVGs, etc.)
            const hasIcons = child.querySelector && (
              child.querySelector('[data-testid="caret"]') ||
              child.querySelector('div[role="button"]') ||
              child.querySelector('svg') ||
              child.querySelector('button') ||
              child.querySelector('[aria-label*="More"]') ||
              child.querySelector('[aria-label*="Mehr"]')
            );
            
            if (hasIcons) {
              referenceElement = child;
              insertionPoint = headerRow;
              break;
            }
          }
          
          // If still no reference, use the last child
          if (!referenceElement && headerChildren.length > 0) {
            const lastChild = headerChildren[headerChildren.length - 1];
            if (lastChild !== container && !lastChild.contains(container)) {
              referenceElement = lastChild;
              insertionPoint = headerRow;
            }
          }
        }
      } else {
        // Fallback: use container's parent
        insertionPoint = container.parentElement;
      }
    }
    
    // Create labels for each rule violation
    // Wrap all labels in a container to ensure they stay horizontal
    try {
      // Check if a labels wrapper already exists
      let labelsWrapper = null;
      if (insertionPoint) {
        labelsWrapper = insertionPoint.querySelector('.xmod-labels-wrapper');
      }
      
      // Create wrapper if it doesn't exist
      if (!labelsWrapper) {
        labelsWrapper = document.createElement('div');
        labelsWrapper.className = 'xmod-labels-wrapper';
        labelsWrapper.style.display = 'inline-flex';
        labelsWrapper.style.alignItems = 'center';
        labelsWrapper.style.gap = '6px';
        labelsWrapper.style.flexDirection = 'row';
        labelsWrapper.style.flexShrink = '0';
        
        if (insertionPoint && referenceElement) {
          // Insert wrapper before the icons container (left of GROK/options)
          insertionPoint.insertBefore(labelsWrapper, referenceElement);
        } else if (insertionPoint) {
          // Fallback: insert at the end of the header row
          insertionPoint.appendChild(labelsWrapper);
        } else if (container) {
          // Fallback: insert at the end of the container
          container.appendChild(labelsWrapper);
        }
      }
      
      // Add all labels to the wrapper
      if (labelsWrapper) {
        rulesToDisplay.forEach(ruleInfo => {
          const label = this.createLabel(ruleInfo, userData);
          if (label) {
            labelsWrapper.appendChild(label);
          }
        });
      }
    } catch (error) {
      // Silently fail if DOM operation fails
    }
  }

  findTimestampElement(usernameElement) {
    // Try to find the timestamp element near the username
    // X.com uses various structures, so we try multiple approaches
    
    // Find the container that holds username, handle, and timestamp
    let container = usernameElement.closest('[data-testid="User-Name"], [data-testid="UserName"]');
    if (!container) {
      // Try to find parent article or tweet container
      container = usernameElement.closest('article, [data-testid="tweet"], [role="article"]');
      if (container) {
        // Look for User-Name container within the article
        const userContainer = container.querySelector('[data-testid="User-Name"], [data-testid="UserName"]');
        if (userContainer) {
          container = userContainer;
        }
      }
      if (!container) {
        container = usernameElement.parentElement;
      }
    }
    
    if (container) {
      // Method 1: Look for time element
      const timeElement = container.querySelector('time');
      if (timeElement) {
        return timeElement;
      }
      
      // Method 2: Look for span with time-like text (e.g., "1 Std.", "2h", etc.)
      // Search in the same container and its siblings
      const allSpans = container.querySelectorAll('span');
      for (let span of allSpans) {
        const text = span.textContent?.trim() || '';
        // Match time patterns like "1 Std.", "2h", "3 Min.", "vor 5 Min", etc.
        if (/^\d+\s*(Std\.|h|Min\.|Min|m|Tag|d|Woche|w)$/i.test(text) || 
            /^vor\s+\d+/i.test(text) ||
            /^\d+\s*(hour|min|day|week|month|year)/i.test(text) ||
            /^\d+[smhd]$/i.test(text)) {
          // Make sure it's not part of the username or handle
          const parentText = span.parentElement?.textContent || '';
          if (!parentText.includes('@') || parentText.includes(text)) {
            return span;
          }
        }
      }
      
      // Method 3: Look for element with data-testid containing "Time"
      const timeTestId = container.querySelector('[data-testid*="Time"], [data-testid*="time"]');
      if (timeTestId) {
        return timeTestId;
      }
      
      // Method 4: Look in parent's next siblings for time element
      let parent = container.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const containerIndex = siblings.indexOf(container);
        if (containerIndex >= 0) {
          // Check next siblings
          for (let i = containerIndex + 1; i < Math.min(containerIndex + 5, siblings.length); i++) {
            const sibling = siblings[i];
            const timeInSibling = sibling.querySelector?.('time, [data-testid*="Time"], [data-testid*="time"]');
            if (timeInSibling) {
              return timeInSibling;
            }
            // Check for time-like text in sibling
            const spans = sibling.querySelectorAll?.('span') || [];
            for (let span of spans) {
              const text = span.textContent?.trim() || '';
              if (/^\d+\s*(Std\.|h|Min\.|Min|m|Tag|d|Woche|w)$/i.test(text) || 
                  /^\d+[smhd]$/i.test(text)) {
                return span;
              }
            }
          }
        }
      }
    }
    
    return null;
  }

  extractUsername(element) {
    // Try different methods to extract username
    let username = null;

    // Method 1: Find link within User-Name container (most reliable for X.com)
    const container = element.closest('[data-testid="User-Name"], [data-testid="UserName"]');
    if (container) {
      const linkElement = container.querySelector('a[href*="/"]');
      if (linkElement) {
        const href = linkElement.getAttribute('href');
        const match = href.match(/\/([^\/\?]+)/);
        if (match && match[1] !== 'home' && match[1] !== 'explore' && match[1] !== 'i' && match[1] !== 'search') {
          username = match[1];
        }
      }
    }

    // Method 2: From href attribute of closest link
    if (!username) {
    const linkElement = element.closest('a[href*="/"]');
    if (linkElement) {
      const href = linkElement.getAttribute('href');
      const match = href.match(/\/([^\/\?]+)/);
        if (match && match[1] !== 'home' && match[1] !== 'explore' && match[1] !== 'i' && match[1] !== 'search') {
        username = match[1];
        }
      }
    }

    // Method 3: From text content (look for @username pattern)
    if (!username) {
      const text = element.textContent || '';
      const match = text.match(/@([a-zA-Z0-9_]+)/);
      if (match) {
        username = match[1];
      }
    }

    // Method 4: Look for parent elements with href
    if (!username) {
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        if (parent.tagName === 'A' && parent.href) {
          const match = parent.href.match(/\/([^\/\?]+)/);
          if (match && match[1] !== 'home' && match[1] !== 'explore' && match[1] !== 'i' && match[1] !== 'search') {
            username = match[1];
            break;
          }
        }
        parent = parent.parentElement;
      }
    }

    return username;
  }

  createLabel(ruleInfo, userData) {
    if (!ruleInfo || !ruleInfo.ruleId) return null;
    
    // Convert ruleId to string for consistent comparison
    const ruleIdStr = String(ruleInfo.ruleId);
    
    const rule = this.getRule(ruleIdStr);
    if (!rule) return null;
    
    const count = ruleInfo.count || 1;
    
    const label = document.createElement('span');
    // Validate ruleId: allow numeric IDs (Date.now() generates numbers) and alphanumeric with underscore
    // Numeric IDs are safe (only digits), alphanumeric with underscore is also safe
    const safeRuleId = /^[0-9]+$/.test(ruleIdStr) || /^[a-zA-Z0-9_]+$/.test(ruleIdStr) 
      ? ruleIdStr 
      : 'invalid';
    // Validate and sanitize color
    const safeColor = SecurityUtils.validateHexColor(rule.color);
    label.className = `xmod-label user-label rule-${safeRuleId}`;
    label.style.backgroundColor = safeColor;
    label.style.borderColor = safeColor;
    label.style.color = '#ffffff';
    
    // Only show counter, not rule name
    label.textContent = count.toString();
    
    // Escape rule name for title attribute
    const safeRuleName = SecurityUtils.escapeHtml(rule.name);
    label.title = `${safeRuleName} violated (${count}x)`;
    
    // Add click handler to show details
    label.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.showUserDetails(userData, e);
    });

    return label;
  }

  getRule(ruleId) {
    return this.rules.find(r => r.id === ruleId || r.id === ruleId.toString());
  }

  getRuleText(ruleId) {
    const rule = this.getRule(ruleId);
    return rule ? rule.name : 'Unknown';
  }

  showUserDetails(userData, event) {
    // Support both old and new data structure
    let rulesList = [];
    
    if (userData.rules && typeof userData.rules === 'object') {
      // New structure: multiple rules
      Object.keys(userData.rules).forEach(ruleId => {
        const ruleData = userData.rules[ruleId];
        const rule = this.getRule(ruleId);
        if (rule) {
          rulesList.push({
            name: rule.name,
            color: rule.color,
            count: ruleData.count || 1,
            firstTimestamp: ruleData.firstTimestamp || userData.timestamp
          });
        }
      });
    } else if (userData.rule) {
      // Old structure: single rule (migration support)
      const rule = this.getRule(userData.rule);
      rulesList.push({
        name: rule ? rule.name : this.getRuleText(userData.rule),
        color: rule ? rule.color : '#ff405c',
        count: userData.count || 1,
        firstTimestamp: userData.timestamp
      });
    }
    
    // SVG Icons (inline, guaranteed to work)
    const userIconSVG = `<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256s256-114.6 256-256S397.4 0 256 0zm0 96c39.5 0 71.6 32.1 71.6 71.6s-32.1 71.6-71.6 71.6s-71.6-32.1-71.6-71.6S216.5 96 256 96zm0 320c-52.9 0-100.8-21.5-135.5-56.2c18.3-33.7 55.1-56.2 96.5-56.2h78c41.4 0 78.2 22.5 96.5 56.2C356.8 394.5 308.9 416 256 416z"/></svg>`;
    const calendarIconSVG = `<svg width="12" height="12" viewBox="0 0 448 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M96 32V64H48C21.5 64 0 85.5 0 112v48H448V112c0-26.5-21.5-48-48-48H352V32c0-17.7-14.3-32-32-32s-32 14.3-32 32V64H160V32c0-17.7-14.3-32-32-32S96 14.3 96 32zM448 192H0V464c0 26.5 21.5 48 48 48H400c26.5 0 48-21.5 48-48V192z"/></svg>`;
    
    // Build tooltip content with modern card design
    let tooltipBody = '';
    if (rulesList.length > 0) {
      rulesList.forEach((ruleInfo, index) => {
        const date = new Date(ruleInfo.firstTimestamp);
        const formattedDate = date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
        const formattedTime = date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        
        const safeRuleName = SecurityUtils.escapeHtml(ruleInfo.name);
        const safeColor = SecurityUtils.validateHexColor(ruleInfo.color);
        const safeCount = SecurityUtils.escapeHtml(ruleInfo.count.toString());
        const safeDate = SecurityUtils.escapeHtml(formattedDate);
        const safeTime = SecurityUtils.escapeHtml(formattedTime);
        tooltipBody += `
          <div class="xmod-violation-card" style="border-left-color: ${safeColor};">
            <div class="xmod-violation-header">
              <div class="xmod-violation-color-indicator" style="background-color: ${safeColor};"></div>
              <div class="xmod-violation-info">
                <div class="xmod-violation-name">${safeRuleName}</div>
                <div class="xmod-violation-count">${safeCount}x violation${ruleInfo.count > 1 ? 's' : ''}</div>
              </div>
            </div>
            <div class="xmod-violation-date">
              <span class="xmod-icon-svg">${calendarIconSVG}</span>
              <span>First: ${safeDate} ${safeTime}</span>
            </div>
          </div>
        `;
      });
    } else {
      tooltipBody = '<div class="xmod-no-violations">No violations recorded</div>';
    }
    
    const tooltip = document.createElement('div');
    tooltip.className = 'xmod-tooltip';
    tooltip.innerHTML = `
      <div class="xmod-tooltip-content">
        <div class="xmod-tooltip-header">
          <span class="xmod-icon-svg">${userIconSVG}</span>
          <span>User Details</span>
        </div>
        <div class="xmod-tooltip-body">
          ${tooltipBody}
        </div>
      </div>
    `;

    document.body.appendChild(tooltip);

    // Position tooltip
    if (event && event.target) {
    const rect = event.target.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 5}px`;
    tooltip.style.zIndex = '10000';
    } else {
      // Fallback: center the tooltip
      tooltip.style.position = 'fixed';
      tooltip.style.left = '50%';
      tooltip.style.top = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      tooltip.style.zIndex = '10000';
    }

    // Remove tooltip after 3 seconds
    setTimeout(() => {
      if (tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip);
      }
    }, 3000);
  }

  bindMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
      if (message.action === 'toggleLabels') {
        this.labelsEnabled = message.enabled;
        if (this.labelsEnabled) {
            // Process immediately
          this.processExistingContent();
            // Process again after delays to catch any late-loading content
            setTimeout(() => {
              this.processExistingContent();
            }, 300);
            setTimeout(() => {
              this.processExistingContent();
            }, 1000);
        } else {
          this.removeAllLabels();
        }
        sendResponse({ success: true });
          return true;
      } else if (message.action === 'refreshUsers') {
          // Remove all labels immediately before loading new data
          this.removeAllLabels();
          // Clear processed buttons cache to allow re-injection
          this.processedButtons = new WeakSet();
        this.loadMarkedUsers().then(() => {
            // Process immediately if labels are enabled
            if (this.labelsEnabled) {
              this.processExistingContent();
              // Process again after a short delay to catch any late-loading content
              setTimeout(() => {
                if (this.labelsEnabled) {
                  this.processExistingContent();
                }
              }, 300);
              // Process once more after a longer delay
              setTimeout(() => {
                if (this.labelsEnabled) {
                  this.processExistingContent();
                }
              }, 1000);
            }
            // Always inject buttons, even if labels are disabled
            this.processExistingContent();
            sendResponse({ success: true });
          }).catch((error) => {
            sendResponse({ success: false, error: error.message });
          });
          return true; // Keep message channel open for async response
        } else if (message.action === 'refreshRules') {
          this.loadRules().then(() => {
          this.removeAllLabels();
          this.processExistingContent();
          sendResponse({ success: true });
          }).catch((error) => {
            sendResponse({ success: false, error: error.message });
        });
          return true; // Keep message channel open for async response
      }
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      return false;
    });
  }

  removeAllLabels() {
    try {
      // Remove all labels
    const labels = document.querySelectorAll('.xmod-label');
      labels.forEach(label => {
        if (label && label.parentNode) {
          label.remove();
        }
      });
      
      // Remove all label wrappers
      const wrappers = document.querySelectorAll('.xmod-labels-wrapper');
      wrappers.forEach(wrapper => {
        if (wrapper && wrapper.parentNode) {
          wrapper.remove();
        }
      });
    } catch (error) {
      // Silently fail if DOM operation fails
    }
  }

  injectMarkButton(usernameElement) {
    try {
      // Only inject button if we're on a community page
      if (!this.isCommunityPage()) {
        return;
      }
      
      if (!usernameElement || !usernameElement.parentElement) {
        return;
      }
      
      const username = this.extractUsername(usernameElement);
      if (!username) {
        return;
      }

      // Button should always be shown, even if user is already marked
      // (so user can add more violations)

      // Find tweet container first - try multiple methods
      let tweetContainer = usernameElement.closest('article[data-testid="tweet"]');
      if (!tweetContainer) {
        tweetContainer = usernameElement.closest('[data-testid="tweet"]');
      }
      if (!tweetContainer) {
        tweetContainer = usernameElement.closest('[role="article"]');
      }
      if (!tweetContainer) {
        tweetContainer = usernameElement.closest('article');
      }
      // Also check parent elements
      if (!tweetContainer) {
        let parent = usernameElement.parentElement;
        let depth = 0;
        while (parent && depth < 10) {
          if (parent.matches && (parent.matches('article') || parent.querySelector('article'))) {
            tweetContainer = parent.querySelector('article') || parent;
            break;
          }
          parent = parent.parentElement;
          depth++;
        }
      }

      if (!tweetContainer) {
        // Still try to inject button even without tweet container
        // Sometimes in tweet details, the structure is different
      }

      // Check if button already exists (prevent duplicates)
      let existingButton = null;
      if (tweetContainer) {
        existingButton = tweetContainer.querySelector(`.xmod-mark-button[data-username="${username}"]`);
      } else {
        // Check in a wider area if no tweet container found
        const allButtons = document.querySelectorAll(`.xmod-mark-button[data-username="${username}"]`);
        // Check if any button is near this username element
        for (const btn of allButtons) {
          const btnContainer = btn.closest('article') || btn.closest('[role="article"]');
          const usernameContainer = usernameElement.closest('article') || usernameElement.closest('[role="article"]');
          if (btnContainer === usernameContainer) {
            existingButton = btn;
            break;
          }
        }
      }
      
      if (existingButton) {
        // Button already exists, don't add another one
        return;
      }

      // Create button
      const button = document.createElement('button');
      button.className = 'xmod-mark-button';
      button.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
      button.title = 'Mark User';
      button.setAttribute('data-username', username);

      // Add click handler
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.handleMarkButtonClick(usernameElement, username, e);
      });

      // Find profile picture container - try multiple approaches
      let profileContainer = null;
      
      if (tweetContainer) {
        // Method 1: Look for avatar container with data-testid
        profileContainer = tweetContainer.querySelector('[data-testid="Tweet-User-Avatar"]');
        
        // Method 2: Look for first image that looks like a profile picture
        if (!profileContainer) {
          const images = tweetContainer.querySelectorAll('img');
          for (const img of images) {
            const src = img.getAttribute('src') || '';
            const alt = img.getAttribute('alt') || '';
            // Check if it's likely a profile picture
            if (src.includes('profile_images') || 
                src.includes('pbs.twimg.com') && (src.includes('profile') || img.closest('a[href*="/"]'))) {
              profileContainer = img.closest('a') || img.parentElement;
              break;
            }
          }
        }
        
        // Method 3: Look for first link with an image (profile link)
        if (!profileContainer) {
          const profileLinks = tweetContainer.querySelectorAll('a[href*="/"]');
          for (const link of profileLinks) {
            const img = link.querySelector('img');
            if (img) {
              profileContainer = link;
              break;
            }
          }
        }
      } else {
        // If no tweet container, search in parent elements
        let searchElement = usernameElement.parentElement;
        let depth = 0;
        while (searchElement && depth < 15) {
          const img = searchElement.querySelector('img[src*="profile"], img[src*="pbs.twimg.com"]');
          if (img) {
            profileContainer = img.closest('a') || img.parentElement;
            break;
          }
          searchElement = searchElement.parentElement;
          depth++;
        }
      }

      // Insert button after profile container
      if (profileContainer && profileContainer.parentElement) {
        // Check if button already exists after this profile container
        const nextSibling = profileContainer.nextSibling;
        if (nextSibling && nextSibling.classList && nextSibling.classList.contains('xmod-mark-button')) {
          return;
        }
        // Insert button right after the profile container
        try {
          profileContainer.parentElement.insertBefore(button, profileContainer.nextSibling);
        } catch (e) {
          // Fallback: append to parent
          profileContainer.parentElement.appendChild(button);
        }
      } else if (tweetContainer) {
        // Fallback: try to find any image and insert after it
        const firstImage = tweetContainer.querySelector('img');
        if (firstImage && firstImage.parentElement) {
          try {
            firstImage.parentElement.insertBefore(button, firstImage.nextSibling);
          } catch (e) {
            firstImage.parentElement.appendChild(button);
          }
        } else {
          // Last fallback: insert at beginning of tweet container
          try {
            tweetContainer.insertBefore(button, tweetContainer.firstChild);
          } catch (e) {
            tweetContainer.appendChild(button);
          }
        }
      } else {
        // Last resort: try to insert near username element
        const parent = usernameElement.parentElement;
        if (parent) {
          try {
            // Try to find a good position near the username
            const usernameContainer = usernameElement.closest('[data-testid="User-Name"], [data-testid="UserName"]');
            if (usernameContainer && usernameContainer.parentElement) {
              usernameContainer.parentElement.insertBefore(button, usernameContainer.nextSibling);
            } else {
              parent.insertBefore(button, usernameElement.nextSibling);
            }
          } catch (e) {
            // Final fallback: append to parent
            parent.appendChild(button);
          }
        }
      }
    } catch (error) {
      // Silently fail
    }
  }

  async handleMarkButtonClick(usernameElement, username, event) {
    try {
      console.log('handleMarkButtonClick called:', { username, usernameElement });
      
      // Get tweet text for auto-detection
      const tweetContainer = usernameElement.closest('article[data-testid="tweet"]') || 
                            usernameElement.closest('[data-testid="tweet"]') ||
                            usernameElement.closest('[role="article"]') ||
                            usernameElement.closest('article');
      
      let tweetText = '';
      if (tweetContainer) {
        const tweetTextElement = tweetContainer.querySelector('[data-testid="tweetText"]');
        if (tweetTextElement) {
          tweetText = tweetTextElement.textContent || '';
        }
      }

      console.log('Showing popup for username:', username);
      // Show quick mark popup
      this.showQuickMarkPopup(username, tweetText, event, usernameElement);
    } catch (error) {
      console.error('Error in handleMarkButtonClick:', error);
    }
  }

  detectViolation(tweetText) {
    if (!tweetText || !this.rules || this.rules.length === 0) {
      return null;
    }

    const textLower = tweetText.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    this.rules.forEach(rule => {
      // Simple keyword matching (can be enhanced with regex patterns)
      const ruleNameLower = rule.name.toLowerCase();
      const keywords = ruleNameLower.split(/\s+/);
      
      let score = 0;
      keywords.forEach(keyword => {
        if (keyword.length > 3 && textLower.includes(keyword)) {
          score += keyword.length;
        }
      });

      // Check for common violation patterns
      const commonPatterns = {
        'gambling': ['gambling', 'bet', 'casino', 'slot', 'poker', 'wager'],
        'spam': ['spam', 'click here', 'free money', 'limited offer'],
        'scam': ['scam', 'fake', 'fraud', 'phishing'],
        'nsfw': ['nsfw', 'explicit', 'adult content'],
        'harassment': ['harassment', 'bully', 'threat', 'abuse']
      };

      Object.keys(commonPatterns).forEach(pattern => {
        if (ruleNameLower.includes(pattern)) {
          commonPatterns[pattern].forEach(keyword => {
            if (textLower.includes(keyword)) {
              score += 10;
            }
          });
        }
      });

      if (score > bestScore && score > 5) {
        bestScore = score;
        bestMatch = rule;
      }
    });

    return bestMatch;
  }

  showQuickMarkPopup(username, tweetText, event, usernameElement) {
    // Close existing popup
    this.closeQuickMarkPopup();

    // Detect potential violation
    const detectedRule = this.detectViolation(tweetText);

    // Get all rules (not just top 5)
    const allRules = this.rules;
    
    // Store usernameElement for later use
    this.currentMarkingUsernameElement = usernameElement;

    // Create popup
    const popup = document.createElement('div');
    popup.className = 'xmod-quick-mark-popup';
    popup.innerHTML = `
      <div class="xmod-quick-mark-header">
        <span>Mark @${SecurityUtils.escapeHtml(username)}</span>
        <button class="xmod-quick-mark-close" aria-label="Close">×</button>
      </div>
      <div class="xmod-quick-mark-body">
        ${detectedRule ? `
          <div class="xmod-quick-mark-suggestion">
            <span class="xmod-quick-mark-suggestion-label">Vermutlich:</span>
            <button class="xmod-quick-mark-rule-btn xmod-quick-mark-suggested" data-rule-id="${detectedRule.id}" style="background: ${SecurityUtils.validateHexColor(detectedRule.color)}; border-color: ${SecurityUtils.validateHexColor(detectedRule.color)};">
              ${SecurityUtils.escapeHtml(detectedRule.name)}
            </button>
          </div>
        ` : ''}
        <div class="xmod-quick-mark-rules">
          ${allRules.map(rule => `
            <button class="xmod-quick-mark-rule-btn" data-rule-id="${rule.id}" style="background: ${SecurityUtils.validateHexColor(rule.color)}; border-color: ${SecurityUtils.validateHexColor(rule.color)};">
              ${SecurityUtils.escapeHtml(rule.name)}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    this.quickMarkPopup = popup;

    // Find tweet container and profile picture for positioning
    const buttonElement = event.target.closest('.xmod-mark-button');
    const tweetContainer = buttonElement ? 
      (buttonElement.closest('article[data-testid="tweet"]') || 
       buttonElement.closest('[data-testid="tweet"]') ||
       buttonElement.closest('[role="article"]') ||
       buttonElement.closest('article')) : 
      null;

    // Find profile picture (avatar) in the tweet
    let profilePicture = null;
    if (tweetContainer) {
      // Try multiple selectors for profile picture
      profilePicture = tweetContainer.querySelector('img[src*="profile_images"]') ||
                      tweetContainer.querySelector('img[alt*="profile"]') ||
                      tweetContainer.querySelector('div[data-testid="Tweet-User-Avatar"] img') ||
                      tweetContainer.querySelector('a[href*="/"] img[src*="pbs.twimg.com"]') ||
                      tweetContainer.querySelector('img[src*="pbs.twimg.com"]');
    }

    // Position popup relative to profile picture or fallback to button
    let referenceRect;
    if (profilePicture) {
      referenceRect = profilePicture.getBoundingClientRect();
    } else if (buttonElement) {
      referenceRect = buttonElement.getBoundingClientRect();
    } else {
      referenceRect = event.target.getBoundingClientRect();
    }

    const popupRect = popup.getBoundingClientRect();
    
    // Position directly below the profile picture, aligned to the left edge of the picture
    let top = referenceRect.bottom + 8;
    let left = referenceRect.left;

    // Adjust if popup would go off screen (bottom)
    if (top + popupRect.height > window.innerHeight) {
      // Try above instead
      top = referenceRect.top - popupRect.height - 8;
      // If still off screen, position at bottom of viewport
      if (top < 0) {
        top = window.innerHeight - popupRect.height - 16;
      }
    }

    // Adjust if popup would go off screen (right)
    if (left + popupRect.width > window.innerWidth) {
      left = window.innerWidth - popupRect.width - 16;
    }
    
    // Adjust if popup would go off screen (left)
    if (left < 16) {
      left = 16;
    }

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;

    // Add event listeners
    popup.querySelector('.xmod-quick-mark-close')?.addEventListener('click', () => {
      this.closeQuickMarkPopup();
    });

    popup.querySelectorAll('.xmod-quick-mark-rule-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const ruleId = btn.getAttribute('data-rule-id');
        console.log('Button clicked:', { ruleId, username, hasMoreClass: btn.classList.contains('xmod-quick-mark-more') });
        
        if (btn.classList.contains('xmod-quick-mark-more')) {
          // Open extension popup for full rule list
          try {
            chrome.runtime.sendMessage({ action: 'openPopup' }).catch(() => {
              // Silently fail if extension context is invalidated
              console.warn('Could not open popup - extension may need reload');
            });
          } catch (error) {
            console.warn('Extension context invalidated:', error);
          }
          this.closeQuickMarkPopup();
        } else if (ruleId && ruleId.trim() !== '') {
          console.log('Calling markUserFromTweet with:', { username, ruleId });
          await this.markUserFromTweet(username, ruleId, this.currentMarkingUsernameElement);
          this.closeQuickMarkPopup();
        } else {
          console.error('No ruleId found for button:', btn);
        }
      });
    });

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick.bind(this), { once: true });
    }, 100);
  }

  handleOutsideClick(event) {
    if (this.quickMarkPopup && !this.quickMarkPopup.contains(event.target) && !event.target.closest('.xmod-mark-button')) {
      this.closeQuickMarkPopup();
    }
  }

  closeQuickMarkPopup() {
    if (this.quickMarkPopup) {
      this.quickMarkPopup.remove();
      this.quickMarkPopup = null;
    }
  }

  async markUserFromTweet(username, ruleId, usernameElement) {
    try {
      console.log('markUserFromTweet called with:', { username, ruleId, usernameElement });
      
      // Remove @ if present
      const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
      const usernameLower = cleanUsername.toLowerCase();
      const ruleIdStr = ruleId.toString();

      console.log('Processing:', { cleanUsername, usernameLower, ruleIdStr });

      // Get current marked users
      let result;
      try {
        result = await chrome.storage.local.get(['markedUsers']);
      } catch (error) {
        console.error('Error accessing storage:', error);
        alert('Error marking user: Extension context invalidated. Please reload the page.');
        return;
      }
      
      const users = result.markedUsers || {};
      console.log('Current users count:', Object.keys(users).length);

      // Initialize user data if it doesn't exist
      if (!users[usernameLower]) {
        users[usernameLower] = {
          rules: {},
          timestamp: Date.now()
        };
      }

      // Migrate old data structure if needed
      if (users[usernameLower].rule && !users[usernameLower].rules) {
        const oldRule = users[usernameLower].rule;
        const oldCount = users[usernameLower].count || 1;
        users[usernameLower].rules = {
          [oldRule]: {
            count: oldCount,
            firstTimestamp: users[usernameLower].timestamp || Date.now()
          }
        };
        delete users[usernameLower].rule;
        delete users[usernameLower].count;
      }

      // Initialize rules object if it doesn't exist
      if (!users[usernameLower].rules) {
        users[usernameLower].rules = {};
      }

      // Add or increment rule violation
      if (!users[usernameLower].rules[ruleIdStr]) {
        users[usernameLower].rules[ruleIdStr] = {
          count: 1,
          firstTimestamp: Date.now()
        };
      } else {
        users[usernameLower].rules[ruleIdStr].count += 1;
      }

      // Update last violation timestamp
      users[usernameLower].timestamp = Date.now();

      // Save to storage
      try {
        await chrome.storage.local.set({ markedUsers: users });
        console.log('User saved successfully:', usernameLower);
        console.log('User data:', users[usernameLower]);
      } catch (error) {
        console.error('Error saving user:', error);
        alert('Error marking user: Extension context invalidated. Please reload the page.');
        return;
      }

      // Reload marked users
      await this.loadMarkedUsers();
      
      // Update labels immediately for this specific user
      if (this.labelsEnabled) {
        // Find tweet container if usernameElement is available
        let tweetContainer = null;
        if (usernameElement) {
          tweetContainer = usernameElement.closest('article[data-testid="tweet"]') || 
                          usernameElement.closest('[data-testid="tweet"]') ||
                          usernameElement.closest('[role="article"]') ||
                          usernameElement.closest('article');
        }
        
        if (tweetContainer) {
          // Find username element in this tweet and update labels
          const usernameElements = tweetContainer.querySelectorAll('[data-testid="User-Name"], [data-testid="UserName"]');
          usernameElements.forEach(element => {
            const extractedUsername = this.extractUsername(element);
            if (extractedUsername && extractedUsername.toLowerCase() === usernameLower) {
              // Remove old labels first
              const labelsWrapper = element.querySelector('.xmod-labels-wrapper');
              if (labelsWrapper) {
                labelsWrapper.remove();
              }
              // Mark user again to show updated labels
              this.markUser(element);
            }
          });
        }
        
        // Also process all existing content to catch any other instances
        setTimeout(() => {
          this.processExistingContent();
        }, 100);
      }

      // Don't remove the button - keep it visible so user can add more violations
      // The button should always be visible
      
      // Show success feedback
      console.log('User marked successfully!');
    } catch (error) {
      console.error('Error marking user from tweet:', error);
      alert('Error marking user: ' + error.message);
    }
  }

  // Cleanup on page unload
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.buttonCheckInterval) {
      clearInterval(this.buttonCheckInterval);
      this.buttonCheckInterval = null;
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.xModHelper = new XModHelper();
  });
} else {
  window.xModHelper = new XModHelper();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.xModHelper) {
    window.xModHelper.destroy();
  }
});

