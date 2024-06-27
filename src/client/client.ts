const fsPromises = require("fs/promises");
import { Item } from "../model/Item.js";

const CLIENT_DATA_ROOT = 'data/client';

export type ClientSpec = {
  name: string;
  type: string;
};

export class Client {
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
    console.log('Client#getItems', type, filter);
    let itemsResponse: Item[] = [];
    const filename = this.getFilename(type, filter);
    try {
      const buff = await fsPromises.readFile(filename);
      itemsResponse = JSON.parse(buff.toString());
      console.log(`Loaded ${filename}`);
    } catch {
      console.log(`Failed to load ${filename}, fetching over network`);
      itemsResponse = await this.getItemsOverNetwork(type, filter);
      const dirname = this.getDirName();
      try {
        await fsPromises.mkdir(dirname);
      } catch {
      }
      await fsPromises.writeFile(
        filename,
        JSON.stringify(itemsResponse, null, 2) + "\n"
      );
      console.log(`Saved ${filename}`);
    }
    return this.translateItemsResponse(itemsResponse, type);
  }
  translateItemsResponse(itemsResponse: object, type: string): Item[] {
    return [];
  }

  async getItemsOverNetwork(type: string, filter?: { issue: string }): Promise<Item[]> { return []; }
  async createItem(type: string, fields: object, references: object): Promise<string> { return ''; }
  async updateItem(type: string, id: string, fields: object, references: object): Promise<void> {}
  async deleteItem(type: string, id: string): Promise<void> {}
}