import 'webrtc-adapter';
import first from 'lodash.first';
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

  on(event, callback) {
    if (event === 'newRTCSession') {
      throw new Error('Do not override client "newRTCSession" callback');
    }

    this.sipUserAgent.on(event, callback);
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

  setAudioElement(domNode) {
    if (domNode === undefined) {
      const created = document.createElement('audio');
      this.audioPlayerElement = created;
    } else if (typeof domNode === 'string') {
      const found = document.querySelector(domNode);
      if (!found || found.tagName.toLowerCase() !== 'audio') {
        throw new Error('Invalid DOM selector provided for audio element');
      }

      this.audioPlayerElement = found;
    } else {
      this.audioPlayerElement = domNode;
    }

    this.audioPlayerElement.defaultMuted = false;
    this.audioPlayerElement.autoplay = true;
    this.audioPlayerElement.controls = true;
  }

  connectAudio(session) {
    if (this.audioPlayerElement) {
      this.disconnectAudio();
    } else {
      throw new Error('Tried to connect audio but no player element provided');
    }

    const remoteStreams = session.connection.getRemoteStreams();
    this.audioPlayerElement.srcObject = first(remoteStreams);
  }

  disconnectAudio() {
    if (!this.audioPlayerElement || !this.audioPlayerElement.srcObject) {
      return;
    }

    this.audioPlayerElement.srcObject.getTracks().forEach(track => track.stop());
    this.audioPlayerElement.srcObject = null;
  }

  setDID(did) {
    if (typeof did !== 'string') {
      throw new Error('Expected DID to be a string');
    } else if (did.length !== 11) {
      throw new Error('Currently only DIDs with 11 length are supported');
    }

    this.params = { ...this.params, did };
  }

  call(options = {}) {
    if (this.activeCall) {
      throw new Error('Already has active call');
    } else {
      this.activeCall = {};
    }

    const {
      to,
      onStateChange = () => {},
    } = options;

    const did = this.params.did || to;
    if (did) {
      this.setDID(did);
    } else {
      throw new Error('No DID provided');
    }

    if (!this.audioPlayerElement) {
      this.setAudioElement();
    }

    this.sipUserAgent.on('newRTCSession', ({ session }) => {
      this.activeCall = session;

      session.on('started', (payload) => {
        this.connectAudio(session);
        onStateChange({ type: 'started', payload });
      });

      session.on('progress', (payload) => {
        onStateChange({ type: 'progress', payload });
      });

      session.on('ended', (payload) => {
        this.disconnectAudio();
        onStateChange({ type: 'ended', payload });
      });

      session.on('accepted', (payload) => {
        onStateChange({ type: 'accepted', payload });
      });

      session.on('confirmed', (payload) => {
        this.connectAudio(session);
        onStateChange({ type: 'confirmed', payload });
      });

      session.on('failed', (payload) => {
        this.disconnectAudio();
        onStateChange({ type: 'failed', payload });
      });
    });

    this.sipUserAgent.call(`sip:${did}@sip.flowroute.com`, {
      mediaConstraints: { audio: true, video: false },
      extraHeaders: this.params.xheaders,
      RTCConstraints: {
        optional: [
          { DtlsSrtpKeyAgreement: 'true' },
        ],
      },
      sessionTimersExpires: 600,
    });
  }

  hangup() {
    if (!this.activeCall) {
      throw new Error('There is no active call to hangup');
    }

    this.activeCall.terminate();
    this.activeCall = null;
  }
}

window.FlowrouteClient = FlowrouteClient;
