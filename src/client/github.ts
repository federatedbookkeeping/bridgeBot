
import { Item } from "../model/Item";
import { Client } from "./client";


const DEFAULT_HTTP_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

const BASE_API_URL = `https://api.github.com/repos`;
const REL_API_PATH_ISSUES = `issues`;
const REL_API_PATH_COMMENTS = `comments`;

export type GitHubClientSpec = {
  // from generic ClientSpec
  name: string;
  type: string;
  //specific for GitHub
  tokens: {
    [user: string]: string;
  };
  defaultUser: string;
  repo: string;
};

export class GitHubClient extends Client {
  spec: GitHubClientSpec; // overwrites ClientSpec from parent class
  apiUrlIdentifierPrefix: string;
  constructor(spec: GitHubClientSpec) {
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
      case 'issue': return `${BASE_API_URL}/${this.spec.repo}/${REL_API_PATH_ISSUES}`;
      case 'comment': return `${BASE_API_URL}/${this.spec.repo}/${REL_API_PATH_ISSUES}/${filter!.issue}/${REL_API_PATH_COMMENTS}`;
    }
    throw new Error(`No API URL found for data type ${type}`);
  }
  translateItem(item: object, type: string): Item {
    console.log('translating', item, type);
    switch(type) {
      case 'issue':
        const ghItem = item as { number: number, title: string, body: string };
        return {
          type: 'issue',
          identifier: ghItem.number.toString(),
          deleted: false,
          fields: {
            title: ghItem.title,
            body: ghItem.body,
            completed: false
          }
        } as Item;
      break;
      case 'comment':
        const ghComment = item as { id: number, body: string, issue_url: string };
        return {
          type: 'comment',
          identifier: ghComment.id.toString(),
          deleted: false,
          fields: {
            body: ghComment.body
          },
          references: {
            issue: ghComment.issue_url.split('/').slice(-1)
          }
        } as Item;
      break;
    }
    throw new Error('cannot translate');
  }
  translateItemsResponse(itemsResponse: object[], type: string): Item[] {
    return itemsResponse.map(item => this.translateItem(item, type));
  }

  async getItemsOverNetwork(type: string, filter?: { issue: string }): Promise<Item[]> {
    console.log('GitHubClient#getItemsOverNetwork', type, filter);
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

  // async addIssue(user: string, issue: GitHubIssueAdd): Promise<string> {
  //   return this.remoteCreate(user, issue.repository_url + REL_API_PATH_ISSUES, issue);
  // }
  // async addComment(user: string, comment: GitHubCommentAdd): Promise<string> {
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
