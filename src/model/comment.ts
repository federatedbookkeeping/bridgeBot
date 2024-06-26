import { Item } from "./Item";

export class Comment extends Item {
  fields: {
    body: string;
  }
  references: {
    issue: string;
  }
}
