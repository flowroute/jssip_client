import 'webrtc-adapter';
import { UA, WebSocketInterface, debug } from 'jssip';

const FR_POINTS_OF_PRESENCE_DOMAINS = {
  'us-east-nj': [
    'staging-ep-us-west-or-01.fl.gg',
    'preprod-ep-us-east-nj-01.fl.gg',
  ],
  'us-west-or': [
    'preprod-ep-us-east-nj-01.fl.gg',
    'staging-ep-us-west-or-01.fl.gg',
  ],
};

export default class FlowrouteClient {
  constructor(params = {}) {
    this.params = {
      did: null,
      pop: 'us-east-nj',
      callerid: 'anonymous',
      display_name: null,
      password: 'nopassword',
      xheaders: [],
      debug: false,
      user_mic_muted: false,
      user_volume: 50,
      ...params,
    };

    const urls = FR_POINTS_OF_PRESENCE_DOMAINS[this.params.pop];
    const sockets = [
      {
        socket: new WebSocketInterface(`wss://${urls[0]}:4443`),
        weight: 10,
      },
      {
        socket: new WebSocketInterface(`wss://${urls[1]}:4443`),
        weight: 10,
      },
    ];

    this.sipUserAgent = new UA({
      sockets,
      uri: `sip:${this.params.callerid}@wss.flowroute.com`,
      password: this.params.password,
      display_name: this.params.display_name,
    });
  }

  start() {
    if (this.params.debug) {
      debug.enable('JsSIP:*');
    } else {
      debug.disable('JsSIP:*');
    }

    this.sipUserAgent.start();
  }

  restart() {
    this.sipUserAgent.stop();
    this.sipUserAgent.start();
  }
}

window.FlowrouteClient = FlowrouteClient;
