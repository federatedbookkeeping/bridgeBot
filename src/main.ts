const fsPromises = require("fs/promises");
import { DataStore } from "./data.js";
import { Bridge } from "./bridge.js";
import { GitHubClient } from "./client/github.js";
import { TikiClient } from "./client/tiki.js";

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

async function run(): Promise<void> {
  const dataStore = new DataStore();
  const bridges = await buildBridges(CONFIG_FILE, dataStore);
  await dataStore.load('./data/store.json');
  
  await Promise.all(bridges.map(bridge => bridge.sync()));
  console.log(dataStore.items);
  await dataStore.save('./data/store.json');
}

// ...
run();
