import { Item } from "../model/Item";
import { Issue } from "../model/issue";
import { Comment } from "../model/comment";
import { FetchCachingClient, FetchedItem, WebhookEventType } from "./client";

const DEFAULT_HTTP_HEADERS = {
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
  "X-GitHub-Api-Version": "2022-11-28",
};

const BASE_API_URL = `https://api.github.com/repos`;
const REL_API_PATH_ISSUES = `issues`;
const REL_API_PATH_COMMENTS = `comments`;

export type GitHubIssue = {
  number: number;
  title: string;
  body: string;
};

export type GitHubComment = {
  id: number;
  body: string;
  issue_url: string;
};

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

export type GitHubWebhookObject = {
  action: string;
  issue: GitHubIssue;
  comment?: GitHubComment;
  repository: object;
  sender: {
    login: string;
  };
};

export class GitHubClient extends FetchCachingClient {
  spec: GitHubClientSpec; // overwrites ClientSpec from parent class
  apiUrlIdentifierPrefix: string;
  constructor(spec: GitHubClientSpec) {
    super(spec);
    this.spec = spec;
    this.oriHintPrefix =`<!-- BridgeBot copy of `;
    this.oriHintSuffix = ` -->\n`;
  }
  getType(): string {
    return "github";
  }
  parseWebhookData(data: GitHubWebhookObject): {
    type: WebhookEventType;
    item: FetchedItem;
  } {
    console.log("parsing in client");
    switch (data.action) {
      case "opened": {
        return {
          type: WebhookEventType.Created,
          item: this.translateGhItem(data.issue, "issue"),
        };
      }
      case "closed": {
        return {
          type: WebhookEventType.Deleted,
          item: this.translateGhItem(data.issue, "issue"),
        };
      }
      case "created": {
        return {
          type: WebhookEventType.Created,
          item: this.translateGhItem(data.comment!, "comment"),
        };
      }
      case "edited": {
        let item: FetchedItem;
        if (typeof data.comment === "undefined") {
          item = this.translateGhItem(data.issue, "issue");
        } else {
          item = this.translateGhItem(data.comment!, "comment");
        }
        return {
          type: WebhookEventType.Updated,
          item,
        };
      }
      case "deleted": {
        let item: FetchedItem;
        if (typeof data.comment === "undefined") {
          item = this.translateGhItem(data.issue, "issue");
        } else {
          item = this.translateGhItem(data.comment!, "comment");
        }
        return {
          type: WebhookEventType.Deleted,
          item,
        };
      }

      default: {
        throw new Error('Could not parse Webhook Body!');
        // return {
        //   type: WebhookEventType.Deleted,
        //   item: {} as FetchedItem,
        // };
      }
    }
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
    switch (type) {
      case "issue":
        return `${BASE_API_URL}/${this.spec.repo}/${REL_API_PATH_ISSUES}`;
      case "comment":
        return `${BASE_API_URL}/${this.spec.repo}/${REL_API_PATH_ISSUES}/${
          filter!.issue
        }/${REL_API_PATH_COMMENTS}`;
    }
    throw new Error(`No API URL found for data type ${type}`);
  }
  mintOri(type: string, local: string, filter?: { issue: string }): string {
    switch (type) {
      case "issue":
        return `${this.getApiUrl("issue")}/${local}`;
      case "comment":
        return `${this.getApiUrl("issue")}/comments/${local}`;
      default:
        throw new Error(`Don't know how to mint ORI for item type ${type}`);
    }
  }

  toGitHubIssue(issue: Issue) {
    const body = this.ensureOriHint(issue.fields.body, issue.identifier);
    return {
      title: issue.fields.title,
      body,
    };
  }
  toGitHubComment(comment: Comment) {
    const body = this.ensureOriHint(comment.fields.body, comment.identifier);
    return {
      body,
    };
  }

  translateGhItem(item: object, type: string): FetchedItem {
    // console.log('translating', item, type);
    switch (type) {
      case "issue": {
        const ghIssue = item as GitHubIssue;
        return {
          type: "issue",
          localIdentifier: ghIssue.number.toString(),
          hintedIdentifier: this.getOriHint(ghIssue.body),
          mintedIdentifier: this.mintOri(type, ghIssue.number.toString()),
          deleted: false,
          fields: {
            title: ghIssue.title,
            body: this.removeOriHint(ghIssue.body),
            completed: false,
          },
          localReferences: {},
        } as FetchedItem;
      }
      case "comment": {
        const ghComment = item as GitHubComment;
        const localReferences = {
          issue: ghComment.issue_url.split("/").slice(-1)[0],
        };
        return {
          type: "comment",
          localIdentifier: ghComment.id.toString(),
          hintedIdentifier: this.getOriHint(ghComment.body),
          mintedIdentifier: this.mintOri(
            type,
            ghComment.id.toString(),
            localReferences
          ),
          deleted: false,
          fields: {
            body: this.removeOriHint(ghComment.body),
          },
          localReferences,
        } as FetchedItem;
      }
    }
    throw new Error("cannot translate");
  }
  translateItemsWireResponse(itemsWireResponse: object[], type: string): FetchedItem[] {
    return itemsWireResponse.map((item) => this.translateGhItem(item, type));
  }

  async getItemsOverNetwork(
    type: string,
    filter?: { issue: string }
  ): Promise<Item[]> {
    console.log("GitHubClient#getItemsOverNetwork", type, filter);
    return this.apiCall({
      url: this.getApiUrl(type, filter),
      method: "GET",
      user: this.spec.defaultUser,
    });
  }

  async remoteCreate(user: string, url: string, data: object): Promise<string> {
    console.log("remoteCreate", user, url);
    const args = {
      user,
      url,
      method: "POST",
      body: JSON.stringify(data, null, 2),
    };
    const response = (await this.apiCall(args)) as { id: number };
    console.log("remoteCreate response", response);
    return response.id.toString();
  }

  async createItem(item: Item): Promise<string> {
    switch (item.type) {
      case "issue": {
        const issue = item as Issue;
        console.log("createItem awaits remoteCreate for issue");
        const result = await this.remoteCreate(
          this.spec.defaultUser,
          this.getApiUrl("issue"),
          this.toGitHubIssue(issue)
        );
        console.log("createItem result for issue", result);
        return result;
      }
      case "comment": {
        const comment = item as Comment;
        console.log("createItem awaits remoteCreate for comment", comment);
        const result = await this.remoteCreate(
          this.spec.defaultUser,
          this.getApiUrl("comment", item.references as { issue: string }),
          this.toGitHubComment(comment)
        );
        console.log("createItem result for comment", result);
        return result;
      }
      default:
        throw new Error(`Unknown item type ${item.type}`);
    }
  }
  async updateItem(type: string, id: string, fields: object): Promise<void> {}
  async deleteItem(type: string, id: string): Promise<void> {}
}
