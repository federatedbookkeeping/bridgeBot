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
$ lt --port 8000 --subdomain quick-wolves-rescue
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
* see https://timesheet.dev4.evoludata.com/tiki-tabular-edit?tabularId=16 for an example