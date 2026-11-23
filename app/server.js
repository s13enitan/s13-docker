const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.env.PORT) || 8080;
const publicDir = '/app/public';
const storeFile = '/data/store.json';
const jwtSecret = 's13-student-demo-jwt-secret';
const courses = [
  { id: 'software', title: 'Software Engineering', track: 'Engineering', level: 'Beginner', duration: '8 weeks', schedule: 'Mon + Wed', description: 'Build modern web applications with clean code, APIs, testing, and team workflows.', skills: ['JavaScript', 'APIs', 'Testing'] },
  { id: 'devops', title: 'DevOps & Cloud', track: 'Cloud', level: 'Intermediate', duration: '8 weeks', schedule: 'Tue + Thu', description: 'Ship software safely using containers, CI/CD pipelines, cloud platforms, and observable systems.', skills: ['Docker', 'AWS', 'CI/CD'] },
  { id: 'data', title: 'Data & AI', track: 'Data', level: 'Beginner', duration: '6 weeks', schedule: 'Tue + Thu', description: 'Turn raw information into dependable pipelines, useful models, and clear data products.', skills: ['Python', 'SQL', 'AI foundations'] },
  { id: 'security', title: 'Cyber Defense', track: 'Security', level: 'Intermediate', duration: '7 weeks', schedule: 'Saturday', description: 'Practice system hardening, threat detection, and incident response in guided labs.', skills: ['Hardening', 'SIEM', 'Response'] }
];

const readStore = () => {
  try { return JSON.parse(fs.readFileSync(storeFile, 'utf8')); }
  catch { return { users: [], enrollments: [] }; }
};
const writeStore = (store) => fs.writeFileSync(storeFile, JSON.stringify(store, null, 2));
const json = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
};
const requestBody = (req) => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; if (raw.length > 20_000) reject(new Error('Request too large')); });
  req.on('end', () => { try { resolve(JSON.parse(raw)); } catch (error) { reject(error); } });
});
const hashPassword = (password) => new Promise((resolve, reject) => {
  const salt = crypto.randomBytes(16).toString('hex');
  crypto.scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(`${salt}:${key.toString('hex')}`));
});
const verifyPassword = (password, stored) => new Promise((resolve, reject) => {
  const [salt, expected] = stored.split(':');
  crypto.scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(crypto.timingSafeEqual(key, Buffer.from(expected, 'hex'))));
});
const tokenFor = (user) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: user.id, name: user.name, email: user.email, exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');
  const signature = crypto.createHmac('sha256', jwtSecret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
};
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const serveStatic = (urlPath, res) => {
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const file = path.resolve(publicDir, `.${requested}`);
  if (!file.startsWith(`${publicDir}${path.sep}`)) return json(res, 403, { error: 'Forbidden' });
  fs.readFile(file, (error, data) => {
    if (error) return json(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/health') return json(res, 200, { status: 'healthy', container: 's13-training-camps' });
    if (req.method === 'GET' && url.pathname === '/api/courses') return json(res, 200, courses);
    if (req.method === 'POST' && url.pathname === '/api/auth/register') {
      const input = await requestBody(req);
      if (!input.name || !input.email || !input.password || input.password.length < 8) return json(res, 400, { error: 'Name, email, and an 8+ character password are required.' });
      const store = readStore();
      const email = input.email.trim().toLowerCase();
      if (store.users.some((user) => user.email === email)) return json(res, 409, { error: 'Account already exists.' });
      const user = { id: crypto.randomUUID(), name: input.name.trim(), email, passwordHash: await hashPassword(input.password) };
      store.users.push(user); writeStore(store);
      return json(res, 201, { token: tokenFor(user), user: { id: user.id, name: user.name, email: user.email } });
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const input = await requestBody(req); const store = readStore();
      const user = store.users.find((item) => item.email === String(input.email || '').trim().toLowerCase());
      if (!user || !await verifyPassword(input.password || '', user.passwordHash)) return json(res, 401, { error: 'Incorrect email or password.' });
      return json(res, 200, { token: tokenFor(user), user: { id: user.id, name: user.name, email: user.email } });
    }
    if (req.method === 'POST' && url.pathname === '/api/enrollments') {
      const input = await requestBody(req);
      if (!input.name || !input.email || !courses.some((course) => course.id === input.courseId)) return json(res, 400, { error: 'Name, email, and a valid course are required.' });
      const store = readStore();
      const enrollment = { id: crypto.randomUUID(), name: input.name.trim(), email: input.email.trim().toLowerCase(), courseId: input.courseId, experience: input.experience || 'New to the field', createdAt: new Date().toISOString() };
      store.enrollments.push(enrollment); writeStore(store);
      return json(res, 201, { id: enrollment.id, message: 'Application received. Welcome to the next step.' });
    }
    if (req.method === 'GET') return serveStatic(url.pathname, res);
    json(res, 404, { error: 'Not found' });
  } catch { json(res, 400, { error: 'Invalid request.' }); }
}).listen(port, '0.0.0.0', () => console.log(`S13 app listening on ${port}`));
