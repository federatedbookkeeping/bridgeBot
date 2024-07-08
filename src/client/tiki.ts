import { Item } from "../model/Item";
import { FetchCachingClient, FetchedItem, WebhookEventType } from "./client";


const DEFAULT_HTTP_HEADERS = {
  Accept: "application/json",
  // "Content-Type": "application/json"
  "Content-Type": "application/x-www-form-urlencoded"
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
  fieldPrefix: string;
  fieldMapping: {
    Summary: number,
    Description: number,
    Job: number,
    URI: number,
  }
  defaultUser: string;
  server: string;
  trackerId: string;
};

export class TikiClient extends FetchCachingClient {
  spec: TikiClientSpec; // overwrites ClientSpec from parent class
  apiUrlIdentifierPrefix: string;
  constructor(spec: TikiClientSpec) {
    super(spec);
    this.spec = spec;
  }
  getType(): string {
    return 'tiki';
  }
  parseWebhookData(data: object): { type: WebhookEventType, item: FetchedItem } {
    throw new Error('Implement me!');
    // return {
    //   type: WebhookEventType.Deleted,
    //   item: {} as FetchedItem
    // };
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
    console.log("apiCall", args, JSON.stringify(headers, null, 2));
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
      // case 'issue-create': return `https://${this.spec.server}/tiki-tracker-insert_item`;
      case 'issue-create': return `https://${this.spec.server}/api/trackers/${this.spec.trackerId}/items`;
      case 'comment': return `https://${this.spec.server}/api/comments?type=trackeritem&objectId=${filter!.issue}`;
    }
    throw new Error(`No API URL found for data type ${type}`);
  }
  translateFetchedItem(item: object, type: string): FetchedItem {
    // console.log('translating', item, type);
    switch(type) {
      case 'issue': {
        const ttItem = item as TikiIssue;
        console.log("extracting identifiers and fields from ttItem", ttItem);
        return {
          type: 'issue',
          localIdentifier: ttItem.itemId.toString(),
          mintedIdentifier: ttItem.fields[`${this.spec.fieldPrefix}URI`],
          hintedIdentifier: ttItem.fields[`${this.spec.fieldPrefix}URI`],
          fields: {
            title: ttItem.fields[`${this.spec.fieldPrefix}Summary`],
            body: ttItem.fields[`${this.spec.fieldPrefix}Description`],
            completed: (ttItem.status === 'c')
          },
          localReferences: {},
        };
      }
      case 'comment': {
        const ttComment = item as TikiComment;
        console.log("extracting identifiers, fields and issue reference from ttComment", ttComment);
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
        return issuesResponse.result.map(item => this.translateFetchedItem(item, type));
      case 'comment':
        const commentsResponse = itemsResponse as { comments: object[] };
        return commentsResponse.comments.map(item => this.translateFetchedItem(item, type));
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
        fields[`ins_${this.spec.fieldMapping.Summary.toString()}`] = issueFields.title;
        fields[`ins_${this.spec.fieldMapping.Description.toString()}`] = issueFields.body;
        fields[`ins_${this.spec.fieldMapping.Job.toString()}`] = '';
        fields[`ins_${this.spec.fieldMapping.URI.toString()}`] = item.identifier;
         
        // fields[`ticket`] = `n_kKu2qtvdpsIEILiX5jl6k6YX_t-j4sIrOPR7APyj0`;
        // fields[`mode_wysiwyg`] = '';
        // fields[`mode_normal`] = '';
        // fields[`syntax`] = 'tiki';
        // fields[`ins_28`] = '';
        // fields[`wysiwyg`] = 'n';
        // fields[`ins_29`] = '';
        // fields[`ins_30`] = '';
        // fields[`del_30`] = '';
        // fields[`ins_31`] = 'log it';
        // fields[`ins_32%5B%5D`] = '';
        // fields[`ins_33%5B%5D`] = 'michielbdejong';
        // fields[`ins_33%5B%5D`] = '';
        // fields[`ins_34%5Bobjects%5D`] = '';
        // fields[`skipRefresh`] = '';
        // fields[`refreshMeta`] = '';
        // fields[`refreshObject`] = '';

        const url = this.getApiUrl('issue-create', undefined);
        // const body = JSON.stringify(fields, null, 2);
        const body = 'status=o&syntax=tiki&trackerId=4&ins_38=an+edited&ins_39=this+issue+is+now+today&ins_40=&ins_41=https%3A%2F%2Ftimesheet.dev4.evoludata.com%2Fapi%2Ftrackers%2F3%2Fitems%2F687';
        // const body = 'ticket=n_kKu2qtvdpsIEILiX5jl6k6YX_t-j4sIrOPR7APyj0&ins_38=manual+creation+in+4&ins_39=&ins_40=&ins_41=&trackerId=4&skipRefresh=&refreshMeta=&refreshObject=';
        const response = await this.apiCall({
          url,
          method: 'POST',
          user: this.spec.defaultUser,
          body
        });
        if (response.code === 409) {
          throw new Error('409 response from the Tiki API');
        }
        console.log('Sent', body, 'To', url, 'Received', response);
        throw new Error("what is the id?");
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
