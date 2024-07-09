const { createServer } = require("http");
const port = process.env.PORT || 8000;
function runWebhook() {
  createServer((req, res) => {
    console.log("processing", req.url, req.method, JSON.stringify(req.headers));
    let body = "";
    req.on("data", function (data) {
      body += data;

      // Too much POST data, kill the connection!
      // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
      if (body.length > 1e6) {
        req.connection.destroy();
      }
    });
    req.on("end", async function () {
      console.log(req.url, body);
      res.end('{ "happy": true }\n');
    });
  }).listen(port);
  console.log("listening on port", port);
}

// ...
runWebhook();