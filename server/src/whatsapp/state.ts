export type ConnectionState = "connecting" | "open" | "close";

export interface GroupSummary {
  jid: string;
  subject: string;
}

interface WhatsAppState {
  connection: ConnectionState;
  /** Latest pairing QR as a PNG data URL, or null once linked. */
  qrDataUrl: string | null;
  groups: GroupSummary[];
  resolvedTargetJid: string | null;
  lastError: string | null;
}

const state: WhatsAppState = {
  connection: "connecting",
  qrDataUrl: null,
  groups: [],
  resolvedTargetJid: null,
  lastError: null,
};

export function getWhatsAppState(): Readonly<WhatsAppState> {
  return state;
}

export function setConnection(connection: ConnectionState): void {
  state.connection = connection;
}

export function setQr(qrDataUrl: string | null): void {
  state.qrDataUrl = qrDataUrl;
}

export function setGroups(groups: GroupSummary[]): void {
  state.groups = groups;
}

export function setResolvedTargetJid(jid: string | null): void {
  state.resolvedTargetJid = jid;
}

export function setLastError(error: string | null): void {
  state.lastError = error;
}
