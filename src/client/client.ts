const fsPromises = require("fs/promises");
import { Item } from "../model/Item.js";

const CLIENT_DATA_ROOT = 'data/client';

export type FetchedItem = {
  type: string,
  localIdentifier: string,
  mintedIdentifier: string | null,
  hintedIdentifier: string | null,
  fields: object,
  localReferences: object
}

export type ClientSpec = {
  name: string;
  type: string;
};

export abstract class Client {
  abstract getName(): string;
  abstract getItems(type: string, filter?: { issue: string }): Promise<any>;
  abstract createItem(item: Item): Promise<string>;
  abstract updateItem(type: string, id: string, fields: object, references: object): Promise<void>;
  abstract deleteItem(type: string, id: string): Promise<void>;
}

export abstract class FetchCachingClient extends Client {
  spec: ClientSpec; // overwritten in child classes
  constructor(spec: ClientSpec) {
    super();
    this.spec = spec;
  }
  getName() {
    return this.spec.name;
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
    // console.log('Client#getItems', type, filter);
    let itemsResponse: object;
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
  abstract translateItemsResponse(itemsResponse: object, type: string): FetchedItem[];
  abstract getItemsOverNetwork(type: string, filter?: { issue: string }): Promise<object>;
}