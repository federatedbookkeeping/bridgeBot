# bridgeBot
Bot that can bridge between two or more APIs in a way that allows data federation

```
npm install
npm run build
cp config.example.json config.json
# edit the issue trackers you want to federate
# and credentials for accessing their APIs
npm run sync
```
In a separate window:
```
$ npm install -g localtunnel
$ while true; do lt --port 8000 --subdomain quick-wolves-rescue; sleep 2; done
your url is: https://grumpy-cobras-sniff.loca.lt
```
And then on configure webhooks `https://grumpy-cobras-sniff.loca.lt/{type}/{name}` to match your config.json


Configuring your Tiki Tracker:
* create a tracker some fields
* check which column numbers were assigned and add the mapping for them to your config.json
* create an import/export tabular for it
* check the 'External API source' checkbox
* configure URLs like https://dull-chicken-follow.loca.lt/tiki/copy/item/create for list/create/update/delete
* check the 'Synchronize comments?' checkbox
* choose 'Data Format': JSON
* see https://timesheet.dev4.evoludata.com/tiki-tabular-edit?tabularId=16 for an example
* Go to Tracker 3 -> Properties -> Remote Synchronization and choose the new tabular

Configuring your Github webhooks:
* go to e.g. https://github.com/federatedbookkeeping/github-dxos/settings/hooks
* payload URL https://quick-wolves-rescue.loca.lt/github/tracker-name
* Content type application/json
* Let me select individual events
  * Issues
  * Issue Comments
* Active: yes
* Update webhook

## Learnings
### Software Architecture
There is a central data store, and one Bridge per connected task tracker.
The bridge uses a Client of the appropriate type (a TikiCient or a GithubClient).
There are models for Issue and Comment, both inherit from Item.
In the clients, there are translated types for both.
The Client is as minimal as possible, all the sync logic is in the Bridge and the Client only executes API calls.
The Server listens for webhook POSTs.

### Cambria
We investigated the use of Cambria and decided against it, since it only maps fields and not identifiers.
For GitHub we do the field mapping in a simple small method on the client, it's really only a few lines of
code and not worth the additional dependency.

When programming the Tiki client though, we did run into a rather more complex situation, since each issue
tracker can have its own API field names, and the ones for the webhook can even be different from the API ones,
so this leads to quite a bit of mapping in the config as you can see in ./config.example.json.

Also, while programming it became apparent that programming across independent systems would benefit from more
abstraction than programming within one system. For instance, after a fetch, each fetched item should be stored
in the local data store, and maybe also be pushed to the other bridges, and same for when a webhook call comes in.

The current code does this in a procedural way, and although I was able to apply some code reuse, putting all the
translations in place in these procedural call stacks still did feel like the 'hailshot programming' that Cambria
tries to fix, so there is definitely some room there for further research, and for bigger projects, a tool like Cambria
would probably start making sense (even though it would need to be combined with an LRI map to be useful).

### LRI Map
The Local Resource Identifier mapping we designed in milestone 1 worked out very well. We did find that being able to
wipe the local data store and restart sync was very useful, especially when developing and debugging, to make sure no
data from previous (buggy) formats lingers around that can mess up the new test run. Therefore, we tried to store the
Original Resource Identifier (ORI) in each copy in each system. In particular, we implemented
three types of identifiers for items in a bridge: local, hinted and minted. Hinted is the stored ORI, which could be:
* the URI field in a Tiki tracker item
* A HTML comment in the body of a GitHub item
* A Wiki-formatted comment in the body of a Tiki tracker comment
* A HTML comment in the body of a GitHub comment

Minted is a standard template to go from local to universal, for instance from the local '36' you could mint
the universal 'https://github.com/federatedbookkeeping/github-dxos/issues/'.

It later appeared that in a next version of this software we might be able to keep the 'local' identifiers inside the Client
code and only expose minted and hinted.

In the central data store, only Original Resource Identifiers are used, and the LRI map then translates between original and local
for each bridge.

### DXOS
We tried using DXOS but ran into various documentation issues and then decided to use an in-memory data store instead, persisted
to a JSON file.

### Development process
All API call responses are cached to disk. This makes it easy to rerun a sync many times without making many real API calls over
the internet. It also makes it easy to inspect the values of what went over the wire and what ended up in the data store.

It's easy to wipe out the `./data` folder to trigger a fresh network fetch.

It's also easy to edit the config.json file to include one or both Tiki trackers and one or both Github trackers, to perform various
experiments.

What we should have done sooner was write proper error handling for unsuccessful API responses, as well as when a value is undefined.

Another thing that took us some time to figure out was how to configure Tiki (see documentation above), and the fact that Tiki will fail
to do anything (GUI or API) if a webhook is configured but not responding. Therefore we created `npm start` which just listens to the
webhook URL, logs what comes in, and then ignores it. Having this running is essential to be able to do anything on Tiki without disabling
the webhook.

It also took a while to figure out that you can pass a `--subdomain` flag to localtunnel, and that you need to restart it after failure.
Having it running in a loop and with that flag eliminated a hard-to-debug cause of errors, and gave us a development speed-up.


## Work Report
This repository is the end-deliverable of milestone 3e of the NLnet-funded "Federated Task Tracking with Live Data" project and together
with the earlier cambria-dxos-based experiment preceding this one, encompassed 60 hours worked by Michiel de Jong.

This work was done in close collaboration with Victor Emanouilev, who was working on the Tiki side, and will separately claim his hours
worked under milestone 3a of the same project.