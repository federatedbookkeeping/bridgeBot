const fsPromises = require("fs/promises");
import { DataStore } from "./data.js";
import { Bridge } from "./bridge.js";
import { GitHubClient } from "./client/github.js";
import { TikiClient } from "./client/tiki.js";
import { runWebhook } from "./server.js";
import { Client, FetchedComment, FetchedIssue, FetchedItem } from "./client/client.js";
import { Issue } from "./model/issue.js";

const CONFIG_FILE = 'config.json';

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
  for (let i = 0; i < clients.length; i++) {
    console.log(`Checking client ${i}`, clients[i].getType(), clients[i].getName());
    const issues = await clients[i].getItems('issue');
    for (let j = 0; j < issues.length; j++) {
      checkFetchedItem('issue', issues[j]);
    }
  }
  console.log('Checks completed');
}

// ...
run();

