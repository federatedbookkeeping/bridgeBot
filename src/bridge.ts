import { Client, FetchedItem } from "./client/client";
import { DataStore } from "./data";
import { Issue } from "./model/issue";
import { Comment, CommentReferences } from "./model/comment";
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
    const issues: FetchedItem[] = await this.client.getItems("issue");
    let comments: FetchedItem[] = [];
    const commentFetches = issues.map(async (issue) => {
      // console.log("Getting comments for issue", issue);
      const issueComments = await this.client.getItems("comment", {
        issue: issue.localIdentifier,
      });
      comments = comments.concat(issueComments);
    });
    await Promise.all(commentFetches);

    issues.map(async (issue) => {
      const originalIdentifier = this.lriMap.issue.toOriginal(issue);
      console.log('mapping issue', issue.localIdentifier, issue.hintedIdentifier, issue.mintedIdentifier, originalIdentifier);
      const originalIssue = {
        identifier: originalIdentifier,
        type: issue.type,
        deleted: false,
        fields: issue.fields,
        references: {}
      }
      this.dataStore.add(originalIssue);
      console.log('fetched issue added to store', originalIdentifier);
    });
    comments.map(async (comment) => {
      const originalIdentifier = this.lriMap.comment.toOriginal(comment);
      console.log('mapping comment', comment.localIdentifier, comment.hintedIdentifier, comment.mintedIdentifier, originalIdentifier);
      const originalComment = {
        identifier: originalIdentifier,
        type: comment.type,
        deleted: false,
        fields: comment.fields,
        references: {
          issue: this.lriMap.issue.toOriginal({ localIdentifier: (comment.localReferences as CommentReferences).issue, hintedIdentifier: null, mintedIdentifier: null } as FetchedItem)
        }
      };
      this.dataStore.add(originalComment);
      console.log('fetched comment added to store', originalIdentifier);
    });
  }
  async pushIssue(issue: Issue) {
    if (typeof this.lriMap.issue.toLocal(issue.identifier) === 'undefined') {
      console.log(`pushing issue to ${this.client.spec.name}`, issue);
      const local = await this.client.createItem(issue);
      console.log('issue created, adding mapping', local, issue.identifier);
      this.lriMap.issue.addMapping({ local, original: issue.identifier });
    } else {
      console.log(`no need to push issue to ${this.client.spec.name}`, issue, this.lriMap.issue.toLocal(issue.identifier));
    }
    console.log('pushIssue done', issue.identifier);
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
      console.log('pushComment calls createItem');
      const local = await this.client.createItem({
        ... comment,
        // original identifier will be used to insert ORI hint.
        // local identifier will get assigned during creation.
        references: {
          issue: this.lriMap.issue.toLocal(comment.references.issue)
        }
      });
      console.log('comment created, adding mapping', local, comment.identifier);
      this.lriMap.comment.addMapping({ local, original: comment.identifier });
    } else {
      console.log(`no need to push comment to ${this.client.spec.name}`, comment, this.lriMap.comment.toLocal(comment.identifier));
    }
    console.log('pushComment done', comment.identifier);
  }
  async pushAll() {
    console.log('issue push start');
    // push all issues
    const issuePromises = this.dataStore.getAllItemsOfType('issue').map(item => {
      console.log(`Push issue ${item.identifier}`);
      return this.pushIssue(item as Issue);
    });
    console.log('issue push await');
    await Promise.all(issuePromises);
    console.log('issue push done');
    
    // push all comments
    console.log('comment push start');
    const commentPromises = this.dataStore.getAllItemsOfType('comment').map(item => {
      console.log(`Push comment ${item.identifier}`);
      return this.pushComment(item as Comment);
    });
    console.log('comment push await');
    await Promise.all(commentPromises);
    console.log('comment push done');
  }
}
