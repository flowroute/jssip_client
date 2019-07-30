# Overview

This Javascript application is provided to be used as a WebRTC client for Flowroute.
It is configured to connect to Flowroute SIP over Websockets servers.

## fr.js (Flowroute jssip_client)

Although this Javascript library as not yet been thoroughly tested, it is provided as a working example on how to use JSSIP with Flowroute.

## fr.html

Is an example on how to integrate fr.js to a web site.

## Live demo

https://demo.webrtc.flowroute.com/fr.html?v=0.1.3


## Features 
WebRTC getstats() is used to produce QoS reports at regular intervals transmitted using SIP MESSAGE.
This report is not currently forwarded to our customers over SIP, this will be supported later and exposed using a feture flag.
In the mean time Flowroute will be able to find call quality information about calls made using our JSSIP_CLIENT. 

configuration setting example : every 5 seconds 
```
qos_report_interval: 5000 
```

Many Flowroute point or presences are now equiped with WebSocket/WebRTC gateways, the preferred PoP and its related edge strategy can be set using Flowroute APIs and the same prefered PoP concept is supported in our JSSIP_CLIENT, it
is therefore possible for a customer to control where the media should be relayed to ensure we can avoid unnecessary media relay.

configuration setting example : preffered point of presence set to us_east_va (AWS Northern Virginia) : 

```
pop: us_east_va 
```
