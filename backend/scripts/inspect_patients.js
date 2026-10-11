const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: 'backend/.env' });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const PatientProfile = require('../models/PatientProfile');
  const User = require('../models/User');
  const list = await PatientProfile.find().populate('userId');
  console.log('Found profiles:', list.length);
  list.forEach(p => {
    console.log(`QR: ${p.qrCodeId} | Name: ${p.userId?.name} | Email: ${p.userId?.email} | Loc: ${JSON.stringify(p.lastLocation)}`);
  });
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
