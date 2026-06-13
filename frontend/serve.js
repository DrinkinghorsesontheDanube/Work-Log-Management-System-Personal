const http = require('http');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'dist');
const port = 4173;
const mimes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  let p = req.url === '/' ? '/index.html' : req.url;
  p = path.join(dir, p.split('?')[0]);
  fs.readFile(p, (err, data) => {
    if (err) {
      fs.readFile(path.join(dir, 'index.html'), (e, d) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(d);
      });
      return;
    }
    const ext = path.extname(p);
    res.writeHead(200, { 'Content-Type': mimes[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => {
  console.log('Server running at http://localhost:' + port);
});
