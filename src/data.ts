const fsPromises = require("fs/promises");
import { Item } from "./model/Item";

export type OperationType = 'upsert' | 'merge' | 'fork';
export type ObjectType = 'issue' | 'worked' | 'comment';

export type Operation = {
  operationType: OperationType,
  fields: Partial<Item>,
  origin?: string,
};

export class DataStore {
  filename: string
  items: { [type: string]: {
    [ori: string]: Item }
   } = {
    issue: {},
    comment: {}
  };
  constructor(filename: string) {
    this.filename = filename;
  }
  add(item: Item) {
    this.items[item.type][item.identifier] = item;
  }
  getItem(type: string, identifier: string) {
    return this.items[type][identifier];
  }
  getAllItemsOfType(type: string) {
    return Object.values(this.items[type]);
  }
  async load() {
    try {
      const buff = await fsPromises.readFile(this.filename);
      this.items = JSON.parse(buff.toString());
      // console.log(`Loaded ${this.filename}`);
    } catch {
      // console.log(`Failed to load ${this.filename}`);
    }
  }
  async save() {
    await fsPromises.writeFile(this.filename, JSON.stringify(this.items, null, 2) + "\n");
    // console.log(`Saved ${this.filename}`);
  }
}
