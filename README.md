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
$ lt --port 8000
your url is: https://grumpy-cobras-sniff.loca.lt
```
And then on configure webhooks `https://grumpy-cobras-sniff.loca.lt/{type}/{name}` to match your config.json
