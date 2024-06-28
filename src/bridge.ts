import { Client } from "./client/client";
import { DataStore } from "./data";
import { Issue } from "./model/issue";
import { Comment } from "./model/comment";
import { LriMap } from "./lrimap";

export class Bridge {
  client: Client;
  dataStore: DataStore;
  lriMap: {
    [type: string]: LriMap
  };
  constructor(client: Client, dataStore: DataStore) {
    this.client = client;
    this.dataStore = dataStore;
    this.lriMap = {
      issue: new LriMap(`${this.client.spec.name}-issues-lri-map`),
      comment: new LriMap(`${this.client.spec.name}-comments-lri-map`)
    };
  }
  async load() {
    const types = Object.keys(this.lriMap);
    const promises = types.map(type => this.lriMap[type].load());
    return Promise.all(promises);
  }
  async save() {
    const types = Object.keys(this.lriMap);
    const promises = types.map(type => this.lriMap[type].save());
    return Promise.all(promises);
  }
  async fetchAll() {
    const issues: Issue[] = await this.client.getItems("issue");
    let comments: Comment[] = [];
    const commentFetches = issues.map(async (issue) => {
      // console.log("Getting comments for issue", issue);
      const issueComments = await this.client.getItems("comment", {
        issue: issue.identifier,
      });
      comments = comments.concat(issueComments);
    });
    await Promise.all(commentFetches);

    issues.map(async (issue) => {
      const originalIssue = {
        ... issue,
        identifier: this.lriMap.issue.toOriginal(issue.identifier, this.client.extractOri('issue', issue), this.client.mintOri('issue', issue.identifier))
      }
      // console.log("upserting issue", issue, originalIssue);
      this.dataStore.add(originalIssue);
    });
    comments.map(async (comment) => {
      const originalComment = {
        ... comment,
        identifier: this.lriMap.comment.toOriginal(comment.identifier, this.client.extractOri('comment', comment), this.client.mintOri('comment', comment.identifier, comment.references)),
        references: {
          issue: this.lriMap.issue.toOriginal(comment.references.issue, null, null)
        }
      };
      // console.log("upserting comment", comment, originalComment);
      this.dataStore.add(originalComment);
    });
  }
  async pushIssue(issue: Issue) {
    if (typeof this.lriMap.issue.toLocal(issue.identifier) === 'undefined') {
      console.log(`pushing issue to ${this.client.spec.name}`, issue)
      const local = await this.client.createItem(issue);
      this.lriMap.issue.addMapping({ local, original: issue.identifier });
    } else {
      console.log(`no need to push issue to ${this.client.spec.name}`, issue, this.lriMap.issue.toLocal(issue.identifier));
    }
  }
  async pushComment(comment: Comment) {
    if (typeof this.lriMap.comment.toLocal(comment.identifier) === 'undefined') {
      console.log(`pushing comment to ${this.client.spec.name}`, comment)
      if (typeof this.lriMap.issue.toLocal(comment.references.issue) === 'undefined') {
        console.error(`Cannot create comment without creating the issue first`);
        const issue = this.dataStore.getItem('issue', comment.references.issue);
        if (typeof issue !== 'undefined') {
          await this.pushIssue(issue as Issue);
        }
      }
      if (typeof this.lriMap.issue.toLocal(comment.references.issue) === 'undefined') {
        throw new Error('tried to push issue before pushing comment but still failed');
      }
      this.client.createItem({
        ... comment,
        // original identifier will be used to insert ORI hint.
        // local identifier will get assigned during creation.
        references: {
          issue: this.lriMap.issue.toLocal(comment.references.issue)
        }
      });
    } else {
      console.log(`no need to push comment to ${this.client.spec.name}`, comment, this.lriMap.comment.toLocal(comment.identifier));
    }
  }
  async pushAll() {
    // push all issues
    const issuePromises = this.dataStore.getAllItemsOfType('issue').map(item => {
      this.pushIssue(item as Issue);
    });
    await Promise.all(issuePromises);
    // push all comments
    const commentPromises = this.dataStore.getAllItemsOfType('comment').map(item => {
      this.pushComment(item as Comment);
    });
    await Promise.all(commentPromises);
  }
}
