# Flowroute JsSIP Client

Flowroute SIP over WebSocket and WebRTC JavaScript client.

It's actually is a facade for WebRTC, DOM and
[JsSIP APIs](https://jssip.net/documentation/3.3.x/api/) to easy development
of Flowroute applications on frontend.

## online demo
https://demo.webrtc.flowroute.com/fr.html?cache_invalidate=xxx

## Installation for usage

### NPM

Available on Node Package Manager: `npm install --save jssip_client`

### CDN

For a static script installation. Soon.

## Setting up core development environment

You'll only require `node` (+10.x.y) (if you haven't installed it yet, use [nvm](https://github.com/nvm-sh/nvm)). Then after clonning this repository, change directory to its
root and run once:

```
npm install
```

And after this, you probably will enjoy to see a demo app with hot reloading on your browser:

```
npm start
```

This demo HTML code is pretty simple and you can use it to further developing a frontend
application on any lib/framework (React, jQuery, Angular, Vue etc.) or even
vanilla JavaScript.

With the UI debugging console, you can see many of actions being dispatched by
the user agent and its calls, everything that is available to you.

## Examples of features

First, create an instance of Flowroute client. You can pass some optional
parameters to turn on the browser console SIP debugging and
handle every client actions. All available param keys are available on
constructor docstring (so if you use a mainstrain editor/IDE, it'll even
show them for you with descriptions). Remember that these parameters are
optional and you can make a call work without them, they'll be assigned
to default ones.

```js
const flowrouteClient = new FlowrouteClient({
  debug: true,
  onUserAgentAction: console.warn,
  intervalOfQualityReport: 5000,
  pointOfPresence: 'us-west-or',
});
```

Note that the example above is passing a param of QoS report. That's because
during this interval of milliseconds, a SIP MESSAGE will be sent with WebRTC
stats about the call RTC connection.

There's also a selected PoP, because many Flowroute PoPs are equiped with
WebSocket/WebRTC gateways. The preferred PoP and its related edge strategy
can be set using Flowroute APIs and the same ones are supported by this client,
is therefore possible for a customer to control where the media should be relayed to ensure we can avoid unnecessary media relay.

Some other common parameters are `callerId` and `password`.
Always check the docstring for the full list.

Having the client ready, you can start a connection with the signaling server
and invoke the SIP REGISTER:

```js
flowrouteClient.start();
```

After receiving the `{ type: 'registered' }` action on `onUserAgentAction` callback,
you're free to make calls. And it's simple as:

```js
flowrouteClient.call({
  to: '',
  onCallAction: console.warn,
});
```

As always, parameters are optionals (although you can consider this `to` a
required one, another approach is using `flowrouteClient.setDID` method before
this and here omitting  `to`). If you want, a `audioConstraints` parameter
is available so you can pick, for example, a selected audio output device id.

You can easily control player volume, from 0 (mutting it) to 100 (loudest):

```js
flowrouteClient.setOutputVolume(100);
```

During a call, you can get its instance and make actions with `JsSIP.RTCSession` API,
like sending DTMFs:

```js
flowrouteClient.getActiveCall().sendDTMF('4');
flowrouteClient.getActiveCall().sendDTMF('2');
```

## Technical debts so far

Feel free to contribute on this:
- answering calls
- unit tests
- polyfill for IE
- easy to download and use released script versions
