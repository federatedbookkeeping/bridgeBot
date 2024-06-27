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
      issue: new LriMap(this.client.getFilename('issue-identifier-map')),
      comment: new LriMap(this.client.getFilename('comment-identifier-map'))
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
      const universalIssue = {
        ... issue,
        identifier: this.lriMap.issue.toUniversal(issue.identifier)
      }
      // console.log("upserting issue", issue, universalIssue);
      this.dataStore.add(universalIssue);
    });
    comments.map(async (comment) => {
      const universalComment = {
        ... comment,
        identifier: this.lriMap.comment.toUniversal(comment.identifier),
        references: {
          issue: this.lriMap.issue.toUniversal(comment.references.issue)
        }
      };
      // console.log("upserting comment", comment, universalComment);
      this.dataStore.add(universalComment);
    });
  }
  async pushIssue(issue: Issue) {
    if (typeof this.lriMap.issue.toLocal(issue.identifier) === 'undefined') {
      console.log(`pushing issue to ${this.client.spec.name}`, issue)
      const local = await this.client.createItem('issue', issue.fields, {});
      this.lriMap.issue.addMapping({ local, universal: issue.identifier });
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
      this.client.createItem('comment', comment.fields, {
        issue: this.lriMap.issue.toLocal(comment.references.issue)
      });
    } else {
      console.log(`no need to push comment to ${this.client.spec.name}`, comment, this.lriMap.comment.toLocal(comment.identifier));
    }
  }
  async pushAll() {
    // push all issues
    this.dataStore.getAllItemsOfType('issue').map(item => {
      this.pushIssue(item as Issue);
    })
    // push all comments
    this.dataStore.getAllItemsOfType('comment').map(item => {
      this.pushComment(item as Comment);
    })
  }
}
