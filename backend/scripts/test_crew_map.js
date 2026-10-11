const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function testCrewDashboard() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const executablePath = fs.existsSync(edgePath) ? edgePath : chromePath;

  console.log('Using browser at:', executablePath);

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('Navigating to login page...');
  await page.goto('http://localhost:5000/lifeqr_login.html', { waitUntil: 'networkidle2' });

  console.log('Logging in as crew@lifeqr.com...');
  await page.type('#email', 'crew@lifeqr.com');
  await page.type('#password', 'Password@123');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    page.click('button[type="submit"]')
  ]);

  // Give a moment if redirected via JS
  await new Promise(r => setTimeout(r, 2000));
  console.log('Current URL:', page.url());

  if (!page.url().includes('CrewAmbulance_dashboard.html')) {
    console.log('Navigating directly to CrewAmbulance_dashboard.html...');
    await page.goto('http://localhost:5000/CrewAmbulance_dashboard.html', { waitUntil: 'networkidle2' });
  }

  // Count map containers
  const mapCount = await page.evaluate(() => {
    return {
      tacticalRadarMap: !!document.getElementById('crewTacticalRadarMap'),
      leafletMapContainer: !!document.getElementById('leafletMapContainer'),
      allLeafletMaps: document.querySelectorAll('.leaflet-container').length
    };
  });
  console.log('Map containers on standby:', mapCount);

  // Check tile requests or CartoDB tile layer
  const tileLayerCheck = await page.evaluate(() => {
    const tileImages = Array.from(document.querySelectorAll('.leaflet-tile')).map(img => img.src);
    return {
      count: tileImages.length,
      sampleSrc: tileImages.slice(0, 3)
    };
  });
  console.log('Tile layer check:', tileLayerCheck);

  // Click quick test button for Rahul Sharma (RAH-81E49300)
  console.log('Searching patient RAH-81E49300...');
  await page.evaluate(() => {
    const input = document.getElementById('patientQrId');
    if (input) input.value = 'RAH-81E49300';
    window.searchPatient();
  });

  // Wait for patient details to load and render
  await new Promise(r => setTimeout(r, 2500));

  const triageState = await page.evaluate(() => {
    const patName = document.getElementById('patName')?.textContent;
    const patBlood = document.getElementById('patBloodGroup')?.textContent;
    const hudVisible = !document.getElementById('mapTacticalHud')?.classList.contains('hidden');
    const hudDist = document.getElementById('hudDistanceText')?.textContent;
    const hudEta = document.getElementById('hudEtaText')?.textContent;
    const allLeafletMaps = document.querySelectorAll('.leaflet-container').length;
    const patientDetailsVisible = !document.getElementById('patientDetailsPanel')?.classList.contains('hidden');
    const standbyHidden = document.getElementById('standbyDeck')?.classList.contains('hidden');
    const scannedMarker = document.querySelectorAll('.custom-scanned-patient-icon').length;

    return {
      patName,
      patBlood,
      hudVisible,
      hudDist,
      hudEta,
      allLeafletMaps,
      patientDetailsVisible,
      standbyHidden,
      scannedMarker
    };
  });

  console.log('Triage & Radar State:', triageState);

  // Take screenshot for visual confirmation
  await page.screenshot({ path: 'crew_radar_validated.png', fullPage: false });
  console.log('Saved screenshot to crew_radar_validated.png');

  await browser.close();
}

testCrewDashboard().catch(console.error);
