import 'webrtc-adapter';
import first from 'lodash.first';
import { UA, WebSocketInterface, debug } from 'jssip/lib/JsSIP';
import QualityOfService from './QualityOfService';


/**
 * Flowroute SIP over WebSocket and WebRTC JavaScript client.
 *
 * This class is a facade for WebRTC, DOM and JsSIP APIs,
 * so it'll return many of its types and dispatch many of
 * its events, with some changes to ease Flowroute apps work.
 *
 * @see https://jssip.net/documentation/3.3.x/api/
 */
export default class FlowrouteClient {
  /**
   * Init a JsSIP user agent.
   *
   * @param {object}   params
   * @param {string}   params.pointOfPresence one of `FR_POINTS_OF_PRESENCE_DOMAINS` array
   * @param {string}   params.callerId caller ID for building user agent URI
   * @param {string}   params.displayName to be used on calls params
   * @param {string}   params.password to be used on calls params
   * @param {boolean}  params.debug will output to stdout JsSIP debugging logs
   * @param {function} params.onUserAgentAction general callback for UA events and its payloads
   * @param {function} params.intervalOfQualityReport in milliseconds
   */
  constructor(params = {}) {
    this.params = {
      pointOfPresence: [],
      callerId: 'anonymous',
      sip:'sip.flowroute.com',
      displayName: 'Flowroute Client Demo',
      password: 'nopassword',
      extraHeaders: [],
      debug: false,
      intervalOfQualityReport: undefined,
      onUserAgentAction: () => {},
      ...params,
    };

    let weight =0
    const sockets=[]
    this.params.pointOfPresence.map((url)=>{
       sockets.push(   {
         socket: new WebSocketInterface(`wss://${url}`),
         weight: weight+= 10,
       })

    })

    this.micMuted = false;
    this.isHolding = false;
    this.qualityOfServiceEmitter = null;
    this.outputVolume = 1;
    this.isRegistered = false;
    this.onCallAction = () => {};
    this.onUserAgentAction = this.params.onUserAgentAction;
    this.sipUserAgent = new UA({
      sockets,
      uri: `sip:${this.params.callerId}@${this.params.sip}`,
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
    } else if (did.length <= 2) {
      throw new Error('Currently only DIDs with more than 2 length are supported');
    }

    this.params = { ...this.params, did };
  }

  /**
   * Make a call.
   * Also initialize any necessary DOM node for audio output.
   * Created call will be available by `getActiveCall` getter method.
   *
   * @param {object}        options
   * @param {string}        options.to number destiny
   * @param {function}      options.onCallAction callback for call events and its payloads
   * @param {object|string} options.audioConstraints callback for call events and its payloads
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

    const did = to || this.params.did;
    if (did) {
      this.setDID(did);
    } else {
      throw new Error('No DID provided');
    }

    if (!this.audioPlayerElement) {
      this.setAudioElement();
    }

    this.onCallAction = onCallAction;
    this.params.extraHeaders.push('P-BUA:' + navigator.userAgent);
    this.sipUserAgent.call(`sip:${did}@${this.sip}`, {
      mediaConstraints: { audio: options.audioConstraints || true, video: false },
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
   * Getter of active call, i.e., a proxy for current RTC JsSIP session.
   *
   * If a call attempt was made but no "newRTCSession" user agent event
   * was dispatched, then this should be `{}`, which is still a truthy JS object
   * but with no available RTC methods to proxy. And while no call is made or the
   * previous one was already hung up or failed, this should be the falsy `null`.
   *
   * When desired to hangup the session call, use `hangup` client method
   * instead of directly terminating this returned session.
   *
   * @return {RTCSession|object}
   */
  getActiveCall() {
    return this.activeCall;
  }

  /**
   * Hangup current active call and unassign it.
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
   * Set microphone mute.
   *
   * @param {boolean} value if microphone must be muted
   */
  setMicMuted(value) {
    if (value) {
      this.micMuted = true;
      if (this.activeCall) this.activeCall.mute();
    } else {
      this.micMuted = false;
      if (this.activeCall) this.activeCall.unmute();
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
   * Puts the other side of the call on hold.
   *
   * If hold fails, the call might end.
   *
   * @param {boolean} value boolean for if peer must hold the session.
   */
  setHold(value) {
    if (!this.activeCall) {
      return;
    }

    this.isHolding = value;
    if (value) {
      this.activeCall.hold();
    } else {
      this.activeCall.unhold();
    }
  }

  /**
   * @return {boolean} if this peer is holding the other side
   * (but unaware if other side had put this peer on hold).
   */
  isHolding() {
    return this.isHolding;
  }

  /**
   * Make a blind transfer to another extension.
   *
   * @param {string} destination extension as target
   */
  transfer(destination) {
    if (!this.activeCall) {
      return;
    }

    this.activeCall.refer(destination);
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
   * Get a reference of P-headers passed by `pushExtraPrivateCallHeader` method.
   *
   * @return {array}
   */
  getExtraCallHeaders() {
    return this.params.extraHeaders;
  }

  /**
   * On the current active call, send DTMFs over RTP.
   * It'll trigger a custom "sentRtpDTMF" call event type.
   *
   * If you want to send DTMFs as SIP INFO message, then
   * use `this.getActiveCall().sendDTMF(tone)` instead, so it'll
   * trigger regular JsSIP event types.
   *
   * @param {string|number} tone as a valid DTMF digit
   * @param {number?} duration in ms, defaults to 100ms
   */
  sendRtpDTMF(tone, duration = 100) {
    const { activeCall } = this;
    if (!activeCall) {
      throw new Error('No call instance available for sending DTMFs.');
    }

    const realtimeAudioSender = first(activeCall.connection.getSenders());
    if (!realtimeAudioSender) {
      throw new Error('Failed to get an instance of RTP track sender for this call.');
    }

    realtimeAudioSender.dtmf.insertDTMF(tone, duration);
    this.onCallAction({ type: 'sentRtpDTMF', payload: { tone, duration } });
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
  handleNewRTCSession(rtcPayload) {
    const { session, request } = rtcPayload;
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

    this.qualityOfServiceEmitter = new QualityOfService(
      this.sipUserAgent,
      session.connection,
      request.call_id,
      this.sip,
      this.did,
      this.params.intervalOfQualityReport,
      this.params.debug,
    );
    this.onUserAgentAction({ type: 'newRTCSession', payload: rtcPayload });
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
    this.qualityOfServiceEmitter.start();
    this.setMicMuted(this.micMuted);
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
    this.qualityOfServiceEmitter.stop();
  }
}

window.FlowrouteClient = FlowrouteClient;
