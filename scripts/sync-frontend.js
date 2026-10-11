/**
 * Shared Theme & Brand Asset Copy Utility (LifeQR)
 * 
 * ARCHITECTURAL RULE:
 * App view (`app/`) and Website view (`website/`) share the same backend,
 * but their interface and UI/UX are intentionally distinct (form factor, layout,
 * mobile-first components vs desktop web portal).
 * 
 * - HTML pages and distinct UI scripts are NEVER synchronized/overwritten.
 * - NO continuous auto-syncing / file watchers run in the background.
 * - This script only performs a manual one-time copy of shared design tokens,
 *   theme stylesheets, and brand assets when explicitly invoked.
 */

const fs = require('fs');
const path = require('path');

const websiteDir = path.resolve(__dirname, '../website');
const appDir = path.resolve(__dirname, '../app');

// Shared theme, design tokens, and brand assets eligible for manual copy:
const SHARED_THEME_ASSETS = [
  'css/theme.css',
  'css/styles.css',
  'src/input.css',
  'dist/output.css',
  'LifeQR.png',
  'lifeqr_transparent.png',
  'lifeqr_code_logo.png',
  'lifeqr_logo_badge.png',
  'lifeqr_logo_dark.png',
  'lifeqr_splash_cinematic.jpg'
];

function ensureDirExists(filePath) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

/**
 * Copies a single shared theme asset if source is newer than destination
 */
function copyThemeAsset(fileRelative, options = {}) {
  const pathWebsite = path.join(websiteDir, fileRelative);
  const pathApp = path.join(appDir, fileRelative);

  const websiteExists = fs.existsSync(pathWebsite);
  const appExists = fs.existsSync(pathApp);

  if (!websiteExists && !appExists) return;

  if (websiteExists && !appExists) {
    ensureDirExists(pathApp);
    try {
      fs.copyFileSync(pathWebsite, pathApp);
      if (!options.silent) console.log(`   ✓ Copied shared asset: website/${fileRelative} -> app/${fileRelative}`);
    } catch (e) {
      console.warn(`   ⚠️ Could not copy website/${fileRelative}:`, e.message);
    }
    return;
  }

  if (!websiteExists && appExists) {
    ensureDirExists(pathWebsite);
    try {
      fs.copyFileSync(pathApp, pathWebsite);
      if (!options.silent) console.log(`   ✓ Copied shared asset: app/${fileRelative} -> website/${fileRelative}`);
    } catch (e) {
      console.warn(`   ⚠️ Could not copy app/${fileRelative}:`, e.message);
    }
    return;
  }

  const statWebsite = fs.statSync(pathWebsite);
  const statApp = fs.statSync(pathApp);
  const diff = statWebsite.mtimeMs - statApp.mtimeMs;

  if (Math.abs(diff) > 100) {
    if (diff > 0) {
      try {
        fs.copyFileSync(pathWebsite, pathApp);
        if (!options.silent) console.log(`   ✓ Updated theme asset: app/${fileRelative} from website/${fileRelative}`);
      } catch (e) {
        console.warn(`   ⚠️ Could not update app/${fileRelative}:`, e.message);
      }
    } else {
      try {
        fs.copyFileSync(pathApp, pathWebsite);
        if (!options.silent) console.log(`   ✓ Updated theme asset: website/${fileRelative} from app/${fileRelative}`);
      } catch (e) {
        console.warn(`   ⚠️ Could not update website/${fileRelative}:`, e.message);
      }
    }
  }
}

/**
 * Manual one-time copy of shared theme and style assets (No auto-syncing)
 */
function syncAll(options = {}) {
  console.log('🎨 Theme & Style Copy: Syncing shared tokens and branding (HTML/UI views preserved independently)...');
  let count = 0;
  for (const asset of SHARED_THEME_ASSETS) {
    copyThemeAsset(asset, options);
    count++;
  }
  console.log(`   ✓ Done. ${count} shared theme/brand assets verified. App and Website UI/UX layouts remain isolated.`);
}

/**
 * Auto-sync watcher is explicitly disabled per design standard.
 */
function startWatcher() {
  console.log('ℹ️ Continuous auto-sync is disabled. App view and Website view maintain independent UI/UX and feature layouts.');
}

// Execute if run directly
if (require.main === module) {
  syncAll();
}

module.exports = { syncAll, startWatcher, copyThemeAsset, SHARED_THEME_ASSETS };
