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