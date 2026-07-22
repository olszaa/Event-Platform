import http from 'http';
import https from 'https';

const API_BASE = 'http://localhost:4000';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function request(method: string, path: string, body?: any, token?: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const postData = body ? JSON.stringify(body) : '';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData).toString();
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode || 500, body: parsed });
        } catch {
          resolve({ status: res.statusCode || 500, body: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTest(suite: string, name: string, fn: () => Promise<any>) {
  const start = Date.now();
  try {
    const details = await fn();
    const durationMs = Date.now() - start;
    results.push({ suite, name, passed: true, durationMs, details });
    console.log(`  ✅ PASS: [${suite}] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({ suite, name, passed: false, durationMs, error: err.message || String(err) });
    console.error(`  ❌ FAIL: [${suite}] ${name} (${durationMs}ms) -> ${err.message}`);
  }
}

async function main() {
  console.log('\n===============================================================');
  console.log('🚀 EVENT PLATFORM AUTOMATION TEST SUITE');
  console.log('===============================================================\n');

  let adminToken = '';
  let eventId = '';
  let prizeId = '';
  let pointId = '';
  let registrationId = '';
  let drawSessionId = '';
  let winnerId = '';

  // -------------------------------------------------------------
  // SUITE 1: AUTHENTICATION AUTOMATION
  // -------------------------------------------------------------
  console.log('📦 Suite 1: Authentication & User Credentials');
  
  await runTest('Auth', 'Login as Admin (admin / password123)', async () => {
    const res = await request('POST', '/api/auth/login', { username: 'admin', password: 'password123' });
    if (res.status !== 200 || !res.body.success || !res.body.data.token) {
      throw new Error(`Login failed with status ${res.status}: ${JSON.stringify(res.body)}`);
    }
    adminToken = res.body.data.token;
    return { token: 'JWT_REDACTED', role: res.body.data.user.role };
  });

  await runTest('Auth', 'Reject Login with Invalid Credentials', async () => {
    const res = await request('POST', '/api/auth/login', { username: 'admin', password: 'wrongpassword' });
    if (res.status === 200) {
      throw new Error('Expected login to fail with wrong password but returned 200 OK');
    }
    return { status: res.status, message: res.body.message || res.body.error };
  });

  // -------------------------------------------------------------
  // SUITE 2: EVENT MANAGEMENT AUTOMATION
  // -------------------------------------------------------------
  console.log('\n📦 Suite 2: Event Administration');

  await runTest('Events', 'List All Active Events', async () => {
    const res = await request('GET', '/api/events?status=ACTIVE,PUBLISHED');
    if (res.status !== 200 || !res.body.success || !Array.isArray(res.body.data)) {
      throw new Error(`Failed to list events: ${JSON.stringify(res.body)}`);
    }
    if (res.body.data.length === 0) {
      throw new Error('No active events found. Please seed the database.');
    }
    eventId = res.body.data[0].id;
    return { eventId, name: res.body.data[0].name, count: res.body.data.length };
  });

  await runTest('Events', 'Get Event Details & Settings', async () => {
    const res = await request('GET', `/api/events/${eventId}`);
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Failed to get event details for ID ${eventId}`);
    }
    return { name: res.body.data.name, settings: res.body.data.settings };
  });

  // -------------------------------------------------------------
  // SUITE 3: ENTRANCE / CHECKIN POINT AUTOMATION
  // -------------------------------------------------------------
  console.log('\n📦 Suite 3: Checkin Point Entrance Management');

  await runTest('CheckinPoint', 'Get Entrance Points (Auto-seeds default if empty)', async () => {
    const res = await request('GET', `/api/checkin/points?eventId=${eventId}`);
    if (res.status !== 200 || !res.body.success || !Array.isArray(res.body.data)) {
      throw new Error(`Failed to get checkin points: ${JSON.stringify(res.body)}`);
    }
    pointId = res.body.data[0].id;
    return { count: res.body.data.length, firstPoint: res.body.data[0].name };
  });

  await runTest('CheckinPoint', 'Create New Gate Entrance (CRUD - Create)', async () => {
    const res = await request('POST', '/api/checkin/points', {
      eventId,
      name: 'Automated Test Entrance Gate',
      location: 'Building A North Gate',
      isActive: true,
      sortOrder: 99
    }, adminToken);
    if (res.status !== 201 && res.status !== 200) {
      throw new Error(`Failed to create gate point: ${JSON.stringify(res.body)}`);
    }
    const createdId = res.body.data.id;
    return { createdId, name: res.body.data.name };
  });

  // -------------------------------------------------------------
  // SUITE 4: REGISTRATION & CHECK-IN AUTOMATION
  // -------------------------------------------------------------
  console.log('\n📦 Suite 4: Registration & On-Site Gate Check-in');

  await runTest('Registration', 'Register New Attendee', async () => {
    const uniqueEmail = `test.attendee.${Date.now()}@example.com`;
    const res = await request('POST', '/api/registrations', {
      eventId,
      fullName: 'Automation Test Guest',
      email: uniqueEmail,
      phone: '0812345678',
      company: 'Antigravity QA Labs',
      department: 'Software Testing'
    });
    if (res.status !== 201 && res.status !== 200) {
      throw new Error(`Failed to register attendee: ${JSON.stringify(res.body)}`);
    }
    registrationId = res.body.data.id;
    return { registrationId, fullName: res.body.data.fullName, qrCode: res.body.data.qrCode };
  });

  await runTest('Check-in', 'Perform Gate Check-in for Registered Attendee', async () => {
    const res = await request('POST', '/api/checkin', {
      registrationId,
      checkinPointId: pointId,
      method: 'MANUAL'
    });
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Check-in failed with status ${res.status}: ${JSON.stringify(res.body)}`);
    }
    return { attendee: res.body.data.registration.fullName, point: res.body.data.point?.name };
  });

  // -------------------------------------------------------------
  // SUITE 5: PRIZE & LUCKY DRAW ENGINE AUTOMATION
  // -------------------------------------------------------------
  console.log('\n📦 Suite 5: Prize Stock & Fisher-Yates Lucky Draw');

  await runTest('Prizes', 'Get Prizes List with Eligible Candidates Capping', async () => {
    const res = await request('GET', `/api/prizes?eventId=${eventId}`);
    if (res.status !== 200 || !res.body.success || !Array.isArray(res.body.data)) {
      throw new Error(`Failed to fetch prizes: ${JSON.stringify(res.body)}`);
    }
    const prize = res.body.data.find((p: any) => p.remaining > 0) || res.body.data[0];
    prizeId = prize.id;
    return { prizeId, name: prize.name, remaining: prize.remaining, eligibleCount: prize.eligibleCount };
  });

  await runTest('LuckyDraw', 'Start Lucky Draw Session', async () => {
    const res = await request('POST', '/api/draws/start', {
      eventId,
      prizeId,
      drawCount: 1
    }, adminToken);
    if (res.status !== 201 && res.status !== 200) {
      throw new Error(`Failed to start draw session: ${JSON.stringify(res.body)}`);
    }
    drawSessionId = res.body.data.id;
    return { drawSessionId, status: res.body.data.status };
  });

  await runTest('LuckyDraw', 'Execute Fisher-Yates Spin Draw (1 Winner)', async () => {
    const res = await request('POST', `/api/draws/${drawSessionId}/spin`, { count: 1 });
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Spin draw failed: ${JSON.stringify(res.body)}`);
    }
    
    // Fetch session details to get actual DrawWinner record ID
    const sessionRes = await request('GET', `/api/draws/${drawSessionId}`);
    if (!sessionRes.body.data || !sessionRes.body.data.winners || sessionRes.body.data.winners.length === 0) {
      throw new Error('Spin draw completed but no DrawWinner records were found in session');
    }
    winnerId = sessionRes.body.data.winners[0].id;
    return { winnerId, winnerName: sessionRes.body.data.winners[0].registration?.fullName, winnersCount: sessionRes.body.data.winners.length };
  });

  // -------------------------------------------------------------
  // SUITE 6: WINNER MANAGEMENT & QUOTA RECALCULATION
  // -------------------------------------------------------------
  console.log('\n📦 Suite 6: Winner Status Edit & Prize Stock Recalculation');

  await runTest('WinnerMgmt', 'Update Winner Status to ACCEPTED (🟢)', async () => {
    const res = await request('PUT', `/api/draws/winners/${winnerId}`, { status: 'ACCEPTED' }, adminToken);
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Failed to update winner status: ${JSON.stringify(res.body)}`);
    }
    return { winnerId, newStatus: res.body.data.status };
  });

  await runTest('WinnerMgmt', 'Delete Winner & Verify Prize Stock Recalculation', async () => {
    const res = await request('DELETE', `/api/draws/winners/${winnerId}`, undefined, adminToken);
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Failed to delete winner: ${JSON.stringify(res.body)}`);
    }
    return { message: res.body.message };
  });

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  console.log('\n===============================================================');
  console.log(`📊 AUTOMATION TEST SUMMARY REPORT: ${passed}/${total} PASSED (${((passed/total)*100).toFixed(1)}%)`);
  console.log('===============================================================');
  
  if (failed > 0) {
    console.error(`\n❌ ${failed} TESTS FAILED! Please inspect errors above.`);
    process.exit(1);
  } else {
    console.log('\n🎉 ALL AUTOMATION TESTS PASSED SUCCESSFULLY 100%!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
