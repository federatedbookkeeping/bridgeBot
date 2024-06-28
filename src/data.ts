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
  items: { [ori: string]: Item } = {};
  constructor(filename: string) {
    this.filename = filename;
  }
  add(item) {
    this.items[item.identifier] = item;
  }
  getItem(type: string, identifier: string) {
    return this.items[identifier];
  }
  getAllItemsOfType(type: string) {
    const result: Item[] = [];
    for (const item of Object.values(this.items)) {
      if (item.type === type) {
        result.push(item);
      }
    }
    return result;
  }
  async load() {
    try {
      const buff = await fsPromises.readFile(this.filename);
      this.items = JSON.parse(buff.toString());
      console.log(`Loaded ${this.filename}`);
    } catch {
      console.log(`Failed to load ${this.filename}`);
    }
  }
  async save() {
    await fsPromises.writeFile(this.filename, JSON.stringify(this.items, null, 2) + "\n");
    console.log(`Saved ${this.filename}`);
  }
}
