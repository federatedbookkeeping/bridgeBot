const fsPromises = require("fs/promises");
import { DataStore } from "./data.js";
import { Bridge } from "./bridge.js";
import { GitHubClient } from "./client/github.js";
import { TikiClient } from "./client/tiki.js";
import { runWebhook } from "./server.js";

const CONFIG_FILE = 'config.json';

async function buildBridges(configFile: string, dataStore: DataStore): Promise<Bridge[]> {
  const buff = await fsPromises.readFile(configFile);
  const specs = JSON.parse(buff.toString());

  return specs.map(spec => {
    switch(spec.type) {
      case 'github':
        return new Bridge(new GitHubClient(spec), dataStore);
      case 'tiki':
        return new Bridge(new TikiClient(spec), dataStore);
      default:
        throw new Error('unknown replica type');
    }
  });
}

async function load(dataStore: DataStore, bridges: Bridge[]): Promise<void> {
  try {
    await fsPromises.mkdir('data');
  } catch {
  }
  try {
    await fsPromises.mkdir('data/client');
  } catch {
  }
  try {
    await fsPromises.mkdir('data/lri');
  } catch {
  }
  console.log('loading data store');
  await dataStore.load();
  console.log('loading all bridges');
  await Promise.all(bridges.map(bridge => bridge.load()));
}

async function initialSync(dataStore: DataStore, bridges: Bridge[]): Promise<void> {
  console.log('fetching all bridges');
  await Promise.all(bridges.map(bridge => bridge.fetchAll()));
  console.log('pushing all bridges');
  await Promise.all(bridges.map(bridge => bridge.pushAll()));
  console.log('saving all bridges');
  await Promise.all(bridges.map(bridge => bridge.save()));
  console.log('saving data store');
  // console.log(dataStore.items);
  await dataStore.save();
  console.log('initial sync done');
}

async function run() {
  console.log('starting');
  const dataStore = new DataStore('./data/store.json');
  const bridges = await buildBridges(CONFIG_FILE, dataStore);
  await load(dataStore, bridges);
  await initialSync(dataStore, bridges);
  runWebhook(bridges);
}

// ...
run();

