import { Item } from "./Item";

export type Worked = Item & {
  fields: {
    task: string;
    description: string;
    startTime: string;
    endTime: string;
    date: string;
  }
  references: {
    user: string;
    project: string;
  }
}
