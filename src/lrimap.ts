const fsPromises = require("fs/promises");
const LRI_DATA_ROOT = 'data/lri';

export class LriMap {
  filename: string;
  prefix: string;
  map: {
    toLocal: {
      [original: string]: string;
    };
    toOriginal: {
      [local: string]: string;
    };
  };
  constructor(mapName: string) {
    this.filename = `${LRI_DATA_ROOT}/${mapName}.json`;
  }
  mintOri(local: string) {
    return this.prefix + local;
  }
  parseLocalOri(ori: string) {
    if (!ori.startsWith(this.prefix)) {
      throw new Error(`Not a local ORI! ${ori}`);
    }
    return ori.substring(this.prefix.length);
  }
  toLocal(original: string) {
    return this.map.toLocal[original];
  }
  determineOriginal(local: string, oriFromHint: string | null, mintIfMissing: string | null): string {
    if (typeof this.map.toOriginal[local] !== "undefined") {
      return this.map.toOriginal[local];
    }
    console.log(`Have not seen local identifier "${local}" before`);
    if (oriFromHint === null) {
      if (mintIfMissing === null) {
        throw new Error(`No ORI found for "${local}`);
      }
      console.log(`Minting ORI for ${local}`, mintIfMissing);
      return mintIfMissing;
    } else {
      console.log(`Adopting ORI for ${local} from hint`, oriFromHint);
      return oriFromHint;
    }
  }
  checkOriFromHint(local: string, oriFromHint: string | null, original: string): void {
    if (oriFromHint === null) {
      console.error(`Consider adding an ORI hint for this item in this replica`, local, oriFromHint, original);
    } else if (oriFromHint !== original) {
      throw new Error(`Data Store has a mapping that is different from the hinted one - local="${local}", oriFromHint="${oriFromHint}", original="${original}"`);
    }
  }
  toOriginal(local: string, oriFromHint: string | null, mintIfMissing: string | null) {
    const original = this.determineOriginal(local, oriFromHint, mintIfMissing);
    this.map.toOriginal[local] = original;
    this.map.toLocal[original] = local;
    console.log('toOriginal calls checkOriFromHint', local, oriFromHint, mintIfMissing, original);
    this.checkOriFromHint(local, oriFromHint, original);
    return original;
  }
  addMapping(identifiers: { local: string; original: string }) {
    const { local, original } = identifiers;
    if (typeof this.map.toLocal[original] !== "undefined") {
      throw new Error("mapping already exists!");
    }
    if (typeof this.map.toOriginal[local] !== "undefined") {
      throw new Error("mapping already exists!");
    }
    this.map.toLocal[original] = local;
    this.map.toOriginal[local] = original;
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
        toOriginal: {},
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
