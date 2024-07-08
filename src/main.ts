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

async function initialSync(): Promise<{ dataStore: DataStore, bridges: Bridge[] }> {
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
  console.log('starting');
  const dataStore = new DataStore('./data/store.json');
  const bridges = await buildBridges(CONFIG_FILE, dataStore);
  console.log('loading data store');
  await dataStore.load();
  console.log('loading all bridges');
  await Promise.all(bridges.map(bridge => bridge.load()));
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
  return { dataStore, bridges };
}

async function run() {
  const { dataStore, bridges } = await initialSync();
  runWebhook(dataStore, bridges);
}

// ...
run();

