const fsPromises = require("fs/promises");
import { GitHubClient } from "./client/github.js";
import { TikiClient } from "./client/tiki.js";
import { Client, FetchedComment, FetchedIssue, FetchedItem } from "./client/client.js";
const { createServer, Server } = require("http");

const port = process.env.PORT || 8000;
const CONFIG_FILE = 'config.json';

function runWebhook(cb: (url: string, body: string) => void): typeof Server {
  const server = createServer((req, res) => {
    // console.log("processing", req.url, req.method, JSON.stringify(req.headers));
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
      cb(req.url, body);
      res.end('{ "happy": true }\n');
    });
  }).listen(port);
  console.log("listening on port", port);
  return server;
}

async function buildClients(configFile: string): Promise<Client[]> {
  const buff = await fsPromises.readFile(configFile);
  const specs = JSON.parse(buff.toString());

  return specs.map(spec => {
    switch(spec.type) {
      case 'github':
        return new GitHubClient(spec);
      case 'tiki':
        return new TikiClient(spec);
      default:
        throw new Error('unknown replica type');
    }
  });
}
function checkFetchedItem(declaredType: string, fetchedItem: FetchedItem) {
  // export type FetchedItem = {
  //   type: string,
  //   localIdentifier: string,
  //   mintedIdentifier: string | null,
  //   hintedIdentifier: string | null,
  //   fields: object,
  //   localReferences: object
  // }
  if (fetchedItem.type !== declaredType) { console.error(`item does not have type ${declaredType}`, fetchedItem); }
  if (typeof fetchedItem.localIdentifier !== 'string') { console.error('issue has no local identifier', fetchedItem); }
  if (typeof fetchedItem.mintedIdentifier !== 'string' && fetchedItem.mintedIdentifier !== null) { console.error('issue has no minted identifier', fetchedItem); }
  if (typeof fetchedItem.hintedIdentifier !== 'string' && fetchedItem.hintedIdentifier !== null) { console.error('issue has no hinted identifier', fetchedItem); }
  if (typeof fetchedItem.fields !== 'object') { console.error('issue has no fields', fetchedItem); }
  if (declaredType === 'issue') {
    const fetchedIssue = fetchedItem as FetchedIssue;
    if (typeof fetchedIssue.fields.title !== 'string') { console.error('issue has no title', fetchedItem); }
    if (typeof fetchedIssue.fields.body !== 'string') { console.error('issue has no body', fetchedItem); }
    if (typeof fetchedIssue.fields.completed !== 'boolean') { console.error('issue has no completed', fetchedItem); }
    if (typeof fetchedIssue.localReferences !== 'object') { console.error('issue has no references', fetchedItem); }
  }
  if (declaredType === 'comment') {
    const fetchedComment = fetchedItem as FetchedComment;
    if (typeof fetchedComment.fields.body !== 'string') { console.error('issue has no body', fetchedItem); }
    if (typeof fetchedComment.localReferences !== 'object') { console.error('issue has no references', fetchedItem); }
    if (typeof fetchedComment.localReferences.issue !== 'string') { console.error('comment has no reference to issue', fetchedItem); }
  }
}
async function run() {
  console.log('starting');
  const clients = await buildClients(CONFIG_FILE);
  const callbacks: { [index: number]: (value: unknown) => void } = {};
  const server = runWebhook((url: string, body: string) => {
    try {
      const data = JSON.parse(body);
      body = JSON.stringify(data, null, 2);
      // console.log("Body", body);
      const parts = url.split('/');
      if (parts.length >= 3) {
        let found = false;
        for (let i=0; i < clients.length; i++) {
          if (parts[0] === '' && parts[1] === clients[i].getType() && parts[2] === clients[i].getName()) {
            // console.log('bridge found!', parts[1], parts[2]);
            found = true;
            const parsed = clients[i].parseWebhookData(data, parts.slice(3));
            if (parsed.item.hintedIdentifier === null) {
              console.log('parsed item hinted identifier is null in webhook callback', parsed);
            } else if (typeof callbacks[parsed.item.hintedIdentifier] === 'function') {
              callbacks[parsed.item.hintedIdentifier](parsed);
            } else {
              console.error('unexpected item in webhook', parsed, Object.keys(callbacks), parsed.item.hintedIdentifier, typeof callbacks[parsed.item.hintedIdentifier]);
            }
            // console.log(parsed);
          }
        }
      }
    } catch (e) {
      console.error('error processing webhook', url, body);
      throw e;
    }
  });
  for (let i = 0; i < clients.length; i++) {
    console.log(`Checking client ${i}`, clients[i].getType(), clients[i].getName());
    const issues = await clients[i].getItems('issue');
    for (let j = 0; j < issues.length; j++) {
      checkFetchedItem('issue', issues[j]);
      const comments = await clients[i].getItems('comment', { issue: issues[j].localIdentifier });
      for (let j = 0; j < comments.length; j++) {
        checkFetchedItem('comment', comments[j]);
      }
      const timestamp = Date.now();
      const issueId = `issue-identifier-${i}-${timestamp}`;
      const title = `issue-title-${i}-${timestamp}`;
      const body = `issue-body-${i}-${timestamp}`;
      const promise = new Promise(cb => {
        console.log('waiting for webhook', issueId);
        callbacks[issueId] = cb;
      });
      const local = await clients[i].createItem({
        type: 'issue',
        identifier: issueId,
        deleted: false,
        fields: {
          title,
          body,
          completed: false
        },
        references: {}
      });
      const loopback = await promise;
      console.log('webhook received', local, loopback);
    }
  }
  console.log('Checks completed, closing webhook server...');
  server.closeAllConnections();
  server.close();
  console.log('Done');
}

// ...
run();

