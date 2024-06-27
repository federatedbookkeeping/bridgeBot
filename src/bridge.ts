import { Client } from "./client/client";
import { DataStore } from "./data";
import { Issue } from "./model/issue";
import { Comment } from "./model/comment";

export class Bridge {
  client: Client;
  dataStore: DataStore;
  constructor(client: Client, dataStore: DataStore) {
    this.client = client;
    this.dataStore = dataStore;
  }
  async sync() {
    const issues: Issue[] = await this.client.getItems("issue");
    let comments: Comment[] = [];
    const commentFetches = issues.map(async (issue) => {
      console.log("Getting comments for issue", issue);
      const issueComments = await this.client.getItems("comment", {
        issue: issue.identifier,
      });
      comments = comments.concat(issueComments);
    });
    await Promise.all(commentFetches);

    const issueUpserts = issues.map(async (issue) => {
      console.log("upserting issue", issue);
      this.dataStore.add(issue);
      // dataStore.applyOperation({
      //   origin: client.spec.name,
      //   operationType: "upsert",
      //   fields: issue,
      // });
    });
    await Promise.all(issueUpserts);
    console.log(`Bridge for client ${this.client.spec.name} is done syncing issues`);
    const commentUpserts = comments.map(async (comment) => {
      console.log("upserting comment", comment);
      this.dataStore.add(comment);
      // dataStore.applyOperation({
      //   origin: client.spec.name,
      //   operationType: "upsert",
      //   fields: comment,
      // });
    });
    await Promise.all(commentUpserts);
    console.log(
      `Bridge for client ${this.client.spec.name} is done syncing comments`
    );
  }
}
