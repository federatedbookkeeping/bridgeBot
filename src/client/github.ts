import { Item } from "../model/Item";
import { Issue } from "../model/issue";
import { Comment } from "../model/comment";
import { FetchCachingClient, FetchedItem } from "./client";

const ORI_HINT_PREFIX = `<!-- BridgeBot copy of `;
const ORI_HINT_SUFFIX = ` -->\n`;

const DEFAULT_HTTP_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

const BASE_API_URL = `https://api.github.com/repos`;
const REL_API_PATH_ISSUES = `issues`;
const REL_API_PATH_COMMENTS = `comments`;

export type GitHubIssue = {
  number: number,
  title: string,
  body: string
}

export type GitHubComment = {
    id: number,
    body: string,
    issue_url: string
}

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

export class GitHubClient extends FetchCachingClient {
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
    switch(type) {
      case 'issue': return `${this.getApiUrl('issue')}/${local}`;
      case 'comment': return `${this.getApiUrl('issue')}/comments/${local}`;
      default: throw new Error(`Don't know how to mint ORI for item type ${type}`);
    }
  }
  ensureOriHint(body: string, ori: string) {
    const hint = ORI_HINT_PREFIX + ori + ORI_HINT_SUFFIX;
    if (body.startsWith(hint)) {
      return body;
    }
    return hint + body;
  }
  parseOriHint(body: string | null): { hint: string | null, rest: string } {
    if (body === null) {
      return { hint: null, rest: '' };
    }
    if (!body.startsWith(ORI_HINT_PREFIX)) {
      console.log('ORI Hint Prefix not found', body);
      return { hint: null, rest: body };
    }
    const rest = body.substring(ORI_HINT_PREFIX.length);
    const start = rest.indexOf(ORI_HINT_SUFFIX);
    if (start === -1) {
      console.log(`ORI Hint Suffix not found in body "${body.substring(0, 100)}..."`);
      return  { hint: null, rest: body };
    }
    const result = rest.substring(0, start);
    console.log('Parsed ORI Hint', result, body);
    return { hint: result, rest: rest.substring(start + ORI_HINT_PREFIX.length) };
  }
  getOriHint(body: string | null): string | null {
    const parsed = this.parseOriHint(body);
    return parsed.hint;
  }
  removeOriHint(body: string | null): string {
    const parsed = this.parseOriHint(body);
    return parsed.rest;
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
      case "issue":
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
          localReferences: {}
        } as FetchedItem;
        break;
      case "comment":
        const ghComment = item as GitHubComment;
        const localReferences = {
          issue: ghComment.issue_url.split("/").slice(-1)[0]
        };
        return {
          type: "comment",
          localIdentifier: ghComment.id.toString(),
          hintedIdentifier: this.getOriHint(ghComment.body),
          mintedIdentifier: this.mintOri(type, ghComment.id.toString(), localReferences),
          deleted: false,
          fields: {
            body: this.removeOriHint(ghComment.body),
          },
          localReferences,
        } as FetchedItem;
        break;
    }
    throw new Error("cannot translate");
  }
  translateItemsResponse(itemsResponse: object[], type: string): FetchedItem[] {
    return itemsResponse.map((item) => this.translateGhItem(item, type));
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
    console.log('remoteCreate response', response);
    return response.id.toString();
  }

  async createItem(item: Item): Promise<string> {
    switch (item.type) {
      case "issue": {
        const issue = item as Issue;
        console.log('createItem awaits remoteCreate for issue');
        const result = await this.remoteCreate(
          this.spec.defaultUser,
          this.getApiUrl("issue"),
          this.toGitHubIssue(issue)
        );
        console.log('createItem result for issue', result);
        return result;
      }
      case "comment": {
        const comment = item as Comment;
        console.log('createItem awaits remoteCreate for comment', comment);
        const result = await this.remoteCreate(
          this.spec.defaultUser,
          this.getApiUrl("comment", item.references as { issue: string }),
          this.toGitHubComment(comment)
        );
        console.log('createItem result for comment', result);
        return result;
      }
      default:
        throw new Error(`Unknown item type ${item.type}`);
    }
  }
  async updateItem(type: string, id: string, fields: object): Promise<void> {}
  async deleteItem(type: string, id: string): Promise<void> {}
}
