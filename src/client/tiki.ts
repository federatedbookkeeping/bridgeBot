import { Item } from "../model/Item";
import { Client } from "./client";


const DEFAULT_HTTP_HEADERS = {
  Accept: "application/json"
};

const REL_API_PATH_TRACKERS = ``;
const REL_API_PATH_COMMENTS = ``;

export type TikiClientSpec = {
  // from generic ClientSpec
  name: string;
  type: string;
  //specific for Tiki
  tokens: {
    [user: string]: string;
  };
  defaultUser: string;
  server: string;
  trackerId: string;
};

export class TikiClient extends Client {
  spec: TikiClientSpec; // overwrites ClientSpec from parent class
  apiUrlIdentifierPrefix: string;
  constructor(spec: TikiClientSpec) {
    super(spec);
    this.spec = spec;
  }

  async apiCall(args: {
    url: string;
    method: string;
    body?: string;
    user: string;
  }): Promise<any> {
    const headers = DEFAULT_HTTP_HEADERS;
    if (typeof args.user === "string") {
      if (typeof this.spec.tokens[args.user] !== "string") {
        // console.log(this.spec.tokens);
        throw new Error(`No token available for user "${args.user}"`);
      }
      headers["Authorization"] = `Bearer ${this.spec.tokens[args.user]}`;
    }
    console.log("apiCall", args);
    const fetchResult = await fetch(args.url, {
      method: args.method,
      headers,
      body: args.body,
    });
    // console.log(fetchResult);
    return fetchResult.json();
  }
  getApiUrl(type: string, filter?: { issue: string }): string {
    switch(type) {
      case 'issue': return `https://${this.spec.server}/api/trackers/${this.spec.trackerId}`;
      case 'comment': return `https://${this.spec.server}/api/comments?type=trackeritem&objectId=${filter!.issue}`;
    }
    throw new Error(`No API URL found for data type ${type}`);
  }
  translateItem(item: object, type: string): Item {
    // console.log('translating', item, type);
    switch(type) {
      case 'issue':
        const ttItem = item as {
          itemId: number,
          status: string,
          fields: {
            taskSummary: string,
            taskDescription: string
          }
        };
        return {
          type: 'issue',
          identifier: ttItem.itemId.toString(),
          deleted: false,
          fields: {
            title: ttItem.fields.taskSummary,
            body: ttItem.fields.taskDescription,
            completed: (ttItem.status === 'c')
          }
        } as Item;
      break;
      case 'comment':
        const ttComment = item as { object: string, objectType: string, userName: string, data: string, message_id: string };
        return {
          type: 'comment',
          identifier: ttComment.message_id,
          deleted: false,
          fields: {
            body: ttComment.data
          },
          references: {
            issue: ttComment.object
          }
        } as Item;
      break;
    }
    throw new Error('cannot translate');
  }
  translateItemsResponse(itemsResponse: object, type: string): Item[] {
    switch (type) {
      case 'issue':
        const issuesResponse = itemsResponse as { result: object[] };
        return issuesResponse.result.map(item => this.translateItem(item, type));
      case 'comment':
        const commentsResponse = itemsResponse as { comments: object[] };
        return commentsResponse.comments.map(item => this.translateItem(item, type));
      default:
        throw new Error(`Cannot translate items response of type ${type}`);
      }
  }


  async getItemsOverNetwork(type: string, filter?: { issue: string }): Promise<Item[]> {
    // console.log('TikiClient#getItemsOverNetwork', type, filter);
    return this.apiCall({ url: this.getApiUrl(type, filter), method: "GET", user: this.spec.defaultUser });
  }

  async createItem(item: Item): Promise<string> {
    console.log('createItem', item.type, item.identifier, item.fields, item.references);
    switch (item.type) {
      case 'issue': {
        const issueFields = item.fields as { title: string, body: string };
        const response = await this.apiCall({
          url: this.getApiUrl('issue', undefined),
          method: 'POST',
          user: this.spec.defaultUser,
          body: JSON.stringify({
            status: 'o',
            ins_27: issueFields.title,          
            syntax: 'tiki',
            ins_28: 3,
            ins_31: issueFields.body,
            'ins33[]': this.spec.defaultUser,
            trackerId: this.spec.trackerId,
          })
        });
        console.log(response);
        return 'fake-id';
      }
      case 'comment': {
        const commentFields = item.fields as { body: string };
        const commentReferences = item.references as { issue: string };
        const response = await this.apiCall({
          url: this.getApiUrl('issue', undefined),
          method: 'POST',
          user: this.spec.defaultUser,
          body: JSON.stringify({
            type: 'trackeritem',
            objectId: commentReferences.issue,
            post: 1,
            syntax: 'tiki',
            data: commentFields.body
          })
        });
        console.log(response);
      //   {
      //     "threadId": "2",
      //     "parentId": 0,
      //     "type": "trackeritem",
      //     "objectId": "686",
      //     "feedback": []
      // }
        return 'fake-id';
      }
      default:
        throw new Error(`TikiClient cannot create items of type ${item.type}`);
    }
    // const itemUrl = await this.addItem(this.spec.defaultUser, fields);
    //   return `${API_URL_ID_SCHEME}:${itemUrl}`;
    return '';
  }
  async updateItem(type: string, id: string, fields: object): Promise<void> {
  }
  async deleteItem(type: string, id: string): Promise<void> {
  }
}
