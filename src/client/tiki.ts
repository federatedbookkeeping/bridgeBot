import { Item } from "../model/Item";
import { Client, FetchedItem } from "./client";


const DEFAULT_HTTP_HEADERS = {
  Accept: "application/json"
};

export type TikiIssue = {
  itemId: number
  status: string
  fields: {
    Summary: string,
    Description: string,
    Job: string,
    URI: string
  }
}
export type TikiComment = {
  object: string, // issue.itemId.toString()
  objectType: string // always "trackeritem"
  userName: string,
  commentDate: number, // epoch seconds
  data: string,
  message_id: string // ORI, e.g. "michielbdejong-0-ce41e38cdc@timesheet.dev4.evoludata.com"
}

export type TikiClientSpec = {
  // from generic ClientSpec
  name: string;
  type: string;
  //specific for Tiki
  tokens: {
    [user: string]: string;
  };
  fieldsPrefix: string;
  fieldsMapping: {
    Summary: number,
    Description: number,
    Job: number,
    URI: number,
  }
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
  translateItem(item: object, type: string): FetchedItem {
    // console.log('translating', item, type);
    switch(type) {
      case 'issue': {
        const ttItem = item as TikiIssue;
        return {
          type: 'issue',
          localIdentifier: ttItem.itemId.toString(),
          mintedIdentifier: ttItem.fields[`${this.spec.fieldsPrefix}URI`],
          hintedIdentifier: ttItem.fields[`${this.spec.fieldsPrefix}URI`],
          fields: {
            title: ttItem.fields[`${this.spec.fieldsPrefix}Summary`],
            body: ttItem.fields[`${this.spec.fieldsPrefix}Description`],
            completed: (ttItem.status === 'c')
          },
          localReferences: {},
        };
      }
      case 'comment': {
        const ttComment = item as TikiComment;
        return {
          type: 'comment',
          localIdentifier: ttComment.message_id,
          mintedIdentifier: ttComment.message_id,
          hintedIdentifier: ttComment.message_id,
          fields: {
            body: ttComment.data
          },
          localReferences: {
            issue: ttComment.object
          }
        };
      }
    }
    throw new Error('cannot translate');
  }
  translateItemsResponse(itemsResponse: object, type: string): FetchedItem[] {
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


  async getItemsOverNetwork(type: string, filter?: { issue: string }): Promise<object> {
    // console.log('TikiClient#getItemsOverNetwork', type, filter);
    return this.apiCall({ url: this.getApiUrl(type, filter), method: "GET", user: this.spec.defaultUser });
  }

  async createItem(item: Item): Promise<string> {
    console.log('createItem', item.type, item.identifier, item.fields, item.references);
    switch (item.type) {
      case 'issue': {
        const issueFields = item.fields as { title: string, body: string };
        const fields = {
          status: 'o',
          syntax: 'tiki',
          trackerId: this.spec.trackerId,
        };
        fields[`ins_${this.spec.fieldsMapping.Summary.toString()}`] = issueFields.title;
        fields[`ins_${this.spec.fieldsMapping.Description.toString()}`] = issueFields.body;
        fields[`ins_${this.spec.fieldsMapping.Job.toString()}`] = '';
        fields[`ins_${this.spec.fieldsMapping.URI.toString()}`] = item.identifier;

        const response = await this.apiCall({
          url: this.getApiUrl('issue', undefined),
          method: 'POST',
          user: this.spec.defaultUser,
          body: JSON.stringify(fields)
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
