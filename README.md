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

Also, on https://taskifier.heroku.com we're setting up ./server.js which will process webhook calls
