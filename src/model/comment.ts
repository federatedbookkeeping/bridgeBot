import { Item } from "./Item";

export class CommentReferences {
    issue: string;
}
export class Comment extends Item {
  fields: {
    body: string;
  }
  references: CommentReferences
}
