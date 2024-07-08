import { Bridge } from "./bridge";
import { DataStore } from "./data";

const { createServer } = require("http");
const port = process.env.PORT || 8000;
export function runWebhook(dataStore: DataStore, bridges: Bridge[]) {
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
    req.on("end", function () {
      try {
        body = JSON.stringify(JSON.parse(body), null, 2);
        switch (req.url) {
          case "/github/upstream":
            console.log();
        }
      } catch (e) {}
      console.log("Body", body);
      res.end('{ "happy": true }\n');
    });
  }).listen(port);
  console.log("listening on port", port);
}
