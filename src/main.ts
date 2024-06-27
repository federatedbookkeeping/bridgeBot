const fsPromises = require("fs/promises");
import { DataStore } from "./data.js";
import { sync } from "./sync.js";
import { GitHubClient } from "./client/github.js";
import { TikiClient } from "./client/tiki.js";

const CONFIG_FILE = 'config.json';
async function getClientSpecs() {
  const buff = await fsPromises.readFile(CONFIG_FILE);
  return JSON.parse(buff.toString());
}

async function getClients() {
  const specs = await getClientSpecs();
  const promises = specs.map(spec => {
    switch(spec.type) {
      case 'github':
        return new GitHubClient(spec);
      case 'tiki':
        return new TikiClient(spec);
      default:
        throw new Error('unknown replica type');
    }
  });
  return Promise.all(promises);
}

async function run(): Promise<void> {
  const dataStore = new DataStore();
  await dataStore.load('./data/store.json');
  const replicas = await getClients();
  // await sync(replicas[0]);
  await Promise.all(replicas.map(client => sync(client, dataStore)));
  console.log(dataStore.items);
  // leave time for events to propagate to all replicas
  await new Promise(r => setTimeout(r, 1000));
  await dataStore.save('./data/store.json');
}

// ...
run();
