const { createServer } = require('http');
const port = process.env.PORT || 3000;
createServer((req, res) => {
  let body = '';
  req.on('data', function(data) {
    body += data;

    // Too much POST data, kill the connection!
    // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
    if (body.length > 1e6) {
      request.connection.destroy();
    }
  });
  req.on('end', function() {
    console.log(body);
  });

  res.end('{ "happy": true }');
}).listen(port);
console.log('listening on port', port);

