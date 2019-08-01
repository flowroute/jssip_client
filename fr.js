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

/**
 * @see https://jssip.net/documentation/3.3.x/api/
 */
export default class FlowrouteClient {
  constructor(params = {}) {
    this.params = {
      did: null,
      pointOfPresence: 'us-east-nj',
      callerId: 'anonymous',
      displayName: null,
      password: 'nopassword',
      extraHeaders: [],
      debug: false,
      onUserAgentAction: () => {},
      ...params,
    };

    const urls = FR_POINTS_OF_PRESENCE_DOMAINS[this.params.pointOfPresence];
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

    this.isRegistered = false;
    this.onCallAction = () => {};
    this.onUserAgentAction = this.params.onUserAgentAction;
    this.sipUserAgent = new UA({
      sockets,
      uri: `sip:${this.params.callerId}@wss.flowroute.com`,
      password: this.params.password,
      display_name: this.params.displayName,
    });

    this.sipUserAgent.on('newRTCSession', this.handleNewRTCSession.bind(this));

    this.sipUserAgent.on('registered', (payload) => {
      this.isRegistered = true;
      this.onUserAgentAction({ type: 'registered', payload });
    });

    const defaultAgentEventsToHandle = [
      'connecting',
      'connected',
      'disconnected',
      'unregistered',
      'registrationFailed',
      'registrationExpiring',
      'newMessage',
      'sipEvent',
    ];
    defaultAgentEventsToHandle.forEach((eventType) => {
      this.sipUserAgent.on(eventType, (payload) => {
        this.onUserAgentAction({ type: eventType, payload });
      });
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
    if (!this.isRegistered) {
      throw new Error('User agent not registered yet');
    }

    if (this.activeCall) {
      throw new Error('Already has active call');
    } else {
      this.activeCall = {};
    }

    const {
      to,
      onCallAction = () => {},
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

    this.onCallAction = onCallAction;
    this.sipUserAgent.call(`sip:${did}@sip.flowroute.com`, {
      mediaConstraints: { audio: true, video: false },
      extraHeaders: this.params.extraHeaders,
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

  handleNewRTCSession({ session }) {
    this.activeCall = session;
    const defaultCallEventsToHandle = [
      'peerconnection',
      'connecting',
      'sending',
      'progress',
      'accepted',
      'newDTMF',
      'newInfo',
      'hold',
      'unhold',
      'muted',
      'unmuted',
      'reinvite',
      'update',
      'refer',
      'replaces',
      'sdp',
      'icecandidate',
      'getusermediafailed',
    ];
    defaultCallEventsToHandle.forEach((eventType) => {
      session.on(eventType, (payload) => {
        this.onCallAction({ type: eventType, payload });
      });
    });

    session.on('confirmed', (payload) => {
      this.connectAudio(session);
      this.onCallAction({ type: 'confirmed', payload });
    });

    session.on('ended', (payload) => {
      this.disconnectAudio();
      this.onCallAction({ type: 'ended', payload });
    });

    session.on('failed', (payload) => {
      this.disconnectAudio();
      this.onCallAction({ type: 'failed', payload });
    });
  }
}

window.FlowrouteClient = FlowrouteClient;
