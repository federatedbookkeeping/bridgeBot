import { DataStore } from "./data.js";
import { getReplicas } from "./replicas.js";
import { sync } from "./sync.js";

async function run(): Promise<void> {
  const dataStore = new DataStore();
  await dataStore.load('./data.json');
  const replicas = await getReplicas(dataStore);
  // await sync(replicas[0]);
  await Promise.all(replicas.map(replica => sync(replica)));
  console.log(dataStore.items);
  // leave time for events to propagate to all replicas
  await new Promise(r => setTimeout(r, 1000));
  await dataStore.save('./data.json');
}

// ...
run();
