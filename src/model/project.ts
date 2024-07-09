import { Item } from "./Item";

export type Project = Item & {
  fields: {
    name: string;
  }
  references: {
  }
}
