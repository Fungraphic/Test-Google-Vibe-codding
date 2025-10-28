
import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';
import { Icon, IconType } from './Icons';

interface ChatBubbleProps {
  message: ChatMessage;
  onDelete: (id: string) => void;
  onCopy: (text: string) => void;
  onEdit: (id:string, newText: string) => void;
  isEditing: boolean;
  setEditingId: (id: string | null) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onDelete, onCopy, onEdit, isEditing, setEditingId }) => {
  const isUser = message.sender === 'user';
  const [editedText, setEditedText] = useState(message.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditedText(message.text);
  }, [message.text]);
  
  const handleSaveEdit = () => {
    if (editedText.trim() !== message.text) {
        onEdit(message.id, editedText.trim());
    }
    setEditingId(null);
  }

  const handleCancelEdit = () => {
    setEditedText(message.text);
    setEditingId(null);
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }

  const bubbleAlignment = isUser ? 'justify-end' : 'justify-start';
  const bubbleColor = isUser ? 'bg-cyan-900/50' : 'bg-slate-800/60';
  const bubbleDirection = isUser ? 'flex-row-reverse' : 'flex-row';

  return (
    <div className={`flex items-start gap-3 my-4 ${bubbleAlignment}`}>
      <div className={`flex items-center justify-center w-10 h-10 rounded-full bg-slate-700 border-2 ${isUser ? 'border-cyan-400' : 'border-slate-400'} flex-shrink-0`}>
        <Icon type={isUser ? IconType.User : IconType.AI} className="w-6 h-6 text-slate-300" />
      </div>

      <div className={`group relative max-w-md lg:max-w-xl xl:max-w-3xl ${bubbleDirection}`}>
        <div className={`px-4 py-2 rounded-lg ${bubbleColor} text-slate-200`}>
          {isEditing ? (
             <div className="flex items-center gap-2">
                <input
                    ref={inputRef}
                    type="text"
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSaveEdit}
                    className="bg-transparent border-b border-cyan-400 text-slate-100 focus:outline-none w-full"
                />
                <button onClick={handleSaveEdit} className="text-green-400 hover:text-green-300"><Icon type={IconType.Check} className="w-5 h-5"/></button>
                <button onClick={handleCancelEdit} className="text-red-400 hover:text-red-300"><Icon type={IconType.Cancel} className="w-5 h-5"/></button>
             </div>
          ) : (
             <p>{message.text}</p>
          )}
        </div>

        {!isEditing && (
            <div className={`absolute -bottom-6 ${isUser ? 'left-0' : 'right-0'} hidden group-hover:flex items-center gap-2 transition-opacity duration-300`}>
                <button onClick={() => onCopy(message.text)} className="p-1 text-slate-400 hover:text-cyan-300">
                    <Icon type={IconType.Copy} className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingId(message.id)} className="p-1 text-slate-400 hover:text-cyan-300">
                    <Icon type={IconType.Edit} className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(message.id)} className="p-1 text-slate-400 hover:text-red-400">
                    <Icon type={IconType.Delete} className="w-4 h-4" />
                </button>
            </div>
        )}
      </div>
    </div>
  );
};
