import { Bridge } from "./bridge";
import { WebhookEventType } from "./client/client";
import { DataStore } from "./data";

const { createServer } = require("http");
const port = process.env.PORT || 8000;
export function runWebhook(bridges: Bridge[]) {
  createServer((req, res) => {
    // console.log("processing", req.url, req.method, JSON.stringify(req.headers, null, 2));
    console.log("processing", req.url, req.method);
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
      const promises: Promise<void>[] = [];
      try {
        const data = JSON.parse(body);
        body = JSON.stringify(data, null, 2);
        // console.log("Body", body);
        const parts = req.url.split('/');
        if (parts.length >= 3) {
          let found = false;
          for (let i=0; i < bridges.length; i++) {
            // console.log('for loop i', i, parts, bridges[i].getType(), bridges[i].getName());
            if (parts[0] === '' && parts[1] === bridges[i].getType() && parts[2] === bridges[i].getName()) {
              console.log('bridge found!', parts[1], parts[2]);
              found = true;
              const parsed = bridges[i].processWebhook(data, parts.slice(3));
              switch (parsed.type) {
                case WebhookEventType.Created: {
                  console.log('webhook event parsed as creation', parsed.item);
                  for (let j=0; j < bridges.length; j++) {
                    console.log('for loop i j', i, j);
                    if (j !== i) {
                      console.log(`pushing creation from ${bridges[i].getName()} to ${bridges[j].getName()}`);
                      if (typeof parsed.item.identifier !== 'string' || parsed.item.identifier === '') {
                        throw new Error('cannot create item without identifier');
                      }
                  
                      promises.push(bridges[j].pushItem(parsed.item));
                    }
                  }
                }
                break;
                case WebhookEventType.Updated: {
                  console.log('webhook event parsed as update', parsed.item);
                }
                break;
                case WebhookEventType.Deleted: {
                  console.log('webhook event parsed as deletion', parsed.item);
                }
              }
            }
          }
          if (!found) {
            console.log('No tracker with matching name and type found in config', parts);
          }
        } else {
          console.log('Ignoring webhook call with less than 3 URl parts', parts);
        }
      } catch (e) {
        console.error('error while processing webhook!');
        throw e;
      }
      console.log('awaiting sync promises from webhook, start');
      await Promise.all(promises);
      console.log('awaiting sync promises from webhook, done');
      res.end('{ "happy": true }\n');
    });
  }).listen(port);
  console.log("listening on port", port);
}
