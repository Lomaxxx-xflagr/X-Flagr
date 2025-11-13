# Release Notes

## Version 1.0.1 (Current)

### 🎉 New Features

#### Quick-Mark Feature
- **Inline Mark Button**: Quick-mark button appears below profile pictures in X.com communities
- **Smart Popup**: Click the button to see all available rules and mark users instantly
- **Auto-Detection**: Automatic violation suggestions based on tweet content
- **Real-Time Updates**: Labels and buttons update immediately after marking

#### Reputation Score System
- **Automated Calculation**: Each user gets a reputation score (0-100)
- **Multi-Factor Analysis**: Considers total violations, unique rules, time factors, and frequency
- **Trend Indicators**: Shows if user behavior is improving (↑), declining (↓), or stable (→)
- **Visual Badges**: Color-coded reputation badges in user list and details panel
- **Labels**: Excellent (80+), Good (60-79), Fair (40-59), Poor (20-39), Critical (0-19)

#### Advanced Analytics & Reports
- **Violations Over Time**: Visual chart showing violation trends
- **Week Comparison**: Compare current week vs. previous week with percentage changes
- **Violations Heatmap**: See when violations occur most frequently (by day and hour)
- **Top Offenders**: List of top 5 users with most violations (with rule color coding)
- **CSV Export**: Export weekly and monthly reports as CSV files
- **Tabbed Interface**: Organized analytics tabs to reduce scrolling

#### Enhanced User Management
- **Individual Violation Removal**: Remove single violations without deleting entire user
- **User Notes**: Add custom notes to user profiles
- **Improved User Details Panel**: Better layout with larger text and clearer structure
- **Violation Cards**: Each violation displayed in a card with remove button

#### Community-Only Mode
- **Smart Detection**: Extension only works within X.com communities
- **URL Detection**: Detects community pages and individual tweets within communities
- **Automatic Cleanup**: Removes buttons/labels when navigating away from communities

### 🐛 Bug Fixes
- Fixed label display issues in tweet details view
- Fixed quick-mark button visibility and positioning
- Fixed real-time badge updates after marking users
- Fixed community detection for individual tweet URLs
- Improved button injection reliability

### 🎨 UI/UX Improvements
- Redesigned user details panel with better spacing
- Improved violation card layout with centered remove buttons
- Larger username, reputation score, and violation count displays
- Better visual hierarchy and section separation
- Removed duplicate username display

### 🔒 Security & Privacy
- Enhanced input validation
- Improved XSS protection
- Better error handling

### 📝 Documentation
- Complete README.md rewrite
- Added LICENSE file (MIT)
- Added .gitignore
- Privacy Policy updated

### 🗑️ Removed
- License system completely removed (extension is now free and open source)
- All license-related code and UI elements

---

## Version 1.0.0

### Initial Release
- User marking system with custom rules
- Color-coded labels on X.com
- Analytics dashboard with basic statistics
- Browser notifications
- Modern UI with dark theme
- Local data storage
- Rule management system

---

## Upgrade Notes

### From 1.0.0 to 1.0.1
- No breaking changes
- All existing data is compatible
- New features are automatically available
- No migration needed

---

## Known Issues

None at this time.

---

## Future Roadmap

- [ ] Multi-language support
- [ ] Team collaboration features
- [ ] Advanced filtering options
- [ ] Custom rule templates
- [ ] Integration with other moderation tools

---

For detailed changelog, see [GitHub Commits](https://github.com/Lomaxxx-xflagr/X-Flagr/commits/main)

