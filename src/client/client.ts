
const fsPromises = require("fs/promises");
import { GitHubClient } from "./github.js";
import { Item } from "../model/Item.js";

const CONFIG_FILE = 'config.json';
const CLIENT_DATA_ROOT = 'data/client';

async function getClientSpecs() {
  const buff = await fsPromises.readFile(CONFIG_FILE);
  return JSON.parse(buff.toString());
}
export async function getClients() {
  const specs = await getClientSpecs();
  const promises = specs.map(spec => {
    switch(spec.type) {
      case 'github':
        return new GitHubClient(spec);
      default:
        throw new Error('unknown replica type');
    }
  });
  return Promise.all(promises);
}

export class ClientSpec {
  name: string;
  type: string;
};

export abstract class Client {
  spec: ClientSpec; // overwritten in child classes
  constructor(spec: ClientSpec) {
    this.spec = spec;
  }
  getDirName() {
    return `${CLIENT_DATA_ROOT}/${this.spec.name}`;
  }
  getFilename(type: string, filter?: { issue: string }) {
    if (filter) {
      return `${this.getDirName()}/${type}-${filter.issue}.json`; 
    } else {
      return `${this.getDirName()}/${type}.json`; 
    }
  }
  async getItems(type: string, filter?: { issue: string }): Promise<any> {
    let items: Item[] = [];
    const filename = this.getFilename(type, filter);
    try {
      const buff = await fsPromises.readFile(filename);
      items = JSON.parse(buff.toString());
      console.log(`Loaded ${filename}`);
    } catch {
      console.log(`Failed to load ${filename}, fetching over network`);
      items = await this.getItemsOverNetwork(type);
      const dirname = this.getDirName();
      await fsPromises.mkdir(dirname);
      await fsPromises.writeFile(
        filename,
        JSON.stringify(items, null, 2) + "\n"
      );
      console.log(`Saved ${filename}`);
    }
    return items;
  }

  abstract getItemsOverNetwork(type: string): Promise<Item[]>;
  abstract createItem(type: string, fields: object, references: object): Promise<string>;
  abstract updateItem(type: string, id: string, fields: object, references: object): Promise<void>;
  abstract deleteItem(type: string, id: string): Promise<void>;
}