import 'webrtc-adapter';
import first from 'lodash.first';
import { UA, WebSocketInterface, debug } from 'jssip';

export const FR_POINTS_OF_PRESENCE_DOMAINS = {
  'us-east-nj': [
    'staging-ep-us-west-or-01.fl.gg',
    'preprod-ep-us-east-nj-01.fl.gg',
  ],
  'us-west-or': [
    'wr-us-west-or-01.webrtc.flowroute.com',
    'wr-us-east-va-01.webrtc.flowroute.com',
  ],
  'us-east-va': [
    'wr-us-east-va-01.webrtc.flowroute.com',
    'wr-us-west-or-01.webrtc.flowroute.com',
  ],
};

/**
 * Flowroute SIP over WebSocket and WebRTC JavaScript client.
 *
 * This class is a facade for JsSIP API, so it'll return many
 * of its types and dispatch many of its events, with some
 * changes to ease a Flowroute client implementation.
 *
 * @see https://jssip.net/documentation/3.3.x/api/
 */
export default class FlowrouteClient {
  /**
   * Init a JsSIP user agent.
   *
   * @param {object} params
   */
  constructor(params = {}) {
    this.params = {
      did: null,
      pointOfPresence: 'us-west-or',
      callerId: 'anonymous',
      displayName: 'Flowroute Client Demo',
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

    this.outputVolume = 1;
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

  /**
   * Connect to the signaling server, registering user agent.
   */
  start() {
    if (this.params.debug) {
      debug.enable('JsSIP:*');
    } else {
      debug.disable('JsSIP:*');
    }

    this.sipUserAgent.start();
  }

  /**
   * Disconnect from signaling server.
   */
  stop() {
    this.sipUserAgent.stop();
  }

  /**
   * Set to what number this client will call.
   * (You may pass this by `call` method args too.)
   *
   * @param {string} did
   */
  setDID(did) {
    if (typeof did !== 'string') {
      throw new Error('Expected DID to be a string');
    } else if (did.length !== 11) {
      throw new Error('Currently only DIDs with 11 length are supported');
    }

    this.params = { ...this.params, did };
  }

  /**
   * Make a call.
   * Also initialize any necessary DOM node for audio output.
   * Created call will be available as `activeCall` attribute,
   * that is just a `RTCSession` instance.
   *
   * @param {object}   options
   * @param {string}   options.to number destiny
   * @param {function} options.onCallAction callback for call actions
   */
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

  /**
   * Hangup current `activeCall` and unassign it.
   */
  hangup() {
    if (!this.activeCall) {
      throw new Error('There is no active call to hangup');
    }

    this.activeCall.terminate();
    this.activeCall = null;
  }

  /**
   * Set audio player volume.
   *
   * @param {number|string} value between 0 and 100
   */
  setOutputVolume(value) {
    const volume = parseInt(value, 10) / 100;
    if (volume < 0) {
      this.outputVolume = 0;
    } else if (volume > 1) {
      this.outputVolume = 1;
    } else {
      this.outputVolume = volume;
    }

    if (this.audioPlayerElement) {
      this.audioPlayerElement.volume = this.outputVolume;
    }
  }

  /**
   * Get audio player volume.
   *
   * @return {number} between 0 and 100
   */
  getOutputVolume() {
    return this.outputVolume * 100;
  }

  /**
   * Add a P-header to client calls.
   *
   * @param {string} name
   * @param {string} value
   */
  pushExtraPrivateCallHeader(name, value) {
    if (!name || !value) {
      throw new Error('Provide name and value for adding P-header');
    }

    this.params.extraHeaders.push(`P-${name}: ${value}`);
  }

  /**
   * Get a reference of `params.extraHeaders` attribute, including
   * new ones passed by `pushExtraPrivateCallHeader` method.
   *
   * @return {array}
   */
  getExtraCallHeaders() {
    return this.params.extraHeaders;
  }

  /**
   * @private
   */
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
    this.audioPlayerElement.volume = this.outputVolume;
  }

  /**
   * @private
   */
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
      this.activeCall = null;
      this.onCallAction({ type: 'ended', payload });
    });

    session.on('failed', (payload) => {
      this.disconnectAudio();
      this.activeCall = null;
      this.onCallAction({ type: 'failed', payload });
    });
  }

  /**
   * @private
   */
  connectAudio(session) {
    if (this.audioPlayerElement) {
      this.disconnectAudio();
    } else {
      throw new Error('Tried to connect audio but no player element provided');
    }

    const remoteStreams = session.connection.getRemoteStreams();
    this.audioPlayerElement.srcObject = first(remoteStreams);
  }

  /**
   * @private
   */
  disconnectAudio() {
    if (!this.audioPlayerElement || !this.audioPlayerElement.srcObject) {
      return;
    }

    this.audioPlayerElement.srcObject.getTracks().forEach(track => track.stop());
    this.audioPlayerElement.srcObject = null;
  }
}

window.FlowrouteClient = FlowrouteClient;
