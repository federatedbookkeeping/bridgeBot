import { Item } from "./Item";

export type CommentFields = {
  body: string;
}
export type CommentReferences = {
    issue: string;
}
export type Comment = Item & {
  fields: CommentFields
  references: CommentReferences
}
