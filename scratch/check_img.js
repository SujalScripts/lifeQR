const fs = require('fs');
function getPngSize(p) {
  const buf = fs.readFileSync(p);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
const dir = 'C:\\Users\\tarun\\.gemini\\antigravity-ide\\brain\\08b9a5ea-520e-4487-bb4a-2fd6538a6aef';
console.log('onboarding_step1_intro:', getPngSize(dir + '\\onboarding_step1_intro.png'));
