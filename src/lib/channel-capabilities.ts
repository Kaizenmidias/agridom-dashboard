export type ChannelCapability = {
  canSendText: boolean;
  canSendImage: boolean;
  canSendVideo: boolean;
  canSendAudio: boolean;
  canSendDocument: boolean;
  canSendSticker: boolean;
  canReply: boolean;
  canShowReadReceipts: boolean;
  canShowPresence: boolean;
  canShowLastSeen: boolean;
  canShowTyping: boolean;
  canShowRecording: boolean;
  canUseGroups: boolean;
  canStartVoiceCall: boolean;
  canStartVideoCall: boolean;
  canReact: boolean;
  canFetchProfilePicture: boolean;
};

const unavailable: ChannelCapability = {
  canSendText: false, canSendImage: false, canSendVideo: false, canSendAudio: false,
  canSendDocument: false, canSendSticker: false, canReply: false,
  canShowReadReceipts: false, canShowPresence: false, canShowLastSeen: false,
  canShowTyping: false, canShowRecording: false, canUseGroups: false,
  canStartVoiceCall: false, canStartVideoCall: false, canReact: false,
  canFetchProfilePicture: false,
};

const capabilities: Record<string, ChannelCapability> = {
  whatsapp: {
    ...unavailable,
    canSendText: true,
    canSendImage: true,
    canSendVideo: true,
    canSendAudio: true,
    canSendDocument: true,
    canReply: true,
    canShowReadReceipts: true,
    canUseGroups: true,
    canFetchProfilePicture: true,
  },
};

export function getChannelCapabilities(channel?: string | null): ChannelCapability {
  return capabilities[String(channel || "").toLowerCase()] || unavailable;
}
