const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const https   = require('https');

const app    = express();
const upload = multer({ storage: multer.memoryStorage() });
const CONFIG_FILE = path.join(__dirname, 'config.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── File Matcher Config ───────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  file1Separator: '|',
  file1Fields: ['username', 'password', '2fa', 'email', 'pass_email'],
  file1EmailIndex: 3,
  file2Separator: '|',
  file2EmailIndex: 0,
  outputFormat: '|{username}|{password}|{2fa}|{email}|{pass_email}|'
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {}
  return { ...DEFAULT_CONFIG };
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

app.get('/config',  (req, res) => res.json(loadConfig()));
app.post('/config', (req, res) => {
  try { saveConfig({ ...DEFAULT_CONFIG, ...req.body }); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/process', upload.fields([{ name: 'file1', maxCount: 1 }, { name: 'file2', maxCount: 1 }]), (req, res) => {
  try {
    const cfg  = loadConfig();
    const sep1 = cfg.file1Separator || '|';
    const sep2 = cfg.file2Separator || '|';
    const emailIdx1 = parseInt(cfg.file1EmailIndex) || 0;
    const emailIdx2 = parseInt(cfg.file2EmailIndex) || 0;
    const fields    = cfg.file1Fields  || [];
    const outputFmt = cfg.outputFormat || '';

    const file1Lines = req.files['file1'][0].buffer.toString('utf8').split(/\r?\n/).filter(l => l.trim());
    const file2Lines = req.files['file2'][0].buffer.toString('utf8').split(/\r?\n/).filter(l => l.trim());

    const file1Map = {};
    for (const line of file1Lines) {
      const parts = line.split(sep1);
      const email = (parts[emailIdx1] || '').trim().toLowerCase();
      if (email) file1Map[email] = parts;
    }

    const file2Emails = new Set();
    for (const line of file2Lines) {
      const parts = line.split(sep2);
      const email = (parts[emailIdx2] || '').trim().toLowerCase();
      if (email) file2Emails.add(email);
    }

    const outputLines = [];
    for (const email of file2Emails) {
      if (file1Map[email]) {
        const parts = file1Map[email];
        let line = outputFmt;
        fields.forEach((fieldName, i) => {
          line = line.split(`{${fieldName}}`).join((parts[i] || '').trim());
        });
        parts.forEach((val, i) => { line = line.split(`{${i}}`).join(val.trim()); });
        outputLines.push(line);
      }
    }

    res.json({ success: true, output: outputLines.join('\n'),
      stats: { file1Total: file1Lines.length, file2Total: file2Lines.length, matched: outputLines.length }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Instagram Checker ────────────────────────────────────────────────────────
const IG_DELAY   = 1500;
const IG_TIMEOUT = 10000;

function checkInstagram(username) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'www.instagram.com',
      path: `/${username}/`,
      method: 'GET',
      timeout: IG_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; if (body.length > 5000) res.destroy(); });
      res.on('close', () => {
        const code = res.statusCode;
        if (code === 200) {
          const notFound = body.includes('Page Not Found') || body.includes('Sorry, this page') || body.includes('"LoginAndSignupPage"');
          if (notFound) return resolve({ username, status: 'NOT_FOUND', code });
          resolve({ username, status: 'LIVE', code,
            private:  body.includes('"is_private":true'),
            verified: body.includes('"is_verified":true')
          });
        } else if (code === 404)         resolve({ username, status: 'NOT_FOUND',    code });
        else if (code === 302 || code === 301) resolve({ username, status: 'REDIRECT', code });
        else if (code === 429)            resolve({ username, status: 'RATE_LIMITED', code });
        else                              resolve({ username, status: 'UNKNOWN',      code });
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ username, status: 'TIMEOUT', code: 0 }); });
    req.on('error',   e  => resolve({ username, status: 'ERROR',   code: 0, error: e.message }));
    req.end();
  });
}

// SSE: stream mỗi kết quả ngay khi xong
app.get('/check-instagram-stream', async (req, res) => {
  const raw = req.query.usernames || '';
  const usernames = raw.split(',').map(u => u.replace(/^@/, '').trim()).filter(Boolean);
  if (!usernames.length) { res.status(400).end(); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  send({ type: 'total', total: usernames.length });

  for (let i = 0; i < usernames.length; i++) {
    if (req.destroyed) break;
    const result = await checkInstagram(usernames[i]);
    send({ type: 'result', index: i, ...result });
    if (i < usernames.length - 1) await new Promise(r => setTimeout(r, IG_DELAY));
  }

  send({ type: 'done' });
  res.end();
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Toolbox running at http://localhost:${PORT}`));