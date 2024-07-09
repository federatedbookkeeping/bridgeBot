const fsPromises = require("fs/promises");
import { Item } from "../model/Item.js";

const ORI_HINT_PREFIX = `<!-- BridgeBot copy of `;
const ORI_HINT_SUFFIX = ` -->\n`;
const CLIENT_DATA_ROOT = 'data/client';

export enum WebhookEventType {
  Created,
  Updated,
  Deleted
}

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
  abstract getType(): string;
  abstract getName(): string;
  abstract parseWebhookData(data: object, urlParts: string[]): { type: WebhookEventType, item: FetchedItem };
  abstract getItems(type: string, filter?: { issue: string }): Promise<any>;
  abstract createItem(item: Item): Promise<string>;
  abstract updateItem(type: string, id: string, fields: object, references: object): Promise<void>;
  abstract deleteItem(type: string, id: string): Promise<void>;
  abstract getOriHint(body: string | null): string | null;
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

  ensureOriHint(body: string, ori: string) {
    const hint = ORI_HINT_PREFIX + ori + ORI_HINT_SUFFIX;
    if (body.startsWith(hint)) {
      return body;
    }
    return hint + body;
  }
  parseOriHint(body: string | null): { hint: string | null; rest: string } {
    if (body === null) {
      return { hint: null, rest: "" };
    }
    if (!body.startsWith(ORI_HINT_PREFIX)) {
      console.log("ORI Hint Prefix not found", body);
      return { hint: null, rest: body };
    }
    const rest = body.substring(ORI_HINT_PREFIX.length);
    const start = rest.indexOf(ORI_HINT_SUFFIX);
    if (start === -1) {
      console.log(
        `ORI Hint Suffix not found in body "${body.substring(0, 100)}..."`
      );
      return { hint: null, rest: body };
    }
    const result = rest.substring(0, start);
    console.log("Parsed ORI Hint", result, body);
    return {
      hint: result,
      rest: rest.substring(start + ORI_HINT_PREFIX.length),
    };
  }
  getOriHint(body: string | null): string | null {
    const parsed = this.parseOriHint(body);
    return parsed.hint;
  }
  removeOriHint(body: string | null): string {
    const parsed = this.parseOriHint(body);
    return parsed.rest;
  }
}