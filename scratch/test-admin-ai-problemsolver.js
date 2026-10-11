const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) { json = body; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTest() {
  console.log('--- 🧪 STARTING ADMIN AI PROBLEM ANALYSIS INTEGRATION TEST ---');

  // Step 1: Admin Login
  console.log('\n[TEST 1] Logging in as Admin...');
  const loginRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@lifeqr.com', password: 'Password@123' });

  if (loginRes.status !== 200) {
    throw new Error(`Admin login failed: ${JSON.stringify(loginRes.body)}`);
  }
  const setCookie = loginRes.headers['set-cookie'];
  const cookie = Array.isArray(setCookie) ? setCookie.map(c => c.split(';')[0]).join('; ') : '';
  console.log('✅ Admin authenticated successfully.');

  // Step 2: Create a Help Ticket matching the user screenshot
  console.log('\n[TEST 2] Creating Help Ticket: "Emergency Medication Override Confirmation Needed"...');
  const createTicketRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/help-tickets',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    }
  }, {
    subject: 'Emergency Medication Override Confirmation Needed',
    message: 'Patient presenting with acute anaphylaxis requires epinephrine dosing override in offline triage zone.',
    category: 'EMERGENCY_OVERRIDE',
    priority: 'CRITICAL',
    patientQrCodeId: 'RAH-D3200470'
  });

  if (createTicketRes.status !== 201) {
    throw new Error(`Ticket creation failed: ${JSON.stringify(createTicketRes.body)}`);
  }
  const ticket = createTicketRes.body.ticket;
  console.log(`✅ Ticket created successfully: ${ticket.ticketId}`);

  // Step 3: Run AI Problem Analysis on Ticket
  console.log('\n[TEST 3] Running AI Problem Analysis for Ticket...');
  const aiRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/admin/ai-problem-analysis',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    }
  }, {
    ticketId: ticket.ticketId,
    subject: ticket.subject,
    message: ticket.message,
    requesterName: 'Dr. Amit Sharma',
    requesterRole: 'doctor',
    patientQrCodeId: 'RAH-D3200470',
    priority: 'CRITICAL',
    category: 'EMERGENCY_OVERRIDE'
  });

  if (aiRes.status !== 200 || !aiRes.body.success) {
    throw new Error(`AI Analysis failed: ${JSON.stringify(aiRes.body)}`);
  }
  const a = aiRes.body.analysis;
  console.log('✅ AI Problem Analysis Output Received:');
  console.log('   - 1. In Simple Words:', a.problemInSimpleWords);
  console.log('   - 2. What To Solve:', a.whatToSolve);
  console.log('   - 3. Root Cause:', a.rootCause);
  console.log('   - 4. Step-by-Step Instructions:');
  (a.stepByStepSolution || []).forEach(s => {
    console.log(`        Step ${s.step}: [${s.title}] -> ${s.instruction}`);
  });
  console.log('   - 5. Suggested Note:', a.suggestedResolutionNote);

  if (!a.problemInSimpleWords || !a.whatToSolve || !a.stepByStepSolution || a.stepByStepSolution.length === 0) {
    throw new Error('AI Analysis missing required step-by-step fields');
  }

  // Step 4: Resolve Ticket with AI Suggested Note
  console.log('\n[TEST 4] Applying AI Resolution Note & Updating Ticket Status...');
  const updateRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/v1/admin/help-tickets/${ticket.ticketId}/status`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    }
  }, {
    status: 'RESOLVED',
    adminNotes: a.suggestedResolutionNote
  });

  if (updateRes.status !== 200) {
    throw new Error(`Ticket status update failed: ${JSON.stringify(updateRes.body)}`);
  }
  console.log(`✅ Ticket ${ticket.ticketId} successfully marked as RESOLVED with AI note.`);

  // Step 5: Test God Mode Custom Problem Analysis (e.g. Scratched QR Code)
  console.log('\n[TEST 5] Testing God Mode AI Custom Problem Diagnostics...');
  const customAiRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/admin/ai-problem-analysis',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    }
  }, {
    subject: 'Emergency badge scratched and camera scanner says unreadable',
    message: 'Paramedic team unable to scan QR code on patient wristband during transport.',
    requesterRole: 'crew',
    patientQrCodeId: 'RAH-D3200470'
  });

  if (customAiRes.status !== 200 || !customAiRes.body.success) {
    throw new Error(`Custom AI analysis failed: ${JSON.stringify(customAiRes.body)}`);
  }
  const ca = customAiRes.body.analysis;
  console.log('✅ Custom AI Diagnosis Successful:');
  console.log('   - In Simple Words:', ca.problemInSimpleWords);
  console.log('   - What to Solve:', ca.whatToSolve);
  console.log('   - Step 1:', ca.stepByStepSolution[0]?.instruction);
  console.log('   - Step 2:', ca.stepByStepSolution[1]?.instruction);

  console.log('\n🎉 ALL 5 INTEGRATION TEST CASES PASSED WITH 100% SUCCESS!');
}

runTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
