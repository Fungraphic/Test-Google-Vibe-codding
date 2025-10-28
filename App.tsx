import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage } from './types';
import { ChatBubble } from './components/ChatBubble';
import { VoiceRadar } from './components/VoiceRadar';
import { Icon, IconType } from './components/Icons';
import { useJarvis, JarvisStatus } from './hooks/useJarvis';

const App: React.FC = () => {
    // FIX: Get `setMessages` from the hook to allow local modifications
    const { status, messages, error, analyserNode, startSession, stopSession, setMessages } = useJarvis();
    const [editingId, setEditingId] = useState<string | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);
    
    // Local message modifications
    const handleCopy = (text: string) => navigator.clipboard.writeText(text);

    // FIX: Implement local delete and edit logic
    const handleDelete = (id: string) => {
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== id));
        console.log("Local message deleted. This does not affect the AI's long-term memory.");
    };
    const handleEdit = (id: string, newText: string) => {
        setMessages(prevMessages => prevMessages.map(msg => 
            msg.id === id ? { ...msg, text: newText } : msg
        ));
         console.log("Local message edited. This does not affect the AI's long-term memory.");
    };

    const statusText: Record<JarvisStatus, string> = {
        idle: 'Cliquez pour démarrer',
        initializing: 'Initialisation...',
        listening: 'En attente de "Jarvis"...',
        recording: 'Enregistrement...',
        processing: 'Traitement...',
        speaking: 'Synthèse vocale...', // Updated status text
        error: 'Erreur système',
    };

    const isSessionActive = status !== 'idle' && status !== 'error';

    return (
        <div className="flex flex-col h-screen bg-[#0a192f] text-slate-300 overflow-hidden">
            <header className="p-4 text-center border-b border-cyan-500/30">
                <h1 className="text-2xl font-bold tracking-wider text-cyan-400">J.A.R.V.I.S. INTERFACE</h1>
            </header>
            
            <main className="flex flex-1 flex-col lg:flex-row overflow-hidden">
                <div className="flex flex-col items-center justify-center p-8 lg:w-1/3 border-b lg:border-b-0 lg:border-r border-cyan-500/30">
                    <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
                        <VoiceRadar status={status} analyserNode={analyserNode} />
                        <button 
                            onClick={isSessionActive ? stopSession : startSession}
                            disabled={status === 'initializing' || status === 'processing'}
                            className="absolute w-24 h-24 bg-cyan-900/50 rounded-full flex items-center justify-center text-cyan-300 border-2 border-cyan-400/50 transition-all duration-300 hover:bg-cyan-800/70 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={isSessionActive ? "Stop Session" : "Start Session"}
                        >
                            <Icon type={isSessionActive ? IconType.Stop : IconType.Microphone} className="w-12 h-12" />
                        </button>
                    </div>
                    <div className="mt-6 text-center h-16">
                        {error ? (
                            <>
                                <p className="text-lg text-cyan-400 font-bold">Erreur</p>
                                <p className="text-sm text-red-500 break-words max-w-sm px-4">{error}</p>
                            </>
                        ) : (
                             <p className="text-lg capitalize text-cyan-300">{statusText[status]}</p>
                        )}
                    </div>
                </div>

                <div className="flex flex-col flex-1 p-4 overflow-hidden">
                    <div ref={chatContainerRef} className="flex-1 overflow-y-auto pr-2 pb-20 scroll-smooth">
                        {messages.length === 0 && (
                            <div className="flex items-center justify-center h-full text-slate-500">
                                <p>Cliquez sur l'icône du microphone pour commencer la session.</p>
                            </div>
                        )}
                        {messages.map((msg) => (
                            <ChatBubble 
                                key={msg.id} 
                                message={msg} 
                                onDelete={handleDelete}
                                onCopy={handleCopy}
                                onEdit={handleEdit}
                                isEditing={editingId === msg.id}
                                setEditingId={setEditingId}
                            />
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;