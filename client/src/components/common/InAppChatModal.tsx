import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../../services/socket.js';
import { api } from '../../services/api.js';
import { Send, X, MessageSquare, Check, CheckCheck, Clock, Sparkles } from 'lucide-react';

export interface ChatMessage {
  id: string;
  bookingId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  createdAt: string;
}

interface InAppChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: 'PASSENGER' | 'DRIVER';
  peerName: string;
  peerRole: string;
  peerAvatar?: string;
}

export const InAppChatModal: React.FC<InAppChatModalProps> = ({
  isOpen,
  onClose,
  bookingId,
  currentUserId,
  currentUserName,
  currentUserRole,
  peerName,
  peerRole,
  peerAvatar
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Quick reply suggestions
  const quickPhrases = currentUserRole === 'PASSENGER'
    ? [
        "I'm waiting at the main entrance",
        "Where are you?",
        "I am wearing a black jacket",
        "Please wait 2 minutes"
      ]
    : [
        "I am on the way!",
        "Arriving in 2 minutes",
        "Stuck in a small traffic signal",
        "I have arrived at the pickup location"
      ];

  // Load chat history and listen to socket
  useEffect(() => {
    if (!isOpen || !bookingId) return;

    api.getChatHistory(bookingId)
      .then(res => {
        if (res.messages) setMessages(res.messages);
      })
      .catch(() => {});

    socket.emit('join_booking', bookingId);

    const handleNewMessage = (msg: any) => {
      if (msg.bookingId === bookingId) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    socket.on('new_chat_message', handleNewMessage);

    return () => {
      socket.off('new_chat_message', handleNewMessage);
    };
  }, [isOpen, bookingId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text) return;

    const payload = {
      bookingId,
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: currentUserRole,
      message: text
    };

    socket.emit('send_chat_message', payload);
    setInputMessage('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 flex flex-col h-[560px] overflow-hidden text-slate-100">
        
        {/* Chat Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src={peerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
              alt={peerName}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-brand-500"
            />
            <div>
              <h3 className="font-extrabold text-sm text-white">{peerName}</h3>
              <p className="text-[11px] text-emerald-400 font-semibold flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Active in Ride • {peerRole}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/50">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
              <MessageSquare className="w-10 h-10 text-slate-600" />
              <p className="text-xs font-semibold">Start the conversation with {peerName}</p>
              <p className="text-[11px] text-slate-600">Messages are end-to-end encrypted and masked for safety.</p>
            </div>
          ) : (
            messages.map((m, idx) => {
              const isMe = m.senderId === currentUserId;
              return (
                <div
                  key={m.id || idx}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-xs font-medium shadow-md ${
                      isMe
                        ? 'bg-brand-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/60'
                    }`}
                  >
                    <p className="leading-relaxed">{m.message}</p>
                  </div>
                  <div className="flex items-center space-x-1 mt-1 px-1">
                    <span className="text-[9px] text-slate-500">
                      {new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && <CheckCheck className="w-3 h-3 text-brand-400" />}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Phrases Bar */}
        <div className="px-3 py-2 bg-slate-950 border-t border-slate-800/80 flex items-center space-x-1.5 overflow-x-auto text-[11px] no-scrollbar">
          {quickPhrases.map((phrase, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(phrase)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full whitespace-nowrap border border-slate-700 transition-colors shrink-0"
            >
              {phrase}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-950 border-t border-slate-800">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              placeholder={`Message ${peerName}...`}
              className="flex-1 px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="p-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-800 text-white rounded-2xl transition-transform active:scale-95 shadow-md shadow-brand-500/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
