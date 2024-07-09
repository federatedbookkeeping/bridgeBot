import { Item } from "./Item";

export type IssueFields = {
    title: string;
    body: string;
    completed: boolean;
};

export type Issue = Item & {
  fields: IssueFields
}
