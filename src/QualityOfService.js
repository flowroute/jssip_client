
/**
 * Proxy and emitter of RTC connection and media quality.
 */
export default class QualityOfService {
  /**
   * Client for gathering RTC stats and sending as SIP message.
   *
   * @param {UA} sipUserAgent
   * @param {RTCPeerConnection} realtimeSessionConnection
   * @param {string} callId
   * @param {sting} did
   * @param {number} interval
   */
  constructor(sipUserAgent, realtimeSessionConnection, callId, did, interval) {
    this.sipUserAgent = sipUserAgent;
    this.realtimeSessionConnection = realtimeSessionConnection;
    this.callId = callId;
    this.did = did;
    this.interval = (interval && interval > 1000 && interval < 60000) ? interval : 5000;
    this.realtimeProtocolReceiverData = null;
    this.realtimeProtocolTransmitterData = null;
    this.mediaReceiverData = null;
    this.mediaTransmitterData = null;
    this.isActive = false;
    this.version = '0.0.1';
  }

  /**
   * Start gathering RTC connection stats and send them on each `interval` of milliseconds.
   */
  start() {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.keepGatheringStats();
  }

  /**
   * Stop gathering RTC connection stats, nor send them.
   */
  stop() {
    this.isActive = false;
  }

  /**
   * @private
   */
  addStat(data) {
    const { id } = data;
    if (id) {
      if (id.includes('inbound_rtp_audio') || id.includes('RTCInboundRTPAudioStream')) {
        this.realtimeProtocolReceiverData = data;
      } else if (id.includes('outbound_rtp_audio') || id.includes('RTCOutboundRTPAudioStream')) {
        this.realtimeProtocolTransmitterData = data;
      } else if (id.includes('RTCMediaStreamTrack_receiver')) {
        this.mediaReceiverData = data;
      } else if (id.includes('RTCMediaStreamTrack_sender')) {
        this.mediaTransmitterData = data;
      }
    }
  }

  /**
   * @private
   */
  sendAddedStats() {
    if (!this.realtimeProtocolReceiverData || !this.realtimeProtocolTransmitterData) {
      return;
    }

    const report = {
      v: this.version,
      qos_data: {
        rx: this.realtimeProtocolReceiverData,
        tx: this.realtimeProtocolTransmitterData,
      },
    };

    if (this.mediaTransmitter) {
      report.qos_data.tx_media = this.mediaTransmitter;
    }

    if (this.mediaReceiver) {
      report.qos_data.rx_media = this.mediaReceiver;
    }

    const to = `${this.did}@sip.flowroute.com`;
    this.sipUserAgent.sendMessage(to, JSON.stringify(report, null, 2), {
      extraHeaders: [
        `P-QoS-Call-ID:${this.callId}`,
      ],
    });

    this.realtimeProtocolReceiverData = null;
    this.realtimeProtocolTransmitterData = null;
    this.mediaReceiverData = null;
    this.mediaTransmitterData = null;
  }

  /**
   * @private
   */
  keepGatheringStats() {
    this.realtimeSessionConnection.getStats().then((rtcStatsReport) => {
      if (!this.isActive) {
        return;
      }

      rtcStatsReport.forEach(this.addStat.bind(this));
      this.sendAddedStats();

      setTimeout(this.keepGatheringStats.bind(this), this.interval);
    });
  }
}
