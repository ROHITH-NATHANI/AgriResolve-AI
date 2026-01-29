import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';

interface WebRTCPeer {
  userId: string;
  socketId: string;
  sessionId?: string;
  peerConnections: Map<string, RTCPeerConnectionState>;
}

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'quality-update' | 'connection-state';
  sessionId: string;
  fromUserId: string;
  toUserId: string;
  payload: any;
  timestamp: Date;
}

interface NetworkQuality {
  bandwidth: number;
  latency: number;
  packetLoss: number;
  jitter: number;
}

interface ConnectionState {
  state: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
  quality: NetworkQuality;
  adaptiveSettings: {
    videoEnabled: boolean;
    audioEnabled: boolean;
    videoQuality: 'high' | 'medium' | 'low';
  };
}

class WebRTCSignalingServer {
  private peers: Map<string, WebRTCPeer> = new Map();
  private sessionPeers: Map<string, Set<string>> = new Map();
  private io: SocketIOServer | null = null;

  // STUN/TURN server configuration
  private iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add TURN servers for production
    ...(process.env.TURN_SERVER_URL ? [{
      urls: process.env.TURN_SERVER_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    }] : [])
  ];

  public initialize(io: SocketIOServer): void {
    this.io = io;
    logger.info('WebRTC signaling server initialized');
  }

  public setupSignalingHandlers(socket: Socket, userId: string): void {
    // Register peer
    this.registerPeer(socket, userId);

    // Handle WebRTC signaling messages
    socket.on('webrtc-offer', (data: any) => {
      this.handleOffer(socket, userId, data);
    });

    socket.on('webrtc-answer', (data: any) => {
      this.handleAnswer(socket, userId, data);
    });

    socket.on('webrtc-ice-candidate', (data: any) => {
      this.handleIceCandidate(socket, userId, data);
    });

    socket.on('webrtc-quality-update', (data: any) => {
      this.handleQualityUpdate(socket, userId, data);
    });

    socket.on('webrtc-connection-state', (data: any) => {
      this.handleConnectionState(socket, userId, data);
    });

    // Handle consultation requests
    socket.on('request-video-consultation', (data: any) => {
      this.handleConsultationRequest(socket, userId, data);
    });

    socket.on('accept-video-consultation', (data: any) => {
      this.handleConsultationAccept(socket, userId, data);
    });

    socket.on('reject-video-consultation', (data: any) => {
      this.handleConsultationReject(socket, userId, data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handlePeerDisconnection(userId);
    });

    // Send ICE server configuration
    socket.emit('webrtc-config', {
      iceServers: this.iceServers,
      adaptiveQuality: true,
      fallbackOptions: ['audio-only', 'text-only']
    });
  }

  private registerPeer(socket: Socket, userId: string): void {
    const peer: WebRTCPeer = {
      userId,
      socketId: socket.id,
      peerConnections: new Map()
    };

    this.peers.set(userId, peer);
    logger.debug(`WebRTC peer registered: ${userId}`);
  }

  private handleOffer(socket: Socket, fromUserId: string, data: any): void {
    const { toUserId, sessionId, offer, networkQuality } = data;

    if (!this.validateSignalingMessage(fromUserId, toUserId, sessionId)) {
      socket.emit('webrtc-error', { message: 'Invalid signaling message' });
      return;
    }

    const toPeer = this.peers.get(toUserId);
    if (!toPeer) {
      socket.emit('webrtc-error', { message: 'Target peer not found' });
      return;
    }

    // Apply quality adaptation based on network conditions
    const adaptedOffer = this.adaptOfferForNetworkConditions(offer, networkQuality);

    const signalingMessage: SignalingMessage = {
      type: 'offer',
      sessionId,
      fromUserId,
      toUserId,
      payload: {
        offer: adaptedOffer,
        networkQuality,
        adaptiveSettings: this.getAdaptiveSettings(networkQuality)
      },
      timestamp: new Date()
    };

    // Forward offer to target peer
    this.io!.to(toPeer.socketId).emit('webrtc-offer', signalingMessage);

    // Track connection attempt
    const fromPeer = this.peers.get(fromUserId);
    if (fromPeer) {
      fromPeer.peerConnections.set(toUserId, 'connecting' as RTCPeerConnectionState);
    }

    logger.debug(`WebRTC offer forwarded from ${fromUserId} to ${toUserId}`);
  }

  private handleAnswer(socket: Socket, fromUserId: string, data: any): void {
    const { toUserId, sessionId, answer, networkQuality } = data;

    if (!this.validateSignalingMessage(fromUserId, toUserId, sessionId)) {
      socket.emit('webrtc-error', { message: 'Invalid signaling message' });
      return;
    }

    const toPeer = this.peers.get(toUserId);
    if (!toPeer) {
      socket.emit('webrtc-error', { message: 'Target peer not found' });
      return;
    }

    const adaptedAnswer = this.adaptAnswerForNetworkConditions(answer, networkQuality);

    const signalingMessage: SignalingMessage = {
      type: 'answer',
      sessionId,
      fromUserId,
      toUserId,
      payload: {
        answer: adaptedAnswer,
        networkQuality,
        adaptiveSettings: this.getAdaptiveSettings(networkQuality)
      },
      timestamp: new Date()
    };

    // Forward answer to target peer
    this.io!.to(toPeer.socketId).emit('webrtc-answer', signalingMessage);

    logger.debug(`WebRTC answer forwarded from ${fromUserId} to ${toUserId}`);
  }

  private handleIceCandidate(socket: Socket, fromUserId: string, data: any): void {
    const { toUserId, sessionId, candidate } = data;

    if (!this.validateSignalingMessage(fromUserId, toUserId, sessionId)) {
      return; // Silently ignore invalid ICE candidates
    }

    const toPeer = this.peers.get(toUserId);
    if (!toPeer) {
      return; // Silently ignore if peer not found
    }

    const signalingMessage: SignalingMessage = {
      type: 'ice-candidate',
      sessionId,
      fromUserId,
      toUserId,
      payload: { candidate },
      timestamp: new Date()
    };

    // Forward ICE candidate to target peer
    this.io!.to(toPeer.socketId).emit('webrtc-ice-candidate', signalingMessage);

    logger.debug(`ICE candidate forwarded from ${fromUserId} to ${toUserId}`);
  }

  private handleQualityUpdate(socket: Socket, fromUserId: string, data: any): void {
    const { toUserId, sessionId, networkQuality } = data;

    const toPeer = this.peers.get(toUserId);
    if (!toPeer) return;

    // Determine if quality adaptation is needed
    const adaptiveSettings = this.getAdaptiveSettings(networkQuality);
    
    const qualityUpdate: SignalingMessage = {
      type: 'quality-update',
      sessionId,
      fromUserId,
      toUserId,
      payload: {
        networkQuality,
        adaptiveSettings,
        recommendations: this.getQualityRecommendations(networkQuality)
      },
      timestamp: new Date()
    };

    // Send quality update to both peers
    this.io!.to(toPeer.socketId).emit('webrtc-quality-update', qualityUpdate);
    socket.emit('webrtc-quality-update', qualityUpdate);

    logger.debug(`Quality update processed for connection ${fromUserId} <-> ${toUserId}`);
  }

  private handleConnectionState(socket: Socket, fromUserId: string, data: any): void {
    const { toUserId, sessionId, connectionState } = data;

    const fromPeer = this.peers.get(fromUserId);
    if (fromPeer) {
      fromPeer.peerConnections.set(toUserId, connectionState);
    }

    // Notify the other peer about connection state change
    const toPeer = this.peers.get(toUserId);
    if (toPeer) {
      this.io!.to(toPeer.socketId).emit('webrtc-peer-connection-state', {
        fromUserId,
        sessionId,
        connectionState
      });
    }

    // Handle failed connections with fallback
    if (connectionState === 'failed') {
      this.handleConnectionFailure(fromUserId, toUserId, sessionId);
    }

    logger.debug(`Connection state updated: ${fromUserId} -> ${toUserId}: ${connectionState}`);
  }

  private handleConsultationRequest(socket: Socket, fromUserId: string, data: any): void {
    const { expertId, sessionId, consultationType, urgency } = data;

    const expertPeer = this.peers.get(expertId);
    if (!expertPeer) {
      socket.emit('consultation-error', { message: 'Expert not available' });
      return;
    }

    // Send consultation request to expert
    this.io!.to(expertPeer.socketId).emit('consultation-request', {
      fromUserId,
      sessionId,
      consultationType,
      urgency,
      timestamp: new Date().toISOString()
    });

    logger.info(`Video consultation requested: ${fromUserId} -> ${expertId}`);
  }

  private handleConsultationAccept(socket: Socket, expertId: string, data: any): void {
    const { farmerId, sessionId } = data;

    const farmerPeer = this.peers.get(farmerId);
    if (!farmerPeer) {
      socket.emit('consultation-error', { message: 'Farmer not available' });
      return;
    }

    // Notify farmer that expert accepted
    this.io!.to(farmerPeer.socketId).emit('consultation-accepted', {
      expertId,
      sessionId,
      timestamp: new Date().toISOString()
    });

    // Add both peers to session
    this.addPeersToSession(sessionId, [farmerId, expertId]);

    logger.info(`Video consultation accepted: ${expertId} accepted ${farmerId}`);
  }

  private handleConsultationReject(socket: Socket, expertId: string, data: any): void {
    const { farmerId, sessionId, reason } = data;

    const farmerPeer = this.peers.get(farmerId);
    if (farmerPeer) {
      this.io!.to(farmerPeer.socketId).emit('consultation-rejected', {
        expertId,
        sessionId,
        reason,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`Video consultation rejected: ${expertId} rejected ${farmerId}`);
  }

  private handleConnectionFailure(fromUserId: string, toUserId: string, sessionId: string): void {
    const fromPeer = this.peers.get(fromUserId);
    const toPeer = this.peers.get(toUserId);

    if (!fromPeer || !toPeer) return;

    // Suggest fallback options
    const fallbackOptions = {
      audioOnly: true,
      textOnly: true,
      retryWithTurn: !!process.env.TURN_SERVER_URL
    };

    // Notify both peers about connection failure and fallback options
    [fromPeer, toPeer].forEach(peer => {
      this.io!.to(peer.socketId).emit('webrtc-connection-failed', {
        sessionId,
        fallbackOptions,
        timestamp: new Date().toISOString()
      });
    });

    logger.warn(`WebRTC connection failed: ${fromUserId} <-> ${toUserId}, fallback suggested`);
  }

  private handlePeerDisconnection(userId: string): void {
    const peer = this.peers.get(userId);
    if (!peer) return;

    // Notify all connected peers about disconnection
    peer.peerConnections.forEach((state, connectedUserId) => {
      const connectedPeer = this.peers.get(connectedUserId);
      if (connectedPeer) {
        this.io!.to(connectedPeer.socketId).emit('webrtc-peer-disconnected', {
          userId,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Remove peer from session tracking
    if (peer.sessionId) {
      const sessionPeers = this.sessionPeers.get(peer.sessionId);
      if (sessionPeers) {
        sessionPeers.delete(userId);
        if (sessionPeers.size === 0) {
          this.sessionPeers.delete(peer.sessionId);
        }
      }
    }

    this.peers.delete(userId);
    logger.debug(`WebRTC peer disconnected: ${userId}`);
  }

  private validateSignalingMessage(fromUserId: string, toUserId: string, sessionId: string): boolean {
    // Basic validation
    if (!fromUserId || !toUserId || !sessionId) {
      return false;
    }

    // Check if both peers exist
    if (!this.peers.has(fromUserId) || !this.peers.has(toUserId)) {
      return false;
    }

    // Additional validation can be added here (permissions, session membership, etc.)
    return true;
  }

  private adaptOfferForNetworkConditions(offer: RTCSessionDescriptionInit, networkQuality: NetworkQuality): RTCSessionDescriptionInit {
    // In a real implementation, this would modify the SDP based on network conditions
    // For now, return the offer as-is
    return offer;
  }

  private adaptAnswerForNetworkConditions(answer: RTCSessionDescriptionInit, networkQuality: NetworkQuality): RTCSessionDescriptionInit {
    // In a real implementation, this would modify the SDP based on network conditions
    return answer;
  }

  private getAdaptiveSettings(networkQuality: NetworkQuality): any {
    const { bandwidth, latency, packetLoss } = networkQuality;

    // Determine optimal settings based on network conditions
    if (bandwidth < 500000 || latency > 200 || packetLoss > 0.05) {
      // Poor network conditions
      return {
        videoEnabled: false,
        audioEnabled: true,
        videoQuality: 'low'
      };
    } else if (bandwidth < 1000000 || latency > 100 || packetLoss > 0.02) {
      // Medium network conditions
      return {
        videoEnabled: true,
        audioEnabled: true,
        videoQuality: 'medium'
      };
    } else {
      // Good network conditions
      return {
        videoEnabled: true,
        audioEnabled: true,
        videoQuality: 'high'
      };
    }
  }

  private getQualityRecommendations(networkQuality: NetworkQuality): string[] {
    const recommendations: string[] = [];
    const { bandwidth, latency, packetLoss } = networkQuality;

    if (bandwidth < 500000) {
      recommendations.push('Consider switching to audio-only mode for better quality');
    }

    if (latency > 200) {
      recommendations.push('High latency detected, consider moving closer to your router');
    }

    if (packetLoss > 0.05) {
      recommendations.push('Network instability detected, check your internet connection');
    }

    if (recommendations.length === 0) {
      recommendations.push('Network conditions are good for video consultation');
    }

    return recommendations;
  }

  private addPeersToSession(sessionId: string, userIds: string[]): void {
    if (!this.sessionPeers.has(sessionId)) {
      this.sessionPeers.set(sessionId, new Set());
    }

    const sessionPeers = this.sessionPeers.get(sessionId)!;
    userIds.forEach(userId => {
      sessionPeers.add(userId);
      const peer = this.peers.get(userId);
      if (peer) {
        peer.sessionId = sessionId;
      }
    });
  }

  // Public methods for external use
  public getPeerConnectionState(fromUserId: string, toUserId: string): RTCPeerConnectionState | null {
    const peer = this.peers.get(fromUserId);
    return peer ? peer.peerConnections.get(toUserId) || null : null;
  }

  public getSessionPeers(sessionId: string): string[] {
    const sessionPeers = this.sessionPeers.get(sessionId);
    return sessionPeers ? Array.from(sessionPeers) : [];
  }

  public isUserInSession(userId: string, sessionId: string): boolean {
    const sessionPeers = this.sessionPeers.get(sessionId);
    return sessionPeers ? sessionPeers.has(userId) : false;
  }
}

export const webrtcSignalingServer = new WebRTCSignalingServer();