
export type MessageSender = 'user' | 'ai';

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  timestamp: Date;
}
