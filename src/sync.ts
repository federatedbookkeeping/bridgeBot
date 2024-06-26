import { Client } from "./client/client";
import { DataStore } from "./data";
import { Issue } from "./model/issue";

export async function sync(client: Client, dataStore: DataStore) {
  const issues: Issue[] = await client.getItems('issue');
  let comments: Comment[] = [];
  const commentFetches = issues.map(async (issue) => {
    console.log('Getting comments for issue', issue);
    const issueComments = await client.getItems('comment', { issue: issue.identifier });
    comments = comments.concat(issueComments);
  });
  await Promise.all(commentFetches);
  const issueUpserts = issues.map(async (issue) => {
    // console.log('upserting doc', doc);
    // dataStore.applyOperation({
    //   origin: client.spec.name,
    //   operationType: "upsert",
    //   fields: issue,
    // });
  });
  await Promise.all(issueUpserts);
  console.log(`Bridge for client ${client.spec.name} is done syncing issues`);
  const commentUpserts = comments.map(async (comment) => {
    // console.log('upserting comment', comment);
  //   dataStore.applyOperation({
  //     origin: client.spec.name,
  //     operationType: "upsert",
  //     fields: comment,
  //   });
  });
  await Promise.all(commentUpserts);
  console.log(`Bridge for client ${client.spec.name} is done syncing comments`);
}

