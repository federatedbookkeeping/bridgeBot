import { Item } from "./Item";

export class Issue extends Item {
  fields: {
    title: string;
    body: string;
    completed: boolean;
  }
}
