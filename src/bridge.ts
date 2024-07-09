import { Client, FetchedItem, WebhookEventType } from "./client/client";
import { DataStore } from "./data";
import { Issue } from "./model/issue";
import { Comment, CommentReferences } from "./model/comment";
import { LriMap } from "./lrimap";
import { Item } from "./model/Item";

export class Bridge {
  client: Client;
  dataStore: DataStore;
  lriMap: {
    [type: string]: LriMap;
  };
  constructor(client: Client, dataStore: DataStore) {
    this.client = client;
    this.dataStore = dataStore;
    this.lriMap = {
      issue: new LriMap(`${this.client.getName()}-issues-lri-map`),
      comment: new LriMap(`${this.client.getName()}-comments-lri-map`),
    };
  }
  getType() {
    return this.client.getType();
  }
  getName() {
    return this.client.getName();
  }
  processWebhook(data: object, urlParts: string[]): { type: WebhookEventType, item: Item } {
    // console.log("parsing in bridge");
    const parsed = this.client.parseWebhookData(data, urlParts);
    console.log(parsed.type, parsed.item);
    switch (parsed.type) {
      case WebhookEventType.Created: {
        const originalItem = this.processIncomingItem(parsed.item);
        this.dataStore.add(originalItem);
        return { type: parsed.type, item: originalItem };
      }
      case WebhookEventType.Updated: {
        this.processIncomingItem(parsed.item);
        return { type: parsed.type, item: {} as Item };
      }
      case WebhookEventType.Deleted: {
        this.processIncomingItem(parsed.item);
        return { type: parsed.type, item: {} as Item };
      }
    }
  }
  async load() {
    const types = Object.keys(this.lriMap);
    const promises = types.map((type) => this.lriMap[type].load());
    return Promise.all(promises);
  }
  async save() {
    const types = Object.keys(this.lriMap);
    const promises = types.map((type) => this.lriMap[type].save());
    return Promise.all(promises);
  }
  processIncomingItem(item: FetchedItem): Item {
    const originalIdentifier = this.lriMap[item.type].toOriginal(item);
    console.log(
      "mapping issue",
      item.localIdentifier,
      item.hintedIdentifier,
      item.mintedIdentifier,
      originalIdentifier
    );
    const originalItem: Item = {
      identifier: originalIdentifier,
      type: item.type,
      deleted: false,
      fields: item.fields,
      references: {},
    };
    if (item.type === "comment") {
      originalItem.references = {
        issue: this.lriMap.issue.toOriginal({
          localIdentifier: (item.localReferences as CommentReferences).issue,
          hintedIdentifier: null,
          mintedIdentifier: null,
        } as FetchedItem),
      };
    }
    return originalItem;
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

    issues.map(issue => {
      const originalItem = this.processIncomingItem(issue);
      this.dataStore.add(originalItem);
    });
    comments.map(comment => {
      const originalItem = this.processIncomingItem(comment);
      this.dataStore.add(originalItem);
    });
  }
  async pushIssue(issue: Issue): Promise<void>  {
    console.log('pushIssue', issue);
    if (typeof this.lriMap.issue.toLocal(issue.identifier) === "undefined") {
      // throw new Error('why is this issue not in the LRI map?');
      // TODO: sanity check: if we detect the ORI matches the schema for this tracker,
      // then arriving here would mean something is wrong.
      console.log(`pushing issue to ${this.client.getName()}`, issue);
      const local = await this.client.createItem(issue);
      console.log("issue created, adding mapping", local, issue.identifier);
      // TODO: sanity check: if there is already a mapping for local identifier
      // `local` in the LRI map, then that would mean something is wrong.
      this.lriMap.issue.addMapping({ local, original: issue.identifier });
    } else {
      console.log(
        `no need to push issue to ${this.client.getName()}`,
        issue,
        this.lriMap.issue.toLocal(issue.identifier)
      );
    }
    console.log("pushIssue done", issue.identifier);
  }
  async pushComment(comment: Comment): Promise<void>  {
    console.log('pushComment', comment);
    if (
      typeof this.lriMap.comment.toLocal(comment.identifier) === "undefined"
    ) {
      console.log(`pushing comment to ${this.client.getName()}`, comment);
      if (
        typeof this.lriMap.issue.toLocal(comment.references.issue) ===
        "undefined"
      ) {
        console.error(`Cannot create comment without creating the issue first`);
        const issue = this.dataStore.getItem("issue", comment.references.issue);
        if (typeof issue !== "undefined") {
          if (typeof issue.identifier !== 'string' || issue.identifier === '') {
            throw new Error('cannot create item without identifier');
          }      
          await this.pushItem(issue as Item);
        }
      }
      if (
        typeof this.lriMap.issue.toLocal(comment.references.issue) ===
        "undefined"
      ) {
        throw new Error(
          "tried to push issue before pushing comment but still failed"
        );
      }
      console.log("pushComment calls createItem");
      const local = await this.client.createItem({
        ...comment,
        // original identifier will be used to insert ORI hint.
        // local identifier will get assigned during creation.
        references: {
          issue: this.lriMap.issue.toLocal(comment.references.issue),
        },
      });
      console.log("comment created, adding mapping", local, comment.identifier);
      this.lriMap.comment.addMapping({ local, original: comment.identifier });
    } else {
      console.log(
        `no need to push comment to ${this.client.getName()}`,
        comment,
        this.lriMap.comment.toLocal(comment.identifier)
      );
    }
    console.log("pushComment done", comment.identifier);
  }
  async pushItem(item: Item): Promise<void> {
    if (typeof item.identifier !== 'string' || item.identifier === '') {
      throw new Error('cannot create item without identifier');
    }
    console.log('Bridge#pushItem');
    const hinted = this.client.getOriHint((item.fields as { body: string }).body);
    if (typeof hinted !== null && this.lriMap[item.type].toLocal(hinted!)) {
      console.log('already have this item', hinted);
      return;
    }
    if (this.lriMap[item.type].toLocal(item.identifier)) {
      console.log('already have this item', item.identifier);
      return;
    }
    if (item.type === 'issue') {
      console.log('Bridge#pushItem -> Issue');
      return this.pushIssue(item as Issue);
    } else {
      console.log('Bridge#pushItem -> Comment');
      return this.pushComment(item as Comment);
    }
  }
  async pushAll() {
    console.log("issue push start");
    // push all issues
    const issuePromises = this.dataStore
      .getAllItemsOfType("issue")
      .map((item) => {
        console.log(`Push issue ${item.identifier}`);
        if (typeof item.identifier !== 'string' || item.identifier === '') {
          throw new Error('cannot create item without identifier');
        }    
        return this.pushItem(item);
      });
    console.log("issue push await");
    await Promise.all(issuePromises);
    console.log("issue push done");

    // push all comments
    console.log("comment push start");
    const commentPromises = this.dataStore
      .getAllItemsOfType("comment")
      .map((item) => {
        console.log(`Push comment ${item.identifier}`);
        if (typeof item.identifier !== 'string' || item.identifier === '') {
          throw new Error('cannot create item without identifier');
        }    
        return this.pushItem(item);
      });
    console.log("comment push await");
    await Promise.all(commentPromises);
    console.log("comment push done");
  }
}
