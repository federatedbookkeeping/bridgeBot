const fsPromises = require("fs/promises");
import { v4 as uuid } from "uuid";

export class LriMap {
  filename: string;
  map: {
    toLocal: {
      [universal: string]: string;
    };
    toUniversal: {
      [local: string]: string;
    };
  };
  constructor(filename: string) {
    this.filename = filename;
  }
  toLocal(universal: string) {
    return this.map.toLocal[universal];
  }
  toUniversal(local: string) {
    if (typeof this.map.toUniversal[local] === "undefined") {
      const universal = uuid();
      console.log(
        `Have not seen local identifier "${local} before, assigning "${universal}`
      );
      this.map.toUniversal[local] = universal;
      this.map.toLocal[universal] = local;
    }
    return this.map.toUniversal[local];
  }
  addMapping(identifiers: { local: string; universal: string }) {
    const { local, universal } = identifiers;
    if (typeof this.map.toLocal[universal] !== "undefined") {
      throw new Error("mapping already exists!");
    }
    if (typeof this.map.toUniversal[local] !== "undefined") {
      throw new Error("mapping already exists!");
    }
    this.map.toLocal[universal] = local;
    this.map.toUniversal[local] = universal;
  }
  async load() {
    try {
      const buff = await fsPromises.readFile(this.filename);
      this.map = JSON.parse(buff.toString());
      console.log(`Loaded ${this.filename}`);
    } catch {
      console.log(`Failed to load ${this.filename}`);
      this.map = {
        toLocal: {},
        toUniversal: {},
      };
    }
  }
  async save() {
    await fsPromises.writeFile(
      this.filename,
      JSON.stringify(this.map, null, 2) + "\n"
    );
    console.log(`Saved ${this.filename}`);
  }
}
