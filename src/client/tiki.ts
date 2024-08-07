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
  },
  webhookFieldMapping: {
    issueTitle: string,
    issueBody: string,
    issueUri: string,
    issueId: string,
    commentBody: string,
    commentId: string,
    commentIssueId: string,
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
    this.oriHintPrefix =`~hc~ BridgeBot copy of `;
    this.oriHintSuffix = ` ~hc~\n`;
  }
  getType(): string {
    return 'tiki';
  }
  mintOri(type: string, local: string, filter?: { issue: string }): string {
    switch (type) {
      case "issue":
        return `https://${this.spec.server}/item${local}`;
      case "comment":
        return local;
      default:
        throw new Error(`Don't know how to mint ORI for item type ${type}`);
    }
  }
  parseWebhookData(data: object, urlParts: string[]): { type: WebhookEventType, item: FetchedItem } {
    const operationMap = {
      create: WebhookEventType.Created,
      update: WebhookEventType.Updated,
      delete: WebhookEventType.Deleted
    }
    // console.log('Tiki Client parsing webhook', data, urlParts, this.spec.webhookFieldMapping);
    let ret;
    if (urlParts[0] === 'comment') {
      ret = {
        type: operationMap[urlParts[1]],
        item: {
          type: 'comment',
          localIdentifier: (data as { message_id: string }).message_id,
          hintedIdentifier: (data as { message_id: string }).message_id,
          mintedIdentifier: this.mintOri('comment', (data as { message_id: string }).message_id, { issue: (data as { object: string }).object }),
          fields: {
            body: (data as { content: string }).content,
          },
          localReferences: {
            issue: (data as { object: string }).object,
          }
        } as FetchedItem
      };
    } else {
      ret = {
        type: operationMap[urlParts[1]],
        item: {
          type: 'issue',
          localIdentifier: data[this.spec.webhookFieldMapping.issueId],
          hintedIdentifier: data[this.spec.webhookFieldMapping.issueUri],
          mintedIdentifier: this.mintOri('issue', data[this.spec.webhookFieldMapping.issueId]),
          fields: {
            title: data[this.spec.webhookFieldMapping.issueTitle],
            body: data[this.spec.webhookFieldMapping.issueBody],
            completed: false,
          },
          localReferences: {}
        } as FetchedItem
      };
    }
    if (ret.item.hintedIdentifier === '') {
      ret.item.hintedIdentifier = null;
    }
    // console.log('Tiki Client parsed webhook', data, ret);
    return ret;
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
    // console.log("apiCall", args, JSON.stringify(headers, null, 2));
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
      case 'issue-create': return `https://${this.spec.server}/api/trackers/${this.spec.trackerId}/items`;
      case 'comment': return `https://${this.spec.server}/api/comments?type=trackeritem&objectId=${filter!.issue}`;
      case 'comment-create': return `https://${this.spec.server}/api/comments`;
    }
    throw new Error(`No API URL found for data type ${type}`);
  }
  translateFetchedItem(item: object, type: string): FetchedItem {
    // console.log('translating', item, type);
    switch(type) {
      case 'issue': {
        const ttItem = item as TikiIssue;
        // console.log("extracting identifiers and fields from ttItem", ttItem);
        const localIdentifier = ttItem.itemId.toString();
        const mintedIdentifier = this.mintOri('issue', localIdentifier);
        let hintedIdentifier = ttItem.fields[`${this.spec.fieldPrefix}URI`];
        if (hintedIdentifier === '') {
          hintedIdentifier = null;
        }
        const ret = {
          type: 'issue',
          localIdentifier,
          mintedIdentifier,
          hintedIdentifier,
          fields: {
            title: ttItem.fields[`${this.spec.fieldPrefix}Summary`],
            body: ttItem.fields[`${this.spec.fieldPrefix}Description`],
            completed: (ttItem.status === 'c')
          },
          localReferences: {},
        };
        // console.log('Tiki Client translated fetched issue', ret);
        return ret;
      }
      case 'comment': {
        const ttComment = item as TikiComment;
        // console.log("extracting identifiers, fields and issue reference from ttComment", ttComment);
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
  translateItemsWireResponse(itemsWireResponse: object, type: string): FetchedItem[] {
    switch (type) {
      case 'issue':
        const issuesResponse = itemsWireResponse as { result: object[] };
        return issuesResponse.result.map(item => this.translateFetchedItem(item, type));
      case 'comment':
        const commentsResponse = itemsWireResponse as { comments: object[] };
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
    // console.log('createItem', item.type, item.identifier, item.fields, item.references);
    switch (item.type) {
      case 'issue': {
        const url = this.getApiUrl('issue-create', undefined);
        const issueFields = item.fields as { title: string, body: string };
        const fields = {
          status: 'o',
          syntax: 'tiki',
          trackerId: this.spec.trackerId,
        };
        fields[`ins_${this.spec.fieldMapping.Summary.toString()}`] = issueFields.title || 'title';
        fields[`ins_${this.spec.fieldMapping.Description.toString()}`] = issueFields.body || 'body';
        fields[`ins_${this.spec.fieldMapping.Job.toString()}`] = 'job';
        fields[`ins_${this.spec.fieldMapping.URI.toString()}`] = item.identifier;
        const body = Object.keys(fields).map(key  => `${encodeURIComponent(key)}=${encodeURIComponent(fields[key])}`).join('&');

        const response = await this.apiCall({
          url,
          method: 'POST',
          user: this.spec.defaultUser,
          body
        });
        // console.log('Sent', body, 'To', url, 'Received', response);
        if ([400, 404, 409].indexOf(response.code) !== -1) {
          throw new Error(`${response.code} response from the Tiki API`);
        }
        return response.itemId;
      }
      case 'comment': {
        const url = this.getApiUrl('comment-create', undefined);
        const commentFields = {
          body: this.ensureOriHint((item.fields as { body: string }).body, item.identifier)
        };
        const commentReferences = item.references as { issue: string };
        const fields = {
          type: 'trackeritem',
          objectId: commentReferences.issue,
          post: 1,
          syntax: 'tiki',
          data: commentFields.body
        };
        const body = Object.keys(fields).map(key  => `${encodeURIComponent(key)}=${encodeURIComponent(fields[key])}`).join('&');
        const response = await this.apiCall({
          url,
          method: 'POST',
          user: this.spec.defaultUser,
          body
        });
        // console.log(response);
        if ([404, 409, 1000].indexOf(response.code) !== -1) {
          throw new Error(`${response.code} response from the Tiki API`);
        }
        // console.log('Sent', body, 'To', url, 'Received', response);
        if (typeof response.threadId === 'undefined') {
          throw new Error('Could not extract local identifier from create response!');
        }
        return response.threadId;
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
