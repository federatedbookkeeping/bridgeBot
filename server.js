const { createServer } = require('http');
const port = process.env.PORT || 3000;
createServer((req, res) => {
  res.end('https://taskifier.heroku.com works');
}).listen(port);
console.log('listening on port', port);

