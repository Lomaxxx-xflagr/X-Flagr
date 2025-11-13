/**
 * X-Flagr (X.com Mod Community Tool)
 * Popup Script
 * 
 * Handles UI interactions, user management, rule management, and settings
 * for the extension popup interface.
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
      return '#009eff'; // Default color
    }
    // Remove any whitespace
    color = color.trim();
    // Check if it's a valid hex color
    if (/^#[0-9A-F]{6}$/i.test(color)) {
      return color;
    }
    // If invalid, return default
    return '#009eff';
  }

  /**
   * Validate username format
   * @param {string} username - Username to validate
   * @returns {boolean} True if valid
   */
  static isValidUsername(username) {
    if (typeof username !== 'string' || !username.startsWith('@')) {
      return false;
    }
    const cleanUsername = username.substring(1).trim();
    // Only allow alphanumeric characters, underscores, and dots
    // Twitter/X allows: 1-15 characters, alphanumeric and underscore
    return /^[a-zA-Z0-9_]{1,15}$/.test(cleanUsername);
  }
}

/**
 * RuleStorage - Manages Chrome Storage operations for rules
 */
class RuleStorage {
  static async getRules() {
    try {
      const result = await chrome.storage.local.get(['rules']);
      return result.rules || [];
    } catch (error) {
      return [];
    }
  }

  static async saveRules(rules) {
    try {
      await chrome.storage.local.set({ rules: rules });
      return true;
    } catch (error) {
      return false;
    }
  }

  static async addRule(name, color) {
    const rules = await this.getRules();
    
    // Generate unique ID
    const id = Date.now().toString();
    
    const newRule = {
      id: id,
      name: name,
      color: color,
      createdAt: Date.now()
    };
    
    rules.push(newRule);
    await this.saveRules(rules);
    return { success: true, rule: newRule };
  }

  static async removeRule(ruleId) {
    const rules = await this.getRules();
    const filteredRules = rules.filter(r => r.id !== ruleId);
    await this.saveRules(filteredRules);
    return filteredRules;
  }

  static async updateRule(ruleId, updates) {
    const rules = await this.getRules();
    const ruleIndex = rules.findIndex(r => r.id === ruleId || r.id === ruleId.toString());
    
    if (ruleIndex === -1) {
      return { success: false, error: 'Rule not found' };
    }
    
    // Update rule properties
    if (updates.color !== undefined) {
      rules[ruleIndex].color = updates.color;
    }
    if (updates.name !== undefined) {
      rules[ruleIndex].name = updates.name;
    }
    
    await this.saveRules(rules);
    return { success: true, rule: rules[ruleIndex] };
  }

  static async initializeDefaultRules() {
    const rules = await this.getRules();
    
    // Only initialize if no rules exist
    if (rules.length === 0) {
      const defaultRules = [
        { id: '1', name: 'Be kind and respectful', color: '#ef4444', createdAt: Date.now() },
        { id: '2', name: 'Keep Tweets on topic', color: '#f59e0b', createdAt: Date.now() },
        { id: '3', name: 'No NSFW', color: '#8b5cf6', createdAt: Date.now() }
      ];
      
      await this.saveRules(defaultRules);
      return defaultRules;
    }
    
    return rules;
  }
}


/**
 * UserStorage - Manages Chrome Storage operations for marked users
 */
class UserStorage {
  static async getMarkedUsers() {
    try {
      const result = await chrome.storage.local.get(['markedUsers']);
      return result.markedUsers || {};
    } catch (error) {
      return {};
    }
  }

  static async saveMarkedUsers(users) {
    try {
      await chrome.storage.local.set({ markedUsers: users });
      return true;
    } catch (error) {
      return false;
    }
  }

  static async addUser(username, rule) {
    const users = await this.getMarkedUsers();
    const usernameLower = username.toLowerCase();
    const ruleId = rule.toString();
    
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
    if (!users[usernameLower].rules[ruleId]) {
      users[usernameLower].rules[ruleId] = {
        count: 1,
        firstTimestamp: Date.now()
      };
    } else {
      users[usernameLower].rules[ruleId].count += 1;
    }
    
    // Update last violation timestamp
    users[usernameLower].timestamp = Date.now();
    
    await this.saveMarkedUsers(users);
    return users;
  }

  static async removeUser(username) {
    const users = await this.getMarkedUsers();
    delete users[username.toLowerCase()];
    await this.saveMarkedUsers(users);
    return users;
  }

  /**
   * Remove a single violation for a user
   * @param {string} username - Username (with or without @)
   * @param {string} ruleId - Rule ID to remove violation from
   * @returns {Promise<Object>} Updated users object
   */
  static async removeViolation(username, ruleId) {
    const users = await this.getMarkedUsers();
    const usernameLower = username.toLowerCase().replace('@', '');
    
    if (!users[usernameLower] || !users[usernameLower].rules) {
      return users;
    }
    
    if (!users[usernameLower].rules[ruleId]) {
      return users;
    }
    
    // Decrease count
    users[usernameLower].rules[ruleId].count -= 1;
    
    // If count reaches 0, remove the rule entirely
    if (users[usernameLower].rules[ruleId].count <= 0) {
      delete users[usernameLower].rules[ruleId];
    }
    
    // If no rules left, remove the user entirely
    if (Object.keys(users[usernameLower].rules || {}).length === 0) {
      delete users[usernameLower];
    } else {
      // Update last violation timestamp to the most recent remaining violation
      const remainingRules = Object.values(users[usernameLower].rules);
      if (remainingRules.length > 0) {
        const timestamps = remainingRules.map(r => r.firstTimestamp || 0);
        users[usernameLower].timestamp = Math.max(...timestamps);
      }
    }
    
    await this.saveMarkedUsers(users);
    return users;
  }

  static async clearAllUsers() {
    await chrome.storage.local.remove(['markedUsers']);
    return {};
  }
}

/**
 * PopupUI - Manages the extension popup interface and user interactions
 */
class PopupUI {
  constructor() {
    this.usernameInput = document.getElementById('usernameInput');
    this.ruleSelect = document.getElementById('ruleSelect');
    this.addUserBtn = document.getElementById('addUserBtn');
    this.totalUsers = document.getElementById('totalUsers');
    this.activeLabels = document.getElementById('activeLabels');
    this.showLabels = document.getElementById('showLabels');
    this.notificationsToggle = document.getElementById('notifications');
    // Rule management elements
    this.ruleNameInput = document.getElementById('ruleNameInput');
    this.ruleColorInput = document.getElementById('ruleColorInput');
    this.colorPreview = document.getElementById('colorPreview');
    this.addRuleBtn = document.getElementById('addRuleBtn');
    this.rulesList = document.getElementById('rulesList');
    this.rulesEmptyState = document.getElementById('rulesEmptyState');
    this.ruleCount = document.getElementById('ruleCount');
    this.ruleLegendGrid = document.getElementById('ruleLegendGrid');
    
    // Analytics elements
    this.analyticsUsersList = document.getElementById('analyticsUsersList');
    this.analyticsEmptyState = document.getElementById('analyticsEmptyState');
    this.totalViolations = document.getElementById('totalViolations');
    this.todayActivity = document.getElementById('todayActivity');
    
    // Tab elements
    this.tabBtns = document.querySelectorAll('.tab-btn');
    this.tabContents = document.querySelectorAll('.tab-content');
    
    // Rule tab elements
    this.ruleTabBtns = document.querySelectorAll('.rule-tab-btn');
    this.ruleTabContents = document.querySelectorAll('.rule-tab-content');
    
    // Search and filter elements
    this.analyticsSearchInput = document.getElementById('analyticsSearchInput');
    this.analyticsSortSelect = document.getElementById('analyticsSortSelect');
    this.searchClearBtn = document.getElementById('searchClearBtn');
    
    // Data management elements
    this.exportDataBtn = document.getElementById('exportDataBtn');
    this.importDataInput = document.getElementById('importDataInput');
    
    // Advanced stats elements
    this.periodBtns = document.querySelectorAll('.period-btn');
    this.violationsChart = document.getElementById('violationsChart');
    this.chartLabels = document.getElementById('chartLabels');
    this.topViolationsList = document.getElementById('topViolationsList');
    this.trendsContainer = document.getElementById('trendsContainer');
    this.weekComparisonContainer = document.getElementById('weekComparisonContainer');
    this.heatmapContainer = document.getElementById('heatmapContainer');
    this.topOffendersList = document.getElementById('topOffendersList');
    this.exportWeeklyReportBtn = document.getElementById('exportWeeklyReportBtn');
    this.exportMonthlyReportBtn = document.getElementById('exportMonthlyReportBtn');
    this.analyticsTabBtns = document.querySelectorAll('.analytics-tab-btn');
    this.analyticsTabContents = document.querySelectorAll('.analytics-tab-content');
    this.currentPeriod = 7;
    
    // Bulk actions elements
    this.bulkActionsBar = document.getElementById('bulkActionsBar');
    this.bulkActionsCount = document.getElementById('bulkActionsCount');
    this.selectAllBtn = document.getElementById('selectAllBtn');
    this.deselectAllBtn = document.getElementById('deselectAllBtn');
    this.removeSelectedBtn = document.getElementById('removeSelectedBtn');
    this.exportSelectedBtn = document.getElementById('exportSelectedBtn');
    
    this.currentTab = 'users';
    this.filteredUsers = null;
    
    // Floating panel elements
    this.floatingPanel = document.getElementById('floatingPanel');
    this.closeFloatingPanel = document.getElementById('closeFloatingPanel');
    this.floatingPanelUsername = document.getElementById('floatingPanelUsername');
    this.floatingUserContent = document.getElementById('floatingUserContent');
    
    // Collapse elements
    this.ruleStatsCollapseBtn = document.getElementById('ruleStatsCollapseBtn');
    this.ruleStatsContent = document.getElementById('ruleStatsContent');
    
    this.init();
  }

  async init() {
    // Initialize default rules on first run
    await RuleStorage.initializeDefaultRules();
    
    await this.loadRules();
    await this.loadUsers();
    await this.loadSettings();
    this.bindEvents();
    this.bindMessageListener();
    
    // Set initial tab to users
    this.switchTab('users');
    
    // Set rule stats to collapsed by default
    if (this.ruleStatsContent) {
      this.ruleStatsContent.classList.add('collapsed');
    }
  }

  bindMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'markUserFromTweet') {
        this.handleMarkUserFromTweet(message.username, message.ruleId)
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((error) => {
            sendResponse({ success: false, error: error.message });
          });
        return true; // Keep message channel open for async response
      }
      return false;
    });
  }

  async handleMarkUserFromTweet(username, ruleId) {
    try {
      // Add user with rule
      await UserStorage.addUser(username, ruleId);
      
      // Refresh UI
      await this.loadUsers();
      await this.loadAnalyticsData();
      
      // Refresh content scripts
      chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: 'refreshUsers' }).catch(() => {});
        });
      });
    } catch (error) {
      throw error;
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['notificationsEnabled']);
      if (this.notificationsToggle) {
        this.notificationsToggle.checked = result.notificationsEnabled !== false;
      }
    } catch (error) {
      // Silently fail - use defaults
    }
  }


  bindEvents() {
    this.addUserBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.addUser();
    });
    
    // Rule management
    if (this.addRuleBtn) {
      this.addRuleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.addRule();
      });
    }
    
    if (this.ruleColorInput && this.colorPreview) {
      this.ruleColorInput.addEventListener('input', (e) => {
        const validatedColor = SecurityUtils.validateHexColor(e.target.value);
        this.colorPreview.textContent = validatedColor;
        this.colorPreview.style.color = validatedColor;
      });
    }
    
    if (this.ruleNameInput) {
      this.ruleNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.addRule();
      });
    }
    
    // Check if showLabels element exists before adding event listener
    if (this.showLabels) {
      this.showLabels.addEventListener('change', () => this.toggleLabels());
    }
    
    // Notifications toggle
    if (this.notificationsToggle) {
      this.notificationsToggle.addEventListener('change', () => this.toggleNotifications());
    }
    
    this.usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addUser();
    });
    
    // Tab navigation
    this.tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchTab(btn.dataset.tab);
      });
    });
    
    // Rule tab navigation
    this.ruleTabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchRuleTab(btn.dataset.rule);
      });
    });
    
    // Collapse toggle
    if (this.ruleStatsCollapseBtn) {
      this.ruleStatsCollapseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleRuleStatsCollapse();
      });
    }
    
    // Rules tab collapse toggles
    const addRuleCollapseBtn = document.getElementById('addRuleCollapseBtn');
    const rulesListCollapseBtn = document.getElementById('rulesListCollapseBtn');
    
    if (addRuleCollapseBtn) {
      addRuleCollapseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleCollapse('addRuleContent', 'addRuleCollapseBtn');
      });
    }
    
    if (rulesListCollapseBtn) {
      rulesListCollapseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleCollapse('rulesListContent', 'rulesListCollapseBtn');
      });
    }
    
    // Search and filter events
    if (this.analyticsSearchInput) {
      this.analyticsSearchInput.addEventListener('input', (e) => {
        this.handleSearch(e.target.value);
      });
    }
    
    if (this.searchClearBtn) {
      this.searchClearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.analyticsSearchInput) {
          this.analyticsSearchInput.value = '';
          this.handleSearch('');
        }
      });
    }
    
    if (this.analyticsSortSelect) {
      this.analyticsSortSelect.addEventListener('change', (e) => {
        this.handleSort(e.target.value);
      });
    }
    
    // Export/Import events
    if (this.exportDataBtn) {
      this.exportDataBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.exportData();
      });
    }
    
    if (this.importDataInput) {
      this.importDataInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.importData(e.target.files[0]);
        }
      });
    }
    
    // Period selector events
    if (this.periodBtns && this.periodBtns.length > 0) {
      this.periodBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const period = btn.dataset.period === 'all' ? 'all' : parseInt(btn.dataset.period);
          this.setPeriod(period);
        });
      });
    }
    
    // Report export events
    if (this.exportWeeklyReportBtn) {
      this.exportWeeklyReportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.exportWeeklyReport();
      });
    }
    
    if (this.exportMonthlyReportBtn) {
      this.exportMonthlyReportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.exportMonthlyReport();
      });
    }
    
    // Analytics tabs events
    if (this.analyticsTabBtns && this.analyticsTabBtns.length > 0) {
      this.analyticsTabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const tab = btn.dataset.tab;
          this.switchAnalyticsTab(tab);
        });
      });
    }
    
    // Make headers clickable
    const addRuleHeader = document.querySelector('.add-rule-card .card-header-collapsible');
    const rulesListHeader = document.querySelector('.rules-list-card .card-header-collapsible');
    
    if (addRuleHeader) {
      addRuleHeader.addEventListener('click', (e) => {
        if (e.target.closest('.collapse-btn')) return;
        this.toggleCollapse('addRuleContent', 'addRuleCollapseBtn');
      });
    }
    
    if (rulesListHeader) {
      rulesListHeader.addEventListener('click', (e) => {
        if (e.target.closest('.collapse-btn')) return;
        this.toggleCollapse('rulesListContent', 'rulesListCollapseBtn');
      });
    }
    
    // Advanced stats header
    const advancedStatsHeader = document.querySelector('.advanced-stats-card .card-header-collapsible');
    const advancedStatsCollapseBtn = document.getElementById('advancedStatsCollapseBtn');
    
    if (advancedStatsHeader) {
      advancedStatsHeader.addEventListener('click', (e) => {
        if (e.target.closest('.collapse-btn')) return;
        this.toggleCollapse('advancedStatsContent', 'advancedStatsCollapseBtn');
      });
    }
    
    if (advancedStatsCollapseBtn) {
      advancedStatsCollapseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleCollapse('advancedStatsContent', 'advancedStatsCollapseBtn');
      });
    }
    
    // Bulk actions events
    if (this.selectAllBtn) {
      this.selectAllBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectAllUsers();
      });
    }
    
    if (this.deselectAllBtn) {
      this.deselectAllBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.deselectAllUsers();
      });
    }
    
    if (this.removeSelectedBtn) {
      this.removeSelectedBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.removeSelectedUsers();
      });
    }
    
    if (this.exportSelectedBtn) {
      this.exportSelectedBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.exportSelectedUsers();
      });
    }
    
    // Floating panel
    if (this.closeFloatingPanel) {
      this.closeFloatingPanel.addEventListener('click', () => this.hideFloatingPanel());
    }
  }

  async addUser() {
    const username = this.usernameInput.value.trim();
    const rule = this.ruleSelect.value;

    // Validation: Empty username
    if (!username) {
      this.showNotification('Please enter a username!', 'error');
      return;
    }

    // Validation: Username format using SecurityUtils
    if (!SecurityUtils.isValidUsername(username)) {
      this.showNotification('Invalid username format! Must be @username (1-15 alphanumeric characters or underscore).', 'error');
      return;
    }
    
    // Extract clean username (without @) for storage
    const cleanUsername = username.substring(1).trim();
    
    // Validation: Rule selection
    if (!rule || rule === '') {
      this.showNotification('Please select a rule!', 'error');
      return;
    }
    
    // Validation: Rule exists
    const ruleExists = this.currentRules && this.currentRules.find(r => r.id === rule);
    if (!ruleExists) {
      this.showNotification('Selected rule does not exist!', 'error');
      return;
    }
    
    try {
      // Store username with @ for display, but use cleanUsername (without @) for storage key
      const users = await UserStorage.addUser(cleanUsername, rule);
      await this.loadUsers();
      this.usernameInput.value = '';
      this.showNotification(`${username} marked successfully!`, 'success');
      
      // Send browser notification if enabled
      await this.sendBrowserNotification(
        'User Marked',
        `${username} has been marked for "${this.getRuleText(parseInt(rule))}".`
      );
      
      // Refresh content script in all X.com/Twitter tabs
      chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: 'refreshUsers' }).catch(() => {
            // Silently fail if tab is not responsive
          });
        });
      });
    } catch (error) {
      this.showNotification('Error marking user! Please try again.', 'error');
    }
  }


  async loadRules() {
    const rules = await RuleStorage.getRules();
    this.currentRules = rules;
    
    // Update rule count
    if (this.ruleCount) {
      // Show current count and limit dynamically
      this.ruleCount.textContent = rules.length;
    }
    
    // Render rules list
    this.renderRulesList(rules);
    
    // Update rule dropdown
    this.updateRuleDropdown(rules);
    
    // Update rule legend
    this.updateRuleLegend(rules);
    
    // Inject dynamic CSS for rule colors
    this.injectRuleCSS(rules);
    
    // Update rule statistics if on analytics tab
    if (this.currentTab === 'analytics') {
      const users = await UserStorage.getMarkedUsers();
      this.updateStats(users);
    }
  }

  renderRulesList(rules) {
    if (!this.rulesList) return;
    
    this.rulesList.innerHTML = '';
    
    if (rules.length === 0) {
      if (this.rulesEmptyState) {
        this.rulesList.appendChild(this.rulesEmptyState.cloneNode(true));
      }
      return;
    }
    
    rules.forEach(rule => {
      const ruleElement = this.createRuleElement(rule);
      this.rulesList.appendChild(ruleElement);
    });
  }

  createRuleElement(rule) {
    const div = document.createElement('div');
    div.className = 'rule-item';
    const safeColor = SecurityUtils.validateHexColor(rule.color);
    const safeName = SecurityUtils.escapeHtml(rule.name);
    const safeId = SecurityUtils.escapeHtml(rule.id);
    div.innerHTML = `
      <div class="rule-item-color" style="background-color: ${safeColor}"></div>
      <div class="rule-item-info">
        <div class="rule-item-name">${safeName}</div>
        <div class="rule-item-id">ID: ${safeId}</div>
      </div>
      <div class="rule-item-actions">
        <button class="rule-item-edit" data-rule-id="${SecurityUtils.escapeHtml(rule.id)}" title="Edit rule color">
          <svg width="12" height="12" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z"/>
          </svg>
        </button>
        <button class="rule-item-delete" data-rule-id="${SecurityUtils.escapeHtml(rule.id)}" title="Delete rule">
          <svg width="12" height="12" viewBox="0 0 448 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/>
          </svg>
        </button>
      </div>
    `;
    
    // Add edit handler
    const editBtn = div.querySelector('.rule-item-edit');
    editBtn.addEventListener('click', () => this.editRuleColor(rule.id, rule.color));
    
    // Add delete handler
    const deleteBtn = div.querySelector('.rule-item-delete');
    deleteBtn.addEventListener('click', () => this.deleteRule(rule.id));
    
    return div;
  }

  async addRule() {
    const name = this.ruleNameInput.value.trim();
    const color = this.ruleColorInput.value;
    
    // Validation: Rule name
    if (!name) {
      this.showNotification('Please enter a rule name!', 'error');
      return;
    }
    
    if (name.length > 50) {
      this.showNotification('Rule name must be 50 characters or less!', 'error');
      return;
    }
    
    // Validation: Rule name contains only safe characters (alphanumeric, spaces, hyphens, underscores)
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
      this.showNotification('Rule name contains invalid characters! Only letters, numbers, spaces, hyphens, and underscores are allowed.', 'error');
      return;
    }
    
    // Validation: Color format using SecurityUtils
    const validatedColor = SecurityUtils.validateHexColor(color);
    if (validatedColor !== color) {
      this.showNotification('Invalid color format! Using default color.', 'error');
    }
    
    try {
      const result = await RuleStorage.addRule(SecurityUtils.escapeHtml(name), validatedColor);
      
      if (!result.success) {
        this.showNotification(result.error, 'error');
        return;
      }
      
      await this.loadRules();
      this.ruleNameInput.value = '';
      this.ruleColorInput.value = '#ef4444';
      this.colorPreview.textContent = '#ef4444';
      this.colorPreview.style.color = '#ef4444';
      
      this.showNotification(`Rule "${name}" created successfully!`, 'success');
      
      // Refresh content scripts
      this.refreshAllContentScripts();
    } catch (error) {
      this.showNotification('Error creating rule!', 'error');
    }
  }

  async editRuleColor(ruleId, currentColor) {
    // Create a simple color picker dialog
    const newColor = await this.showColorPickerDialog(currentColor);
    
    if (!newColor) {
      return; // User cancelled
    }
    
    // Validate color format
    const validatedColor = SecurityUtils.validateHexColor(newColor);
    if (validatedColor !== newColor) {
      this.showNotification('Invalid color format! Using default color.', 'error');
    }
    
    try {
      const result = await RuleStorage.updateRule(ruleId, { color: validatedColor });
      
      if (!result.success) {
        this.showNotification(result.error, 'error');
        return;
      }
      
      await this.loadRules();
      this.showNotification('Rule color updated successfully!', 'success');
      
      // Refresh content scripts
      this.refreshAllContentScripts();
    } catch (error) {
      this.showNotification('Error updating rule color!', 'error');
    }
  }

  showColorPickerDialog(currentColor) {
    return new Promise((resolve) => {
      // Validate and sanitize color
      const safeColor = SecurityUtils.validateHexColor(currentColor);
      
      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.className = 'color-picker-modal-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;
      
      // Create modal
      const modal = document.createElement('div');
      modal.className = 'color-picker-modal';
      modal.style.cssText = `
        background: linear-gradient(135deg, #141414 0%, #181818 100%);
        padding: 24px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        min-width: 300px;
        max-width: 400px;
      `;
      
      modal.innerHTML = `
        <h3 style="margin: 0 0 16px 0; color: #ffffff; font-size: 18px; font-weight: 600;">Edit Rule Color</h3>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: #E0E0E0; font-size: 12px; font-weight: 500;">Select new color:</label>
          <div style="display: flex; align-items: center; gap: 12px;">
            <input type="color" id="editRuleColorInput" value="${SecurityUtils.escapeHtml(safeColor)}" style="width: 60px; height: 40px; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; cursor: pointer;">
            <span id="editColorPreview" style="color: ${safeColor}; font-size: 14px; font-weight: 500; font-family: monospace;">${SecurityUtils.escapeHtml(safeColor)}</span>
          </div>
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="cancelEditColor" style="padding: 8px 16px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; color: #E0E0E0; cursor: pointer; font-size: 14px;">Cancel</button>
          <button id="saveEditColor" style="padding: 8px 16px; background: #009eff; border: none; border-radius: 8px; color: #ffffff; cursor: pointer; font-size: 14px; font-weight: 500;">Save</button>
        </div>
      `;
      
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      
      const colorInput = modal.querySelector('#editRuleColorInput');
      const colorPreview = modal.querySelector('#editColorPreview');
      
      // Update preview on color change
      colorInput.addEventListener('input', (e) => {
        const newColor = e.target.value;
        const validatedColor = SecurityUtils.validateHexColor(newColor);
        colorPreview.textContent = validatedColor;
        colorPreview.style.color = validatedColor;
      });
      
      // Cancel button
      modal.querySelector('#cancelEditColor').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(null);
      });
      
      // Save button
      modal.querySelector('#saveEditColor').addEventListener('click', () => {
        const newColor = colorInput.value;
        document.body.removeChild(overlay);
        resolve(newColor);
      });
      
      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(null);
        }
      });
    });
  }

  async deleteRule(ruleId) {
    // Check if any users are marked with this rule (support both old and new data structure)
    const users = await UserStorage.getMarkedUsers();
    const usersWithRule = Object.values(users).filter(u => {
      if (u.rules && typeof u.rules === 'object') {
        // New structure: check if rule exists in rules object
        return u.rules.hasOwnProperty(ruleId) || u.rules.hasOwnProperty(ruleId.toString());
      } else if (u.rule) {
        // Old structure: check if rule matches
        return u.rule === ruleId || u.rule === ruleId.toString();
      }
      return false;
    });
    
    if (usersWithRule.length > 0) {
      this.showNotification(`Cannot delete rule: ${usersWithRule.length} users are marked with this rule!`, 'error');
      return;
    }
    
    try {
      await RuleStorage.removeRule(ruleId);
      await this.loadRules();
      this.showNotification('Rule deleted successfully!', 'success');
      
      // Refresh content scripts
      this.refreshAllContentScripts();
    } catch (error) {
      this.showNotification('Error deleting rule!', 'error');
    }
  }

  updateRuleDropdown(rules) {
    if (!this.ruleSelect) return;
    
    // Clear existing options
    this.ruleSelect.innerHTML = '<option value="">Select a rule...</option>';
    
    // Add rules as options
    rules.forEach(rule => {
      const option = document.createElement('option');
      option.value = SecurityUtils.escapeHtml(rule.id);
      option.textContent = SecurityUtils.escapeHtml(rule.name);
      this.ruleSelect.appendChild(option);
    });
  }

  updateRuleLegend(rules) {
    if (!this.ruleLegendGrid) return;
    
    this.ruleLegendGrid.innerHTML = '';
    
    if (rules.length === 0) {
      this.ruleLegendGrid.innerHTML = `
        <div class="empty-state">
          <p>No rules defined yet. Go to the Rules tab to create your first rule.</p>
        </div>
      `;
      return;
    }
    
    rules.forEach(rule => {
      const legendItem = document.createElement('div');
      // Convert rule.id to string for consistent validation
      const ruleIdStr = String(rule.id);
      // Validate rule.id: allow numeric IDs (Date.now() generates numbers) and alphanumeric with underscore
      const safeId = /^[0-9]+$/.test(ruleIdStr) || /^[a-zA-Z0-9_]+$/.test(ruleIdStr)
        ? ruleIdStr
        : 'invalid';
      const safeColor = SecurityUtils.validateHexColor(rule.color);
      const safeName = SecurityUtils.escapeHtml(rule.name);
      legendItem.className = `legend-item rule-${safeId}`;
      legendItem.innerHTML = `
        <div class="legend-color" style="background-color: ${safeColor}"></div>
        <span>${safeName}</span>
      `;
      this.ruleLegendGrid.appendChild(legendItem);
    });
  }

  injectRuleCSS(rules) {
    // Remove old style element if exists
    const oldStyle = document.getElementById('dynamic-rule-styles');
    if (oldStyle) {
      oldStyle.remove();
    }
    
    // Create new style element
    const style = document.createElement('style');
    style.id = 'dynamic-rule-styles';
    
    let css = '';
    rules.forEach(rule => {
      // Convert rule.id to string for consistent validation
      const ruleIdStr = String(rule.id);
      // Validate and sanitize rule.id: allow numeric IDs (Date.now() generates numbers) and alphanumeric with underscore
      // Numeric IDs are safe (only digits), alphanumeric with underscore is also safe
      const safeId = /^[0-9]+$/.test(ruleIdStr) || /^[a-zA-Z0-9_]+$/.test(ruleIdStr)
        ? ruleIdStr
        : 'invalid';
      // Validate and sanitize color
      const safeColor = SecurityUtils.validateHexColor(rule.color);
      css += `
        .rule-${safeId} {
          background: ${safeColor}15;
          border-color: ${safeColor}30;
          color: ${safeColor};
        }
      `;
    });
    
    style.textContent = css;
    document.head.appendChild(style);
  }

  refreshAllContentScripts() {
    chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: 'refreshRules' }).catch(() => {
          // Silently fail if tab is not responsive
        });
      });
    });
  }

  async loadUsers() {
    const users = await UserStorage.getMarkedUsers();
    this.renderAnalyticsUsersList(users);
    this.renderRuleSpecificLists(users);
    this.updateStats(users);
    this.updateAdvancedStats(users);
    
    // Also update stats when switching to analytics tab
    if (this.tabContents && this.tabContents.length > 0) {
      const analyticsTab = Array.from(this.tabContents).find(tab => tab.id === 'analytics-content');
      if (analyticsTab && analyticsTab.classList.contains('active')) {
        this.updateStats(users);
        this.updateAdvancedStats(users);
      }
    }
  }



  getRuleText(ruleId) {
    if (!this.currentRules) return 'Unknown';
    const rule = this.currentRules.find(r => r.id === ruleId || r.id === ruleId.toString());
    return rule ? rule.name : 'Unknown';
  }

  getRuleColor(ruleId) {
    if (!this.currentRules) return '#cccccc';
    const rule = this.currentRules.find(r => r.id === ruleId || r.id === ruleId.toString());
    return rule ? rule.color : '#cccccc';
  }

  renderAnalyticsUsersList(users, searchTerm = '', sortBy = 'newest') {
    this.analyticsUsersList.innerHTML = '';
    
    // Filter users by search term
    let filteredUsers = Object.entries(users);
    
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filteredUsers = filteredUsers.filter(([username, data]) => {
        const usernameMatch = username.toLowerCase().includes(searchLower);
        const noteMatch = data.note && data.note.toLowerCase().includes(searchLower);
        return usernameMatch || noteMatch;
      });
    }
    
    // Sort users
    filteredUsers = this.sortUsers(filteredUsers, sortBy);
    this.filteredUsers = filteredUsers;

    if (filteredUsers.length === 0) {
      this.analyticsEmptyState.style.display = 'block';
      this.analyticsEmptyState.innerHTML = '<p>No users found.</p><p>Try adjusting your search or filters.</p>';
      return;
    }

    this.analyticsEmptyState.style.display = 'none';

    filteredUsers.forEach(([username, data]) => {
      const userElement = this.createAnalyticsUserElement(username, data);
      this.analyticsUsersList.appendChild(userElement);
    });
  }

  sortUsers(users, sortBy) {
    const sorted = [...users];
    
    switch (sortBy) {
      case 'newest':
        return sorted.sort(([,a], [,b]) => (b.timestamp || 0) - (a.timestamp || 0));
      case 'oldest':
        return sorted.sort(([,a], [,b]) => (a.timestamp || 0) - (b.timestamp || 0));
      case 'most-violations':
        return sorted.sort(([,a], [,b]) => {
          const aCount = this.getTotalViolations(a);
          const bCount = this.getTotalViolations(b);
          return bCount - aCount;
        });
      case 'least-violations':
        return sorted.sort(([,a], [,b]) => {
          const aCount = this.getTotalViolations(a);
          const bCount = this.getTotalViolations(b);
          return aCount - bCount;
        });
      case 'username-asc':
        return sorted.sort(([a], [b]) => a.localeCompare(b));
      case 'username-desc':
        return sorted.sort(([a], [b]) => b.localeCompare(a));
      default:
        return sorted;
    }
  }

  getTotalViolations(userData) {
    if (userData.rules && typeof userData.rules === 'object') {
      return Object.values(userData.rules).reduce((sum, ruleData) => {
        return sum + (ruleData.count || 1);
      }, 0);
    }
    return userData.count || 1;
  }

  /**
   * Calculate user reputation score (0-100)
   * Lower score = worse reputation (more violations)
   * Higher score = better reputation (fewer violations)
   * 
   * Factors:
   * - Total violations (negative impact)
   * - Number of different rules violated (negative impact)
   * - Time since first violation (positive if long time, negative if recent)
   * - Time since last violation (positive if long time, negative if recent)
   * - Violation frequency (negative if frequent)
   */
  calculateReputationScore(userData) {
    if (!userData || (!userData.rules && !userData.rule)) {
      return { score: 100, trend: 'stable', label: 'No violations' };
    }

    const now = Date.now();
    let totalViolations = 0;
    let uniqueRules = 0;
    let firstViolationTime = now;
    let lastViolationTime = 0;
    let violationTimestamps = [];

    // Support both old and new data structure
    if (userData.rules && typeof userData.rules === 'object') {
      // New structure: multiple rules
      Object.values(userData.rules).forEach(ruleData => {
        const count = ruleData.count || 1;
        const firstTimestamp = ruleData.firstTimestamp || userData.timestamp;
        totalViolations += count;
        uniqueRules++;
        
        if (firstTimestamp < firstViolationTime) {
          firstViolationTime = firstTimestamp;
        }
        
        // Estimate violation timestamps (spread evenly from first to last)
        const lastTimestamp = userData.timestamp || firstTimestamp;
        for (let i = 0; i < count; i++) {
          if (count === 1) {
            violationTimestamps.push(firstTimestamp);
          } else {
            const progress = i / (count - 1);
            violationTimestamps.push(firstTimestamp + (lastTimestamp - firstTimestamp) * progress);
          }
        }
      });
      lastViolationTime = userData.timestamp || firstViolationTime;
    } else if (userData.rule) {
      // Old structure: single rule
      totalViolations = userData.count || 1;
      uniqueRules = 1;
      firstViolationTime = userData.timestamp || now;
      lastViolationTime = userData.timestamp || now;
      for (let i = 0; i < totalViolations; i++) {
        violationTimestamps.push(firstViolationTime);
      }
    }

    if (totalViolations === 0) {
      return { score: 100, trend: 'stable', label: 'No violations' };
    }

    // Calculate time factors (in days)
    const daysSinceFirst = (now - firstViolationTime) / (1000 * 60 * 60 * 24);
    const daysSinceLast = (now - lastViolationTime) / (1000 * 60 * 60 * 24);
    const totalTimeSpan = daysSinceFirst;

    // Base score starts at 100, deduct points for violations
    let score = 100;

    // Deduct for total violations (logarithmic scale - diminishing returns)
    // 1 violation: -5, 2: -10, 5: -20, 10: -30, 20: -40, 50: -50
    score -= Math.min(50, Math.log(totalViolations + 1) * 15);

    // Deduct for number of different rules (more variety = worse)
    // 1 rule: 0, 2 rules: -5, 3 rules: -10, 4+ rules: -15
    score -= Math.min(15, (uniqueRules - 1) * 5);

    // Time-based adjustments
    // If violations are recent (last 7 days), additional penalty
    if (daysSinceLast < 7) {
      score -= (7 - daysSinceLast) * 2; // Up to -14 points
    }

    // If violations are frequent (many in short time), additional penalty
    if (totalTimeSpan > 0 && totalViolations > 1) {
      const violationsPerDay = totalViolations / Math.max(1, totalTimeSpan);
      if (violationsPerDay > 1) {
        score -= Math.min(20, (violationsPerDay - 1) * 10); // Up to -20 points
      }
    }

    // Bonus for time since last violation (if no violations in 30+ days)
    if (daysSinceLast > 30) {
      score += Math.min(10, (daysSinceLast - 30) / 10); // Up to +10 points
    }

    // Clamp score between 0 and 100
    score = Math.max(0, Math.min(100, Math.round(score)));

    // Determine trend (compare recent vs older violations)
    let trend = 'stable';
    if (violationTimestamps.length >= 2) {
      const recentViolations = violationTimestamps.filter(ts => (now - ts) < 7 * 24 * 60 * 60 * 1000).length;
      const olderViolations = violationTimestamps.length - recentViolations;
      
      if (recentViolations > olderViolations && totalViolations > 1) {
        trend = 'down'; // Getting worse
      } else if (recentViolations === 0 && daysSinceLast > 14) {
        trend = 'up'; // Getting better (no recent violations)
      }
    }

    // Determine label
    let label = '';
    if (score >= 80) {
      label = 'Excellent';
    } else if (score >= 60) {
      label = 'Good';
    } else if (score >= 40) {
      label = 'Fair';
    } else if (score >= 20) {
      label = 'Poor';
    } else {
      label = 'Critical';
    }

    return { score, trend, label, totalViolations, daysSinceLast };
  }

  renderRuleSpecificLists(users) {
    // Clear all rule-specific lists (dynamic based on current rules)
    if (this.currentRules) {
      this.currentRules.forEach(rule => {
        const ruleList = document.getElementById(`rule${rule.id}UsersList`);
        if (ruleList) {
          ruleList.innerHTML = '';
        }
      });
    }

    const sortedUsers = Object.entries(users)
      .sort(([,a], [,b]) => b.timestamp - a.timestamp);

    // Group users by rule (support both old and new data structure)
    const usersByRule = {};
    
    sortedUsers.forEach(([username, data]) => {
      if (data.rules && typeof data.rules === 'object') {
        // New structure: multiple rules
        Object.keys(data.rules).forEach(ruleId => {
          if (!usersByRule[ruleId]) {
            usersByRule[ruleId] = [];
          }
          usersByRule[ruleId].push([username, data]);
        });
      } else if (data.rule) {
        // Old structure: single rule
        const ruleId = data.rule.toString();
        if (!usersByRule[ruleId]) {
          usersByRule[ruleId] = [];
        }
        usersByRule[ruleId].push([username, data]);
      }
    });

    // Render each rule's users
    Object.keys(usersByRule).forEach(ruleId => {
      const ruleList = document.getElementById(`rule${ruleId}UsersList`);
      if (ruleList) {
        const usersForRule = usersByRule[ruleId];
        const ruleName = this.getRuleText(ruleId);
        
        if (usersForRule.length === 0) {
          const safeRuleName = SecurityUtils.escapeHtml(ruleName);
          ruleList.innerHTML = `
            <div class="empty-state">
              <p>No violations for "${safeRuleName}".</p>
            </div>
          `;
        } else {
          usersForRule.forEach(([username, data]) => {
            const userElement = this.createAnalyticsUserElement(username, data);
            ruleList.appendChild(userElement);
          });
        }
      }
    });
  }

  switchRuleTab(rule) {
    // Update rule tab buttons
    this.ruleTabBtns.forEach(btn => {
      const isActive = btn.dataset.rule === rule;
      btn.classList.toggle('active', isActive);
      
      // Set rule color for active button (except "all")
      if (isActive && rule !== 'all') {
        const ruleColor = this.getRuleColor(rule);
        const safeColor = SecurityUtils.validateHexColor(ruleColor);
        btn.style.backgroundColor = safeColor;
        btn.style.borderColor = safeColor;
      } else {
        // Reset to default for inactive or "all" button
        btn.style.backgroundColor = '';
        btn.style.borderColor = '';
      }
    });
    
    // Update rule tab content
    this.ruleTabContents.forEach(content => {
      const isActive = content.id === `rule-tab-${rule}`;
      content.classList.toggle('active', isActive);
    });
  }

  toggleRuleStatsCollapse() {
    if (this.ruleStatsCollapseBtn && this.ruleStatsContent) {
      const isCollapsed = this.ruleStatsContent.classList.contains('collapsed');
      
      if (isCollapsed) {
        this.ruleStatsContent.classList.remove('collapsed');
        this.ruleStatsCollapseBtn.classList.add('expanded');
      } else {
        this.ruleStatsContent.classList.add('collapsed');
        this.ruleStatsCollapseBtn.classList.remove('expanded');
      }
    }
  }

  toggleCollapse(contentId, buttonId) {
    const content = document.getElementById(contentId);
    const button = document.getElementById(buttonId);
    
    if (!content || !button) return;
    
    const isCollapsed = content.classList.contains('collapsed');
    
    if (isCollapsed) {
      content.classList.remove('collapsed');
      button.classList.add('expanded');
    } else {
      content.classList.add('collapsed');
      button.classList.remove('expanded');
    }
  }



  createAnalyticsUserElement(username, data) {
    const div = document.createElement('div');
    div.className = 'analytics-user-item slide-in';
    
    // Support both old and new data structure
    let rulesList = [];
    let totalViolations = 0;
    
    if (data.rules && typeof data.rules === 'object') {
      // New structure: multiple rules
      Object.keys(data.rules).forEach(ruleId => {
        const ruleData = data.rules[ruleId];
        const rule = this.currentRules?.find(r => r.id === ruleId || r.id === ruleId.toString());
        if (rule) {
          rulesList.push({
            name: rule.name,
            color: rule.color,
            ruleId: ruleId,
            count: ruleData.count || 1
          });
          totalViolations += ruleData.count || 1;
        }
      });
    } else if (data.rule) {
      // Old structure: single rule
      const ruleId = data.rule.toString();
      const rule = this.currentRules?.find(r => r.id === ruleId || r.id === ruleId.toString());
      rulesList.push({
        name: rule ? rule.name : this.getRuleText(data.rule),
        color: rule ? rule.color : '#cccccc',
        ruleId: ruleId,
        count: data.count || 1
      });
      totalViolations = data.count || 1;
    }
    
    // Build rules display HTML with rule colors
    let rulesHTML = '';
    let dominantRuleColor = '#009eff'; // Default color
    
    if (rulesList.length > 0) {
      // Find dominant rule (rule with most violations)
      // If only one rule, use it; otherwise find the one with highest count
      const dominantRule = rulesList.length === 1 
        ? rulesList[0]
        : rulesList.reduce((prev, current) => 
            (prev.count > current.count) ? prev : current
          );
      dominantRuleColor = dominantRule.color || '#009eff';
      
      rulesHTML = rulesList.map(r => {
        const safeRuleName = SecurityUtils.escapeHtml(r.name);
        const safeColor = SecurityUtils.validateHexColor(r.color);
        const safeCount = SecurityUtils.escapeHtml(r.count.toString());
        return `<span style="color: ${safeColor};">${safeRuleName} (${safeCount}x)</span>`;
      }).join(', ');
    } else {
      rulesHTML = 'No violations';
    }
    
    // Calculate reputation score
    const reputation = this.calculateReputationScore(data);
    
    const date = new Date(data.timestamp).toLocaleDateString('en-US');
    const initials = username.substring(0, 2).toUpperCase();
    const safeUsername = SecurityUtils.escapeHtml(username);
    const safeInitials = SecurityUtils.escapeHtml(initials);
    const safeDate = SecurityUtils.escapeHtml(date);
    const safeTotalViolations = SecurityUtils.escapeHtml(totalViolations.toString());
    const safeDominantColor = SecurityUtils.validateHexColor(dominantRuleColor);
    
    // Reputation score color based on score
    let reputationColor = '#10b981'; // Green (good)
    if (reputation.score < 20) {
      reputationColor = '#ef4444'; // Red (critical)
    } else if (reputation.score < 40) {
      reputationColor = '#f59e0b'; // Orange (poor)
    } else if (reputation.score < 60) {
      reputationColor = '#fbbf24'; // Yellow (fair)
    } else if (reputation.score < 80) {
      reputationColor = '#84cc16'; // Light green (good)
    }
    
    // Trend indicator
    let trendIcon = '';
    if (reputation.trend === 'up') {
      trendIcon = '<svg width="10" height="10" viewBox="0 0 448 512" fill="currentColor"><path d="M201.4 137.4c12.5-12.5 32.8-12.5 45.3 0l160 160c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L224 205.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l160-160z"/></svg>';
    } else if (reputation.trend === 'down') {
      trendIcon = '<svg width="10" height="10" viewBox="0 0 448 512" fill="currentColor"><path d="M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"/></svg>';
    }
    
    const safeReputationScore = SecurityUtils.escapeHtml(reputation.score.toString());
    const safeReputationLabel = SecurityUtils.escapeHtml(reputation.label);
    const safeReputationColor = SecurityUtils.validateHexColor(reputationColor);
    
    // Check if user has a note
    const hasNote = data.note && data.note.trim().length > 0;
    const noteIndicator = hasNote ? '<span class="note-indicator" title="Has notes">📝</span>' : '';
    
    div.innerHTML = `
      <div class="analytics-user-checkbox">
        <input type="checkbox" class="user-select-checkbox" data-username="${safeUsername}" id="checkbox-${safeUsername}">
        <label for="checkbox-${safeUsername}"></label>
      </div>
      <div class="analytics-user-info">
        <div class="analytics-user-avatar" style="background: ${safeDominantColor}30; border-color: ${safeDominantColor}50;">${safeInitials}</div>
        <div class="analytics-user-details">
          <div class="analytics-user-username">
            @${safeUsername} ${noteIndicator}
            <span class="reputation-badge" style="background: ${safeReputationColor}20; border-color: ${safeReputationColor}40; color: ${safeReputationColor};" title="Reputation: ${safeReputationLabel} (${safeReputationScore}/100)">
              ${safeReputationScore}
              ${trendIcon ? `<span class="reputation-trend reputation-trend-${reputation.trend}">${trendIcon}</span>` : ''}
            </span>
          </div>
          <div class="analytics-user-rule">${rulesHTML}</div>
        </div>
      </div>
      <div class="analytics-user-stats">
        <div class="analytics-user-count" style="background: ${safeDominantColor}20; border-color: ${safeDominantColor}40; color: #ffffff;">${safeTotalViolations}x</div>
        <div class="analytics-user-date">${safeDate}</div>
      </div>
      <div class="analytics-user-actions">
        <button class="analytics-user-action-btn details" data-username="${safeUsername}" title="Show details">
          <svg width="14" height="14" viewBox="0 0 576 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64a64 64 0 1 0 0 128 64 64 0 1 0 0-128z"/>
          </svg>
        </button>
        <button class="analytics-user-action-btn delete" data-username="${safeUsername}" title="Remove user">
          <svg width="14" height="14" viewBox="0 0 448 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/>
          </svg>
        </button>
      </div>
    `;
    
    // Add event listeners
    const detailsBtn = div.querySelector('.details');
    const deleteBtn = div.querySelector('.delete');
    const checkbox = div.querySelector('.user-select-checkbox');
    
    detailsBtn.addEventListener('click', () => this.showUserDetails(username, data));
    deleteBtn.addEventListener('click', () => this.removeUser(username));
    checkbox.addEventListener('change', () => this.updateBulkActionsBar());
    
    return div;
  }

  async removeUser(username) {
    if (!username) return;
    
    try {
      await UserStorage.removeUser(username);
      await this.loadUsers();
      await this.loadAnalyticsData();
      this.showNotification(`@${username} has been removed!`, 'success');
      
      // Close user details panel if open
      if (this.floatingPanelUsername && this.floatingPanelUsername.textContent === `@${username}`) {
        this.floatingPanel.style.display = 'none';
      }
      
      // Refresh content script in all X.com/Twitter tabs immediately
      chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: 'refreshUsers' }).catch(() => {
            // Silently fail if tab is not responsive
          });
        });
      });
    } catch (error) {
      this.showNotification('Error removing user!', 'error');
    }
  }

  showUserDetails(username, data) {
    this.floatingPanelUsername.textContent = `@${username}`;
    
    // Support both old and new data structure
    let rulesList = [];
    let totalViolations = 0;
    
    if (data.rules && typeof data.rules === 'object') {
      // New structure: multiple rules
      Object.keys(data.rules).forEach(ruleId => {
        const ruleData = data.rules[ruleId];
        const rule = this.currentRules?.find(r => r.id === ruleId || r.id === ruleId.toString());
        if (rule) {
          rulesList.push({
            ruleId: ruleId,
            name: rule.name,
            count: ruleData.count || 1,
            firstTimestamp: ruleData.firstTimestamp || data.timestamp,
            color: rule.color
          });
          totalViolations += ruleData.count || 1;
        }
      });
    } else if (data.rule) {
      // Old structure: single rule
      const rule = this.currentRules?.find(r => r.id === data.rule || r.id === data.rule.toString());
      rulesList.push({
        ruleId: data.rule,
        name: this.getRuleText(data.rule),
        count: data.count || 1,
        firstTimestamp: data.timestamp,
        color: rule?.color || '#cccccc'
      });
      totalViolations = data.count || 1;
    }
    
    // Build rules HTML (escape all user input)
    let rulesHTML = '';
    if (rulesList.length > 0) {
      rulesList.forEach((ruleInfo, index) => {
        const safeRuleName = SecurityUtils.escapeHtml(ruleInfo.name);
        const safeColor = SecurityUtils.validateHexColor(ruleInfo.color);
        const safeCount = SecurityUtils.escapeHtml(ruleInfo.count.toString());
        const safeDate = SecurityUtils.escapeHtml(new Date(ruleInfo.firstTimestamp).toLocaleString('en-US'));
        const safeRuleId = SecurityUtils.escapeHtml(ruleInfo.ruleId);
        rulesHTML += `
          <div class="violation-card" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-left: 3px solid ${safeColor}; border-radius: 8px; padding: 12px; margin-bottom: ${index < rulesList.length - 1 ? '12px' : '0'};">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <div style="flex: 1;">
                <div style="font-size: 11px; font-weight: 600; color: #ffffff; margin-bottom: 6px;">
                  ${safeRuleName}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span class="rule-label" style="background-color: ${safeColor}; color: white; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 600;">
                    ${safeCount}x violation${ruleInfo.count > 1 ? 's' : ''}
                  </span>
                  <span style="font-size: 10px; color: rgba(255, 255, 255, 0.6);">
                    First: ${safeDate}
                  </span>
                </div>
              </div>
              <button class="remove-violation-btn" data-rule-id="${safeRuleId}" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 10px; white-space: nowrap; transition: all 0.2s; flex-shrink: 0; display: flex; align-items: center; justify-content: center; gap: 4px; align-self: center; height: fit-content;" title="Remove one violation">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
                Remove
              </button>
            </div>
          </div>
        `;
      });
    } else {
      rulesHTML = '<div class="user-detail-item" style="text-align: center; padding: 20px; color: rgba(255, 255, 255, 0.5);">No violations recorded</div>';
    }
    
    // Calculate reputation score
    const reputation = this.calculateReputationScore(data);
    
    // Reputation score color based on score
    let reputationColor = '#10b981'; // Green (good)
    if (reputation.score < 20) {
      reputationColor = '#ef4444'; // Red (critical)
    } else if (reputation.score < 40) {
      reputationColor = '#f59e0b'; // Orange (poor)
    } else if (reputation.score < 60) {
      reputationColor = '#fbbf24'; // Yellow (fair)
    } else if (reputation.score < 80) {
      reputationColor = '#84cc16'; // Light green (good)
    }
    
    // Trend indicator
    let trendText = '';
    if (reputation.trend === 'up') {
      trendText = ' (Improving)';
    } else if (reputation.trend === 'down') {
      trendText = ' (Declining)';
    }
    
    const safeUsername = SecurityUtils.escapeHtml(username);
    const safeTotalViolations = SecurityUtils.escapeHtml(totalViolations.toString());
    const safeReputationScore = SecurityUtils.escapeHtml(reputation.score.toString());
    const safeReputationLabel = SecurityUtils.escapeHtml(reputation.label);
    const safeReputationColor = SecurityUtils.validateHexColor(reputationColor);
    const safeTrendText = SecurityUtils.escapeHtml(trendText);
    
    // Get user note
    const userNote = data.note || '';
    const safeNote = SecurityUtils.escapeHtml(userNote);
    
    this.floatingUserContent.innerHTML = `
      <div class="user-details-content">
        <div class="user-detail-section">
          <div class="user-detail-item">
            <label>Reputation Score:</label>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 6px;">
              <span style="background: ${safeReputationColor}20; border: 1px solid ${safeReputationColor}40; color: ${safeReputationColor}; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 16px;">
                ${safeReputationScore}/100
              </span>
              <span style="font-size: 14px; color: rgba(255, 255, 255, 0.8); font-weight: 500;">${safeReputationLabel}${safeTrendText}</span>
            </div>
          </div>
        </div>
        
        <div class="user-detail-section">
          <div class="user-detail-item">
            <label>Total Violations:</label>
            <span style="font-size: 18px; font-weight: 600; color: #ffffff;">${safeTotalViolations}</span>
          </div>
        </div>
        
        <div class="user-detail-section" style="margin-top: 4px;">
          <label style="font-size: 9px; color: rgba(255, 255, 255, 0.7); font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 10px; display: block;">Violations:</label>
          ${rulesHTML}
        </div>
        
        <div class="user-detail-section" style="margin-top: 16px;">
          <div class="user-detail-item">
            <label>Notes:</label>
            <textarea id="userNoteInput" class="user-note-input" placeholder="Add notes about this user..." rows="3">${safeNote}</textarea>
            <button id="saveNoteBtn" class="btn btn-primary" style="margin-top: 8px; width: 100%; padding: 8px; font-size: 11px;">Save Note</button>
          </div>
        </div>
      </div>
    `;
    
    // Add note save handler
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    if (saveNoteBtn) {
      saveNoteBtn.addEventListener('click', () => {
        this.saveUserNote(username);
      });
    }
    
    // Add remove violation button handlers
    const removeViolationBtns = this.floatingUserContent.querySelectorAll('.remove-violation-btn');
    removeViolationBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ruleId = btn.getAttribute('data-rule-id');
        if (ruleId && confirm(`Remove one violation for "${rulesList.find(r => r.ruleId === ruleId)?.name || 'this rule'}"?`)) {
          await this.removeViolation(username, ruleId);
          // Reload user data and refresh display
          await this.loadUsers();
          await this.loadAnalyticsData();
          // Re-show user details with updated data
          const updatedUsers = await UserStorage.getMarkedUsers();
          const updatedData = updatedUsers[username.toLowerCase()];
          if (updatedData) {
            this.showUserDetails(username, updatedData);
          } else {
            // User was completely removed, close panel
            this.floatingPanel.style.display = 'none';
          }
          this.showNotification('Violation removed successfully!', 'success');
          
          // Refresh content script
          try {
            const tabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
            tabs.forEach(tab => {
              chrome.tabs.sendMessage(tab.id, { action: 'refreshUsers' }).catch(() => {});
            });
          } catch (error) {
            // Ignore errors
          }
        }
      });
      
      // Add hover effect
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(239, 68, 68, 0.2)';
        btn.style.borderColor = 'rgba(239, 68, 68, 0.5)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(239, 68, 68, 0.1)';
        btn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      });
    });
    
    this.floatingPanel.style.display = 'block';
  }

  async saveUserNote(username) {
    const noteInput = document.getElementById('userNoteInput');
    if (!noteInput) return;
    
    const note = noteInput.value.trim();
    try {
      const users = await UserStorage.getMarkedUsers();
      const usernameLower = username.toLowerCase();
      
      if (users[usernameLower]) {
        users[usernameLower].note = note;
        await UserStorage.saveMarkedUsers(users);
        this.showNotification('Note saved successfully!', 'success');
      }
    } catch (error) {
      this.showNotification('Error saving note!', 'error');
    }
  }

  async removeViolation(username, ruleId) {
    try {
      await UserStorage.removeViolation(username, ruleId);
    } catch (error) {
      throw error;
    }
  }

  hideFloatingPanel() {
    if (this.floatingPanel) {
      this.floatingPanel.style.display = 'none';
    }
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    
    // Update tab buttons
    this.tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab content
    this.tabContents.forEach(content => {
      const isActive = content.id === `${tabName}-content`;
      content.classList.toggle('active', isActive);
    });
    
    // Load analytics data when switching to analytics tab
    if (tabName === 'analytics') {
      this.loadAnalyticsData();
    }
  }

  async loadAnalyticsData() {
    const users = await UserStorage.getMarkedUsers();
    const rules = await RuleStorage.getRules();
    this.currentRules = rules;
    
    // Get current search and sort values
    const searchTerm = this.analyticsSearchInput ? this.analyticsSearchInput.value : '';
    const sortBy = this.analyticsSortSelect ? this.analyticsSortSelect.value : 'newest';
    
    this.renderAnalyticsUsersList(users, searchTerm, sortBy);
    this.renderRuleSpecificLists(users);
    this.updateStats(users);
    this.updateAdvancedStats(users);
    
    // Force update of rule statistics
    setTimeout(() => {
      this.updateStats(users);
      this.updateAdvancedStats(users);
    }, 50);
  }

  setPeriod(period) {
    this.currentPeriod = period;
    
    // Update button states
    if (this.periodBtns && this.periodBtns.length > 0) {
      this.periodBtns.forEach(btn => {
        const btnPeriod = btn.dataset.period === 'all' ? 'all' : parseInt(btn.dataset.period);
        btn.classList.toggle('active', btnPeriod === period);
      });
    }
    
    // Refresh advanced stats
    UserStorage.getMarkedUsers().then(users => {
      this.updateAdvancedStats(users);
    });
  }

  switchAnalyticsTab(tab) {
    // Update tab buttons
    if (this.analyticsTabBtns && this.analyticsTabBtns.length > 0) {
      this.analyticsTabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });
    }
    
    // Update tab content
    if (this.analyticsTabContents && this.analyticsTabContents.length > 0) {
      this.analyticsTabContents.forEach(content => {
        const isActive = content.id === `analytics-tab-${tab}`;
        content.classList.toggle('active', isActive);
      });
    }
  }

  updateAdvancedStats(users) {
    if (!users || typeof users !== 'object') {
      users = {};
    }
    
    // Calculate time-based data
    const timeData = this.calculateTimeData(users);
    this.renderViolationsChart(timeData);
    
    // Calculate top violations
    const topViolations = this.calculateTopViolations(users);
    this.renderTopViolations(topViolations);
    
    // Calculate trends
    const trends = this.calculateTrends(users);
    this.renderTrends(trends);
    
    // Calculate week comparison
    const weekComparison = this.calculateWeekComparison(users);
    this.renderWeekComparison(weekComparison);
    
    // Calculate heatmap
    const heatmap = this.calculateHeatmap(users);
    this.renderHeatmap(heatmap);
    
    // Calculate top offenders
    const topOffenders = this.calculateTopOffenders(users);
    this.renderTopOffenders(topOffenders);
  }

  calculateTimeData(users) {
    const now = new Date();
    const period = this.currentPeriod === 'all' ? 365 : this.currentPeriod;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - period);
    
    // Group violations by day
    const dailyData = {};
    
    Object.values(users).forEach(user => {
      // Support both old and new data structure
      let violations = [];
      
      if (user.rules && typeof user.rules === 'object') {
        // New structure: multiple rules
        Object.values(user.rules).forEach(ruleData => {
          const count = ruleData.count || 1;
          const firstTimestamp = ruleData.firstTimestamp || user.timestamp;
          for (let i = 0; i < count; i++) {
            violations.push(firstTimestamp);
          }
        });
      } else {
        // Old structure: single violation
        const count = user.count || 1;
        for (let i = 0; i < count; i++) {
          violations.push(user.timestamp);
        }
      }
      
      violations.forEach(timestamp => {
        const date = new Date(timestamp);
        date.setHours(0, 0, 0, 0);
        const dateKey = date.toISOString().split('T')[0];
        
        if (date >= startDate) {
          if (!dailyData[dateKey]) {
            dailyData[dateKey] = 0;
          }
          dailyData[dateKey]++;
        }
      });
    });
    
    // Create array of dates in period
    const dates = [];
    const currentDate = new Date(startDate);
    while (currentDate <= now) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dates.push({
        date: dateKey,
        count: dailyData[dateKey] || 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  }

  renderViolationsChart(timeData) {
    if (!this.violationsChart || !this.chartLabels) return;
    
    if (timeData.length === 0) {
      this.violationsChart.innerHTML = '<div class="chart-empty">No data available</div>';
      this.chartLabels.innerHTML = '';
      return;
    }
    
    const maxCount = Math.max(...timeData.map(d => d.count), 1);
    const chartHeight = 120;
    
    // Render bars
    let barsHTML = '';
    let labelsHTML = '';
    
    // Group by week if period > 30 days, otherwise show daily
    const groupByWeek = this.currentPeriod === 'all' || this.currentPeriod > 30;
    
    if (groupByWeek) {
      // Group by week
      const weeklyData = {};
      timeData.forEach(item => {
        const date = new Date(item.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { count: 0, label: this.formatDate(weekStart) };
        }
        weeklyData[weekKey].count += item.count;
      });
      
      const weeks = Object.entries(weeklyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12); // Show last 12 weeks
      
      weeks.forEach(([weekKey, data]) => {
        const height = (data.count / maxCount) * chartHeight;
        const safeCount = SecurityUtils.escapeHtml(data.count.toString());
        const safeLabel = SecurityUtils.escapeHtml(data.label);
        
        barsHTML += `
          <div class="chart-bar" style="height: ${height}px;" title="${safeCount} violations">
            <div class="chart-bar-fill"></div>
          </div>
        `;
        labelsHTML += `<div class="chart-label">${safeLabel}</div>`;
      });
    } else {
      // Show daily (limit to last 30 days for readability)
      const recentData = timeData.slice(-30);
      
      recentData.forEach(item => {
        const height = (item.count / maxCount) * chartHeight;
        const date = new Date(item.date);
        const label = date.getDate().toString();
        const safeCount = SecurityUtils.escapeHtml(item.count.toString());
        const safeLabel = SecurityUtils.escapeHtml(label);
        
        barsHTML += `
          <div class="chart-bar" style="height: ${height}px;" title="${safeCount} violations">
            <div class="chart-bar-fill"></div>
          </div>
        `;
        labelsHTML += `<div class="chart-label">${safeLabel}</div>`;
      });
    }
    
    this.violationsChart.innerHTML = barsHTML;
    this.chartLabels.innerHTML = labelsHTML;
  }

  calculateTopViolations(users) {
    const ruleCounts = {};
    
    Object.values(users).forEach(user => {
      if (user.rules && typeof user.rules === 'object') {
        // New structure: multiple rules
        Object.entries(user.rules).forEach(([ruleId, ruleData]) => {
          if (!ruleCounts[ruleId]) {
            ruleCounts[ruleId] = 0;
          }
          ruleCounts[ruleId] += ruleData.count || 1;
        });
      } else if (user.rule) {
        // Old structure: single rule
        const ruleId = user.rule.toString();
        if (!ruleCounts[ruleId]) {
          ruleCounts[ruleId] = 0;
        }
        ruleCounts[ruleId] += user.count || 1;
      }
    });
    
    // Convert to array and sort
    const topViolations = Object.entries(ruleCounts)
      .map(([ruleId, count]) => {
        const rule = this.currentRules?.find(r => r.id === ruleId || r.id === ruleId.toString());
        return {
          ruleId,
          ruleName: rule ? rule.name : 'Unknown',
          count,
          color: rule ? rule.color : '#cccccc'
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5
    
    return topViolations;
  }

  renderTopViolations(topViolations) {
    if (!this.topViolationsList) return;
    
    if (topViolations.length === 0) {
      this.topViolationsList.innerHTML = '<div class="empty-state"><p>No violations recorded yet.</p></div>';
      return;
    }
    
    let html = '';
    const maxCount = Math.max(...topViolations.map(v => v.count), 1);
    
    topViolations.forEach((violation, index) => {
      const percentage = (violation.count / maxCount) * 100;
      const safeRuleName = SecurityUtils.escapeHtml(violation.ruleName);
      const safeCount = SecurityUtils.escapeHtml(violation.count.toString());
      const safeColor = SecurityUtils.validateHexColor(violation.color);
      
      html += `
        <div class="top-violation-item">
          <div class="top-violation-rank">#${index + 1}</div>
          <div class="top-violation-info">
            <div class="top-violation-name">${safeRuleName}</div>
            <div class="top-violation-bar">
              <div class="top-violation-bar-fill" style="width: ${percentage}%; background-color: ${safeColor};"></div>
            </div>
          </div>
          <div class="top-violation-count">${safeCount}</div>
        </div>
      `;
    });
    
    this.topViolationsList.innerHTML = html;
  }

  calculateTrends(users) {
    const now = new Date();
    const period = this.currentPeriod === 'all' ? 30 : Math.min(this.currentPeriod, 30);
    
    // Get data for current period and previous period
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - period);
    
    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - period);
    
    let currentCount = 0;
    let previousCount = 0;
    
    Object.values(users).forEach(user => {
      let violations = [];
      
      if (user.rules && typeof user.rules === 'object') {
        Object.values(user.rules).forEach(ruleData => {
          const count = ruleData.count || 1;
          const firstTimestamp = ruleData.firstTimestamp || user.timestamp;
          for (let i = 0; i < count; i++) {
            violations.push(firstTimestamp);
          }
        });
      } else {
        const count = user.count || 1;
        for (let i = 0; i < count; i++) {
          violations.push(user.timestamp);
        }
      }
      
      violations.forEach(timestamp => {
        const date = new Date(timestamp);
        if (date >= currentStart && date <= now) {
          currentCount++;
        } else if (date >= previousStart && date < currentStart) {
          previousCount++;
        }
      });
    });
    
    const change = previousCount > 0 
      ? ((currentCount - previousCount) / previousCount) * 100 
      : (currentCount > 0 ? 100 : 0);
    
    return {
      current: currentCount,
      previous: previousCount,
      change: change,
      trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable'
    };
  }

  renderTrends(trends) {
    if (!this.trendsContainer) return;
    
    const safeCurrent = SecurityUtils.escapeHtml(trends.current.toString());
    const safePrevious = SecurityUtils.escapeHtml(trends.previous.toString());
    const changeAbs = Math.abs(trends.change).toFixed(1);
    const safeChange = SecurityUtils.escapeHtml(changeAbs);
    
    let trendIcon = '→';
    let trendClass = 'trend-stable';
    let trendText = 'Stable';
    
    if (trends.trend === 'up') {
      trendIcon = '↑';
      trendClass = 'trend-up';
      trendText = `Up ${safeChange}%`;
    } else if (trends.trend === 'down') {
      trendIcon = '↓';
      trendClass = 'trend-down';
      trendText = `Down ${safeChange}%`;
    }
    
    this.trendsContainer.innerHTML = `
      <div class="trend-item">
        <div class="trend-label">Current Period</div>
        <div class="trend-value">${safeCurrent}</div>
      </div>
      <div class="trend-item">
        <div class="trend-label">Previous Period</div>
        <div class="trend-value">${safePrevious}</div>
      </div>
      <div class="trend-item ${trendClass}">
        <div class="trend-label">Trend</div>
        <div class="trend-value">${trendIcon} ${trendText}</div>
      </div>
    `;
  }

  calculateWeekComparison(users) {
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay()); // Start of this week (Sunday)
    thisWeekStart.setHours(0, 0, 0, 0);
    
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setMilliseconds(-1);
    
    let thisWeekCount = 0;
    let lastWeekCount = 0;
    
    Object.values(users).forEach(user => {
      let violations = [];
      
      if (user.rules && typeof user.rules === 'object') {
        Object.values(user.rules).forEach(ruleData => {
          const count = ruleData.count || 1;
          const firstTimestamp = ruleData.firstTimestamp || user.timestamp;
          for (let i = 0; i < count; i++) {
            violations.push(firstTimestamp);
          }
        });
      } else {
        const count = user.count || 1;
        for (let i = 0; i < count; i++) {
          violations.push(user.timestamp);
        }
      }
      
      violations.forEach(timestamp => {
        const date = new Date(timestamp);
        if (date >= thisWeekStart && date <= now) {
          thisWeekCount++;
        } else if (date >= lastWeekStart && date < thisWeekStart) {
          lastWeekCount++;
        }
      });
    });
    
    const change = lastWeekCount > 0 
      ? ((thisWeekCount - lastWeekCount) / lastWeekCount) * 100 
      : (thisWeekCount > 0 ? 100 : 0);
    
    return {
      thisWeek: thisWeekCount,
      lastWeek: lastWeekCount,
      change: change,
      trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable'
    };
  }

  renderWeekComparison(comparison) {
    if (!this.weekComparisonContainer) return;
    
    const safeThisWeek = SecurityUtils.escapeHtml(comparison.thisWeek.toString());
    const safeLastWeek = SecurityUtils.escapeHtml(comparison.lastWeek.toString());
    const changeAbs = Math.abs(comparison.change).toFixed(1);
    const safeChange = SecurityUtils.escapeHtml(changeAbs);
    
    let trendIcon = '→';
    let trendClass = 'trend-stable';
    let trendText = 'No change';
    
    if (comparison.trend === 'up') {
      trendIcon = '↑';
      trendClass = 'trend-up';
      trendText = `+${safeChange}%`;
    } else if (comparison.trend === 'down') {
      trendIcon = '↓';
      trendClass = 'trend-down';
      trendText = `-${safeChange}%`;
    }
    
    this.weekComparisonContainer.innerHTML = `
      <div class="week-comparison-item">
        <div class="week-comparison-label">This Week</div>
        <div class="week-comparison-value">${safeThisWeek}</div>
      </div>
      <div class="week-comparison-item">
        <div class="week-comparison-label">Last Week</div>
        <div class="week-comparison-value">${safeLastWeek}</div>
      </div>
      <div class="week-comparison-item ${trendClass}">
        <div class="week-comparison-label">Change</div>
        <div class="week-comparison-value">${trendIcon} ${trendText}</div>
      </div>
    `;
  }

  calculateHeatmap(users) {
    const heatmap = {};
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    // Initialize heatmap
    daysOfWeek.forEach(day => {
      heatmap[day] = {};
      hours.forEach(hour => {
        heatmap[day][hour] = 0;
      });
    });
    
    Object.values(users).forEach(user => {
      let violations = [];
      
      if (user.rules && typeof user.rules === 'object') {
        Object.values(user.rules).forEach(ruleData => {
          const count = ruleData.count || 1;
          const firstTimestamp = ruleData.firstTimestamp || user.timestamp;
          for (let i = 0; i < count; i++) {
            violations.push(firstTimestamp);
          }
        });
      } else {
        const count = user.count || 1;
        for (let i = 0; i < count; i++) {
          violations.push(user.timestamp);
        }
      }
      
      violations.forEach(timestamp => {
        const date = new Date(timestamp);
        const day = daysOfWeek[date.getDay()];
        const hour = date.getHours();
        if (heatmap[day] && heatmap[day][hour] !== undefined) {
          heatmap[day][hour]++;
        }
      });
    });
    
    return { heatmap, maxCount: Math.max(...Object.values(heatmap).flatMap(day => Object.values(day)), 1) };
  }

  renderHeatmap(heatmapData) {
    if (!this.heatmapContainer) return;
    
    const { heatmap, maxCount } = heatmapData;
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    let html = '<div class="heatmap-grid">';
    
    // Header row (hours)
    html += '<div class="heatmap-header"></div>';
    hours.forEach(hour => {
      html += `<div class="heatmap-hour-label">${hour.toString().padStart(2, '0')}:00</div>`;
    });
    
    // Data rows (days)
    daysOfWeek.forEach(day => {
      html += `<div class="heatmap-day-label">${day}</div>`;
      hours.forEach(hour => {
        const count = heatmap[day][hour] || 0;
        const intensity = maxCount > 0 ? (count / maxCount) : 0;
        const opacity = Math.max(0.1, intensity);
        const safeCount = SecurityUtils.escapeHtml(count.toString());
        const safeDay = SecurityUtils.escapeHtml(day);
        const safeHour = SecurityUtils.escapeHtml(hour.toString());
        
        html += `<div class="heatmap-cell" style="background: rgba(0, 158, 255, ${opacity});" title="${safeDay} ${safeHour}:00 - ${safeCount} violation${count !== 1 ? 's' : ''}"></div>`;
      });
    });
    
    html += '</div>';
    this.heatmapContainer.innerHTML = html;
  }

  calculateTopOffenders(users) {
    const offenders = [];
    
    Object.entries(users).forEach(([username, userData]) => {
      const totalViolations = this.getTotalViolations(userData);
      const reputation = this.calculateReputationScore(userData);
      
      // Get most recent violation and dominant rule color
      let lastViolation = 0;
      let dominantRuleColor = '#009eff'; // Default color
      
      if (userData.rules && typeof userData.rules === 'object') {
        let rulesList = [];
        Object.entries(userData.rules).forEach(([ruleId, ruleData]) => {
          const rule = this.currentRules?.find(r => r.id === ruleId || r.id === ruleId.toString());
          if (rule) {
            rulesList.push({
              count: ruleData.count || 1,
              color: rule.color
            });
          }
          const timestamp = ruleData.firstTimestamp || userData.timestamp;
          if (timestamp > lastViolation) {
            lastViolation = timestamp;
          }
        });
        
        // Find dominant rule (rule with most violations)
        if (rulesList.length > 0) {
          const dominantRule = rulesList.length === 1 
            ? rulesList[0]
            : rulesList.reduce((prev, current) => 
                (prev.count > current.count) ? prev : current
              );
          dominantRuleColor = dominantRule.color || '#009eff';
        }
      } else if (userData.rule) {
        lastViolation = userData.timestamp || 0;
        const ruleId = userData.rule.toString();
        const rule = this.currentRules?.find(r => r.id === ruleId || r.id === ruleId.toString());
        if (rule) {
          dominantRuleColor = rule.color || '#009eff';
        }
      } else {
        lastViolation = userData.timestamp || 0;
      }
      
      offenders.push({
        username,
        totalViolations,
        reputation: reputation.score,
        lastViolation,
        trend: reputation.trend,
        dominantRuleColor
      });
    });
    
    // Sort by total violations (descending), then by reputation (ascending)
    offenders.sort((a, b) => {
      if (b.totalViolations !== a.totalViolations) {
        return b.totalViolations - a.totalViolations;
      }
      return a.reputation - b.reputation;
    });
    
    return offenders.slice(0, 5); // Top 5
  }

  renderTopOffenders(offenders) {
    if (!this.topOffendersList) return;
    
    if (offenders.length === 0) {
      this.topOffendersList.innerHTML = '<div class="empty-state"><p>No offenders recorded yet.</p></div>';
      return;
    }
    
    let html = '';
    offenders.forEach((offender, index) => {
      const safeUsername = SecurityUtils.escapeHtml(offender.username);
      const safeViolations = SecurityUtils.escapeHtml(offender.totalViolations.toString());
      const safeReputation = SecurityUtils.escapeHtml(offender.reputation.toString());
      const safeColor = SecurityUtils.validateHexColor(offender.dominantRuleColor);
      
      let trendIcon = '';
      if (offender.trend === 'up') {
        trendIcon = '<span class="trend-up">↑</span>';
      } else if (offender.trend === 'down') {
        trendIcon = '<span class="trend-down">↓</span>';
      }
      
      const lastViolationDate = new Date(offender.lastViolation).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
      const safeDate = SecurityUtils.escapeHtml(lastViolationDate);
      
      html += `
        <div class="top-offender-item" style="border-left: 3px solid ${safeColor};">
          <div class="top-offender-rank" style="color: ${safeColor};">#${index + 1}</div>
          <div class="top-offender-info">
            <div class="top-offender-username">@${safeUsername}</div>
            <div class="top-offender-meta">
              <span>${safeViolations} violations</span>
              <span>•</span>
              <span>Rep: ${safeReputation}/100</span>
              <span>•</span>
              <span>Last: ${safeDate}</span>
              ${trendIcon}
            </div>
          </div>
        </div>
      `;
    });
    
    this.topOffendersList.innerHTML = html;
  }

  formatDate(date) {
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  }

  getSelectedUsers() {
    const checkboxes = document.querySelectorAll('.user-select-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.dataset.username);
  }

  updateBulkActionsBar() {
    const selectedCount = this.getSelectedUsers().length;
    
    if (this.bulkActionsCount) {
      this.bulkActionsCount.textContent = selectedCount;
    }
    
    if (this.bulkActionsBar) {
      this.bulkActionsBar.style.display = selectedCount > 0 ? 'flex' : 'none';
    }
  }

  selectAllUsers() {
    const checkboxes = document.querySelectorAll('.user-select-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = true;
    });
    this.updateBulkActionsBar();
  }

  deselectAllUsers() {
    const checkboxes = document.querySelectorAll('.user-select-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
    this.updateBulkActionsBar();
  }

  async removeSelectedUsers() {
    const selectedUsernames = this.getSelectedUsers();
    
    if (selectedUsernames.length === 0) {
      this.showNotification('No users selected!', 'error');
      return;
    }
    
    if (!confirm(`Are you sure you want to remove ${selectedUsernames.length} user(s)?`)) {
      return;
    }
    
    try {
      for (const username of selectedUsernames) {
        await UserStorage.removeUser(username);
      }
      
      await this.loadUsers();
      await this.loadAnalyticsData();
      this.showNotification(`${selectedUsernames.length} user(s) removed successfully!`, 'success');
      
      // Refresh content script in all X.com/Twitter tabs immediately
      chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: 'refreshUsers' }).catch(() => {});
        });
      });
      
      this.updateBulkActionsBar();
    } catch (error) {
      this.showNotification('Error removing users!', 'error');
    }
  }

  async exportSelectedUsers() {
    const selectedUsernames = this.getSelectedUsers();
    
    if (selectedUsernames.length === 0) {
      this.showNotification('No users selected!', 'error');
      return;
    }
    
    try {
      const allUsers = await UserStorage.getMarkedUsers();
      const selectedUsers = {};
      
      selectedUsernames.forEach(username => {
        const usernameLower = username.toLowerCase();
        if (allUsers[usernameLower]) {
          selectedUsers[usernameLower] = allUsers[usernameLower];
        }
      });
      
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        exportType: 'selected_users',
        users: selectedUsers
      };
      
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `x-flagr-selected-users-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showNotification(`${selectedUsernames.length} user(s) exported successfully!`, 'success');
    } catch (error) {
      this.showNotification('Error exporting users!', 'error');
    }
  }

  async handleSearch(searchTerm) {
    const users = await UserStorage.getMarkedUsers();
    const sortBy = this.analyticsSortSelect ? this.analyticsSortSelect.value : 'newest';
    
    // Show/hide clear button
    if (this.searchClearBtn) {
      this.searchClearBtn.style.display = searchTerm.trim() ? 'flex' : 'none';
    }
    
    this.renderAnalyticsUsersList(users, searchTerm, sortBy);
  }

  async handleSort(sortBy) {
    const users = await UserStorage.getMarkedUsers();
    const searchTerm = this.analyticsSearchInput ? this.analyticsSearchInput.value : '';
    this.renderAnalyticsUsersList(users, searchTerm, sortBy);
  }

  updateStats(users) {
    // Ensure users is an object, not null/undefined
    if (!users || typeof users !== 'object') {
      users = {};
    }
    
    const totalUsers = Object.keys(users).length;
    const activeLabels = this.showLabels && this.showLabels.checked ? totalUsers : 0;
    
    // Calculate total violations (support both old and new data structure)
    const totalViolations = Object.values(users).reduce((sum, user) => {
      if (user.rules && typeof user.rules === 'object') {
        // New structure: sum all rule violations
        return sum + Object.values(user.rules).reduce((ruleSum, ruleData) => {
          return ruleSum + (ruleData.count || 1);
        }, 0);
      } else if (user.count) {
        // Old structure: single count
        return sum + user.count;
      }
      return sum + 1; // Default to 1 if no count
    }, 0);
    
    // Calculate today's activity (users marked today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    
    const todayActivity = Object.values(users).filter(user => {
      const userDate = new Date(user.timestamp);
      userDate.setHours(0, 0, 0, 0);
      return userDate.getTime() === todayTimestamp;
    }).length;
    
    // Rule counts (support both old and new data structure)
    const ruleCounts = {};
    // Initialize with current rules
    if (this.currentRules) {
      this.currentRules.forEach(rule => {
        ruleCounts[rule.id] = 0;
      });
    }
    
    Object.values(users).forEach(user => {
      if (user.rules && typeof user.rules === 'object') {
        // New structure: count each rule
        Object.keys(user.rules).forEach(ruleId => {
          if (ruleCounts[ruleId] !== undefined) {
            ruleCounts[ruleId] += 1; // Count users with this rule, not violations
          }
        });
      } else if (user.rule) {
        // Old structure: single rule
        const ruleId = user.rule.toString();
        if (ruleCounts[ruleId] !== undefined) {
          ruleCounts[ruleId] += 1;
        }
      }
    });
    
    // Update UI
    if (this.totalUsers) this.totalUsers.textContent = totalUsers;
    if (this.activeLabels) this.activeLabels.textContent = activeLabels;
    if (this.totalViolations) this.totalViolations.textContent = totalViolations;
    if (this.todayActivity) this.todayActivity.textContent = todayActivity;
    
    // Render rule statistics dynamically
    this.renderRuleStatistics(this.currentRules || [], ruleCounts);
  }

  renderRuleStatistics(rules, ruleCounts) {
    const grid = document.getElementById('ruleStatsGrid');
    if (!grid) return;

    // Clear existing content
    grid.innerHTML = '';

    if (!rules || rules.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p>No rules created yet.</p></div>';
      return;
    }

    // Render each rule
    rules.forEach(rule => {
      const count = ruleCounts[rule.id] || 0;
      const safeRuleId = /^[0-9]+$/.test(String(rule.id)) || /^[a-zA-Z0-9_]+$/.test(String(rule.id))
        ? String(rule.id)
        : 'invalid';
      const safeRuleName = SecurityUtils.escapeHtml(rule.name);
      const safeColor = SecurityUtils.validateHexColor(rule.color);

      const ruleItem = document.createElement('div');
      ruleItem.className = `rule-stat-item rule-${safeRuleId}`;
      ruleItem.style.borderLeft = `3px solid ${safeColor}`;
      ruleItem.innerHTML = `
        <div class="rule-stat-label">${safeRuleName}</div>
        <div class="rule-stat-count" data-rule-id="${safeRuleId}">${count}</div>
      `;
      grid.appendChild(ruleItem);
    });
  }

  async toggleLabels() {
    if (!this.showLabels) return;
    const enabled = this.showLabels.checked;
    await chrome.storage.local.set({ labelsEnabled: enabled });
    
    // Update stats
    this.updateStats(await UserStorage.getMarkedUsers());
    
    // Notify content script in all X.com/Twitter tabs
    chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { 
          action: 'toggleLabels', 
          enabled: enabled 
        }).catch(() => {
          // Silently fail if tab is not responsive
        });
      });
    });
  }

  async toggleNotifications() {
    if (!this.notificationsToggle) return;
    const enabled = this.notificationsToggle.checked;
    await chrome.storage.local.set({ notificationsEnabled: enabled });
    
    this.showNotification(
      enabled ? 'Notifications enabled' : 'Notifications disabled',
      'info'
    );
  }


  async sendBrowserNotification(title, message) {
    try {
      const result = await chrome.storage.local.get(['notificationsEnabled']);
      const notificationsEnabled = result.notificationsEnabled !== false;
      
      if (!notificationsEnabled) {
        return;
      }
      
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: title,
        message: message,
        priority: 2
      });
    } catch (error) {
      // Silently fail if notifications are not supported
    }
  }


  async exportData() {
    try {
      const users = await UserStorage.getMarkedUsers();
      const rules = await RuleStorage.getRules();
      const settings = await chrome.storage.local.get(['notificationsEnabled', 'labelsEnabled']);
      
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        users: users,
        rules: rules,
        settings: {
          notificationsEnabled: settings.notificationsEnabled,
          labelsEnabled: settings.labelsEnabled
        }
      };
      
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `x-flagr-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showNotification('Data exported successfully!', 'success');
    } catch (error) {
      this.showNotification('Error exporting data!', 'error');
    }
  }

  async importData(file) {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // Validate import data structure
      if (!importData.users || !importData.rules) {
        this.showNotification('Invalid backup file format!', 'error');
        return;
      }
      
      // Confirm import
      if (!confirm('This will replace all your current data. Are you sure?')) {
        this.importDataInput.value = '';
        return;
      }
      
      // Import users
      await UserStorage.saveMarkedUsers(importData.users || {});
      
      // Import rules
      await RuleStorage.saveRules(importData.rules || []);
      
      // Import settings
      if (importData.settings) {
        await chrome.storage.local.set({
          notificationsEnabled: importData.settings.notificationsEnabled !== undefined ? importData.settings.notificationsEnabled : true,
          labelsEnabled: importData.settings.labelsEnabled !== undefined ? importData.settings.labelsEnabled : true
        });
        
      }
      
      // Refresh UI
      await this.loadRules();
      await this.loadUsers();
      await this.loadSettings();
      
      // Refresh content scripts
      chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: 'refreshUsers' }).catch(() => {});
          chrome.tabs.sendMessage(tab.id, { action: 'refreshRules' }).catch(() => {});
        });
      });
      
      this.showNotification('Data imported successfully!', 'success');
      this.importDataInput.value = '';
    } catch (error) {
      this.showNotification('Error importing data! Invalid file format.', 'error');
      this.importDataInput.value = '';
    }
  }

  async exportWeeklyReport() {
    try {
      const users = await UserStorage.getMarkedUsers();
      const rules = await RuleStorage.getRules();
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // Start of this week (Sunday)
      weekStart.setHours(0, 0, 0, 0);
      
      // Collect violations from this week
      const reportData = [];
      const ruleMap = {};
      rules.forEach(rule => {
        ruleMap[rule.id] = rule.name;
      });
      
      Object.entries(users).forEach(([username, userData]) => {
        if (userData.rules && typeof userData.rules === 'object') {
          Object.entries(userData.rules).forEach(([ruleId, ruleData]) => {
            const violationDate = new Date(ruleData.firstTimestamp || userData.timestamp);
            if (violationDate >= weekStart) {
              const ruleName = ruleMap[ruleId] || 'Unknown';
              reportData.push({
                username,
                rule: ruleName,
                count: ruleData.count || 1,
                date: violationDate.toISOString().split('T')[0],
                timestamp: violationDate.toISOString()
              });
            }
          });
        } else if (userData.rule) {
          const violationDate = new Date(userData.timestamp);
          if (violationDate >= weekStart) {
            const ruleName = ruleMap[userData.rule] || 'Unknown';
            reportData.push({
              username,
              rule: ruleName,
              count: userData.count || 1,
              date: violationDate.toISOString().split('T')[0],
              timestamp: violationDate.toISOString()
            });
          }
        }
      });
      
      // Generate CSV
      const csvHeader = 'Username,Rule,Violations,Date,Timestamp\n';
      const csvRows = reportData.map(row => 
        `"${row.username}","${row.rule}",${row.count},"${row.date}","${row.timestamp}"`
      ).join('\n');
      const csv = csvHeader + csvRows;
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      a.download = `x-flagr-weekly-report-${weekStart.toISOString().split('T')[0]}-to-${weekEnd.toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showNotification('Weekly report exported successfully!', 'success');
    } catch (error) {
      this.showNotification('Error exporting weekly report!', 'error');
    }
  }

  async exportMonthlyReport() {
    try {
      const users = await UserStorage.getMarkedUsers();
      const rules = await RuleStorage.getRules();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      
      // Collect violations from this month
      const reportData = [];
      const ruleMap = {};
      rules.forEach(rule => {
        ruleMap[rule.id] = rule.name;
      });
      
      Object.entries(users).forEach(([username, userData]) => {
        if (userData.rules && typeof userData.rules === 'object') {
          Object.entries(userData.rules).forEach(([ruleId, ruleData]) => {
            const violationDate = new Date(ruleData.firstTimestamp || userData.timestamp);
            if (violationDate >= monthStart) {
              const ruleName = ruleMap[ruleId] || 'Unknown';
              reportData.push({
                username,
                rule: ruleName,
                count: ruleData.count || 1,
                date: violationDate.toISOString().split('T')[0],
                timestamp: violationDate.toISOString()
              });
            }
          });
        } else if (userData.rule) {
          const violationDate = new Date(userData.timestamp);
          if (violationDate >= monthStart) {
            const ruleName = ruleMap[userData.rule] || 'Unknown';
            reportData.push({
              username,
              rule: ruleName,
              count: userData.count || 1,
              date: violationDate.toISOString().split('T')[0],
              timestamp: violationDate.toISOString()
            });
          }
        }
      });
      
      // Generate CSV
      const csvHeader = 'Username,Rule,Violations,Date,Timestamp\n';
      const csvRows = reportData.map(row => 
        `"${row.username}","${row.rule}",${row.count},"${row.date}","${row.timestamp}"`
      ).join('\n');
      const csv = csvHeader + csvRows;
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      a.download = `x-flagr-monthly-report-${monthName.replace(' ', '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showNotification('Monthly report exported successfully!', 'success');
    } catch (error) {
      this.showNotification('Error exporting monthly report!', 'error');
    }
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
}

// Initialize popup when DOM is loaded
let popupInstance = null;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    popupInstance = new PopupUI();
  });
} else {
  popupInstance = new PopupUI();
}


