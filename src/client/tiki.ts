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
    console.log('translating', item, type);
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
    console.log('TikiClient#getItemsOverNetwork', type, filter);
    return this.apiCall({ url: this.getApiUrl(type, filter), method: "GET", user: this.spec.defaultUser });
  }

  // async remoteCreate(user: string, url: string, data: object): Promise<string> {
  //   console.log('remoteCreate', user, url);
  //   const args = {
  //     user,
  //     url,
  //     method: "POST",
  //     body: JSON.stringify(data, null, 2),
  //   };
  //   const response = (await this.apiCall(args)) as { id: number };
  //   // console.log(response);
  //   return response.id.toString();
  // }

  // async addIssue(user: string, issue: TikiIssueAdd): Promise<string> {
  //   return this.remoteCreate(user, issue.repository_url + REL_API_PATH_ISSUES, issue);
  // }
  // async addComment(user: string, comment: TikiCommentAdd): Promise<string> {
  //   return this.remoteCreate(user, comment.issue_url + REL_API_PATH_COMMENTS, comment);
  // }

  // async addItem(user: string, fields: object): Promise<string> {
  //   if (item.type === "issue") {
  //     return this.addIssue(user, {
  //       repository_url: this.spec.trackerUrl,
  //       title: (item as Issue).title,
  //       body: (item as Issue).body,
  //     });
  //   }
  //   if (item.type === "comment") {
  //     const issueUrlCandidates = this.dataStore.issueIdToIssueIds(
  //       (item as Comment).issueId
  //     );
  //     console.log(`found issue url candidate for ${(item as Comment).issueId}`, issueUrlCandidates);
  //     for (let i = 0; i < issueUrlCandidates.length; i++) {
  //       if (issueUrlCandidates[i].startsWith(this.apiUrlIdentifierPrefix)) {
  //         return this.addComment(user, {
  //           issue_url: issueUrlCandidates[i].substring(API_URL_ID_SCHEME.length),
  //           body: (item as Comment).body,
  //         });
  //       }
  //     }
  //     throw new Error('cannot post comment if issue doesnt exist');
  //   }
  //   throw new Error(`Unknown item type ${item.type}`);
  // }

  // async upsert(user: string, item: Item): Promise<string | undefined> {
  //   let ghApiUrl: string | undefined = item.identifiers.find((x: string) =>
  //     x.startsWith(this.apiUrlIdentifierPrefix)
  //   );
  //   console.log('no identifier found with prefix', this.apiUrlIdentifierPrefix);
  //   if (typeof ghApiUrl === "undefined") {
  //     const itemUrl = await this.addItem(user, item);
  //     return `${API_URL_ID_SCHEME}:${itemUrl}`;
  //   }
  // }

  // async handleOperation(operation: Operation) {
  //   switch (operation.operationType) {
  //     case "upsert":
  //       const item = operation.fields as Item;
  //       const additionalIdentifier: string | undefined = await this.upsert(this.spec.defaultUser, item);
  //       console.log('additional identifier came back from upsert', additionalIdentifier);
  //       if (typeof additionalIdentifier === 'string') {
  //         this.dataStore.addIdentifier(item.identifiers[0], additionalIdentifier);
  //       }
  //       break;
  //     case "merge":
  //       // not implemented yet
  //       break;
  //     case "fork":
  //       // not implemented yet
  //       break;
  //     default:
  //       console.error("unknown operation type", operation);
  //   }
  // }

  async createItem(type: string, fields: object): Promise<string> {
    // const itemUrl = await this.addItem(this.spec.defaultUser, fields);
    //   return `${API_URL_ID_SCHEME}:${itemUrl}`;
    return '';
  }
  async updateItem(type: string, id: string, fields: object): Promise<void> {
  }
  async deleteItem(type: string, id: string): Promise<void> {
  }
}
