import { Item } from "./model/Item";

const fsPromises = require("fs/promises");

export type OperationType = 'upsert' | 'merge' | 'fork';
export type ObjectType = 'issue' | 'worked' | 'comment';

export type Operation = {
  operationType: OperationType,
  fields: Partial<Item>,
  origin?: string,
};

export class DataStore {
  filename: string
  items: Item[] = [];
  constructor(filename: string) {
    this.filename = filename;
  }
  add(item) {
    this.items.push(item);
  }
  // match(identifiers: string[], cb: (i: number, id: string) => void) {
  //   for (let i = 0; i < this.items.length; i++) {
  //     for (let j = 0; j < identifiers.length; j++) {
  //       // console.log('matching', this.items[i]);
  //       if (this.items[i].identifiers.includes(identifiers[j])) {
  //         cb(i, identifiers[j]);
  //       }
  //     }
  //   }
  // }
  // applyOperation(operation: Operation) {
  //   switch(operation.operationType) {
  //     case 'upsert':
  //       let matched = false;
  //       this.match(operation.fields.identifiers!, (i: number) => {
  //         this.items[i] = { ...this.items[i], ...operation.fields };
  //         matched = true;
  //       });
  //       if (!matched) {
  //         this.items.push(operation.fields as Item);
  //         // this.emit('operation', operation);
  //       }
  //     break;
  //     case 'merge':
  //       let winner = -1;
  //       this.match(operation.fields.identifiers!, (i: number) => {
  //         if (winner === -1) {
  //           winner = i;
  //         } else {
  //           this.items[winner].identifiers = this.items[winner].identifiers.concat(this.items[i].identifiers);
  //           this.items[i].identifiers = [];
  //           this.items[i].deleted = true;
  //         }
  //       });
  //       case 'fork':
  //         let added = -1;
  //         this.match(operation.fields.identifiers!, (i: number, id: string) => {
  //           if (added === -1) {
  //             added = this.items.length;
  //             this.items.push({ ...this.items[i]});
  //             this.items[added].identifiers = [];
  //           }
  //           this.items[added].identifiers.push(id);
  //           this.items[i].identifiers = this.items[i].identifiers.filter(x => x !== id);
  //         });
  //       default:
  //   }
  // }

  // addIdentifier(existingIdentifier: string, additionalIdentifier: string) {
  //   for (let i = 0; i < this.items.length; i++) {
  //     if (this.items[i].identifiers.includes(existingIdentifier)) {
  //       if (this.items[i].identifiers.includes(additionalIdentifier)) {
  //         console.error('already have that identifier');
  //       } else {
  //         this.items[i].identifiers.push(additionalIdentifier);
  //         console.log('added identifier', this.items[i].identifiers);
  //         return;
  //       }
  //     }
  //   }
  //   throw new Error(`No item found with existing identifier ${existingIdentifier}, cannot add ${additionalIdentifier}`);
  // }

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
  // issueIdToIssueIds(issueId: string): string[] {
  //   for (let i = 0; i < this.items.length; i++) {
  //     for (let j = 0; j < this.items[i].identifiers.length; j++) {
  //       if (this.items[i].identifiers[j] === issueId) {
  //         return this.items[i].identifiers;
  //       }
  //     }
  //   }
  //   return [];
  // }
}
