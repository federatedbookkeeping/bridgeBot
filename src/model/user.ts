import { Item } from "./Item";

export type User = Item & {
  fields: {
    name: string;
  }
  references: {
  }
}
