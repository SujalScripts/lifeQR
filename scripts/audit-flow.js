const fs = require('fs');
const path = require('path');

const htmlFiles = [
  'website/landingpage.html',
  'website/index.html',
  'website/lifeqr_login.html',
  'website/lifeqr_signup.html',
  'app/patient_app.html',
  'app/patient_dashboard.html',
  'app/doctor_dashboard.html',
  'app/CrewAmbulance_dashboard.html',
  'app/hospital_dashboard.html',
  'app/er_dashboard.html',
  'app/admin_dashboard.html',
  'app/emergency_access.html',
  'app/splash.html'
];

console.log('=== AUDITING HTML LINKS ACROSS ALL PAGES ===\n');

htmlFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`[MISSING FILE] ${file}`);
    return;
  }
  const content = fs.readFileSync(file, 'utf8');
  const hrefRegex = /href=["']([^"']+)["']/g;
  let match;
  const links = [];
  while ((match = hrefRegex.exec(content)) !== null) {
    const link = match[1];
    if (!link.startsWith('#') && !link.startsWith('http') && !link.startsWith('data:') && !link.startsWith('tel:') && !link.startsWith('mailto:')) {
      links.push(link);
    }
  }
  const uniqueLinks = [...new Set(links)];
  console.log(`📄 ${file} (${uniqueLinks.length} internal links):`);
  uniqueLinks.forEach(link => {
    // Check if target file exists relative to file dir or app/website
    const dir = path.dirname(file);
    const target1 = path.join(dir, link.split('?')[0]);
    const target2 = path.join('app', link.split('?')[0]);
    const target3 = path.join('website', link.split('?')[0]);
    const target4 = path.join(dir, link.replace(/^\.\.\//, '').split('?')[0]);
    const exists = fs.existsSync(target1) || fs.existsSync(target2) || fs.existsSync(target3) || fs.existsSync(target4);
    if (!exists && !link.startsWith('/api') && !link.startsWith('/manifest')) {
      console.log(`   ❌ BROKEN LINK: ${link}`);
    } else {
      console.log(`   ✓ ${link}`);
    }
  });
  console.log('');
});
