const fsPromises = require("fs/promises");
import { Client } from "./client/client";
import { DataStore } from "./data";
import { Issue } from "./model/issue";
import { Comment } from "./model/comment";
import { v4 as uuid } from 'uuid';

class LriMap {
  filename: string;
  map: {
    toLocal: {
      [universal: string]: string
    };
    toUniversal: {
      [local: string]: string
    }
  };
  constructor(filename: string) {
    this.filename = filename;
  }
  toLocal(universal: string) {
    return this.map.toLocal[universal];
  }
  toUniversal(local: string) {
    if (typeof this.toUniversal[local] === 'undefined') {
      const universal = uuid();
      this.map.toUniversal[local] = universal;
      this.map.toLocal[universal] = local;
    }

    return this.map.toUniversal[local];
  }
  async load() {
    try {
      const buff = await fsPromises.readFile(this.filename);
      this.map = JSON.parse(buff.toString());
      console.log(`Loaded ${this.filename}`);
    } catch {
      console.log(`Failed to load ${this.filename}`);
      this.map = {
        toLocal: {},
        toUniversal: {}
      };
    }
  }
  async save() {
    await fsPromises.writeFile(this.filename, JSON.stringify(this.map, null, 2) + "\n");
    console.log(`Saved ${this.filename}`);
  }
}

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
  async loadAllLriMaps() {
    const types = Object.keys(this.lriMap);
    const promises = types.map(type => this.lriMap[type].load());
    return Promise.all(promises);
  }
  async saveAllLriMaps() {
    const types = Object.keys(this.lriMap);
    const promises = types.map(type => this.lriMap[type].save());
    return Promise.all(promises);
  }
  async sync() {
    await this.loadAllLriMaps();
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
      const universalIssue = {
        ... issue,
        identifier: this.lriMap.issue.toUniversal(issue.identifier)
      }
      console.log("upserting issue", issue, universalIssue);
      this.dataStore.add(universalIssue);
    });
    await Promise.all(issueUpserts);
    console.log(`Bridge for client ${this.client.spec.name} is done syncing issues`);
    const commentUpserts = comments.map(async (comment) => {
      const universalComment = {
        ... comment,
        identifier: this.lriMap.comment.toUniversal(comment.identifier),
        references: {
          issue: this.lriMap.issue.toUniversal(comment.references.issue)
        }
      };
      console.log("upserting comment", comment, universalComment);
      this.dataStore.add(universalComment);
    });
    await Promise.all(commentUpserts);
    await this.saveAllLriMaps();
    console.log(
      `Bridge for client ${this.client.spec.name} is done syncing comments`
    );
  }
}
