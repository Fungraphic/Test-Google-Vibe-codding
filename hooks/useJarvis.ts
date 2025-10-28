import { useState, useRef, useCallback, useEffect } from 'react';
import { PorcupineWorker } from '@picovoice/porcupine-web';
import type { ChatMessage } from '../types';

// --- Configuration ---
// Mettez à jour ces URL pour correspondre à vos serveurs locaux si nécessaire
const WHISPER_API_URL = 'http://localhost:8000/transcribe';
const OLLAMA_API_URL = 'http://localhost:11434/api/chat';
const PIPER_API_URL = 'http://localhost:5000/tts';
const MCPO_API_URL = 'http://localhost:8080/api/mcpo';
const OLLAMA_MODEL = 'llama3'; // ou un autre modèle supportant les outils

// --- Types ---
export type JarvisStatus = 'idle' | 'initializing' | 'listening' | 'recording' | 'processing' | 'speaking' | 'error';

// --- Ollama Tool Definitions & System Prompt ---
const OLLAMA_SYSTEM_PROMPT = `You are JARVIS, a witty AI assistant from Iron Man. Respond concisely with dry humor.
You have access to a tool to control MCP servers. When a user asks to list, start, or stop a server, you must respond ONLY with a JSON object for the 'control_mcp_server' tool.
Do not add any other text or explanation. The JSON object should have 'tool_name' and 'arguments'.

Example user request: "Tornade, start the web server"
Your response: {"tool_name": "control_mcp_server", "arguments": {"command": "start", "server_name": "web"}}

Example user request: "list servers"
Your response: {"tool_name": "control_mcp_server", "arguments": {"command": "list"}}`;

// --- MCPO API Handler ---
const handleMcpoApiCall = async (endpoint: string, method: 'GET' | 'POST' = 'GET', body?: object) => {
    try {
        const response = await fetch(`${MCPO_API_URL}${endpoint}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
            throw new Error(`MCPO API Error: ${errorData.detail || response.statusText}`);
        }
        return await response.json();
    } catch (err) {
        console.error(`MCPO API call to ${endpoint} failed:`, err);
        return { error: err instanceof Error ? err.message : 'Unknown MCPO API error' };
    }
};

export const useJarvis = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [status, setStatus] = useState<JarvisStatus>('idle');
    const [error, setError] = useState<string | null>(null);

    const porcupineWorkerRef = useRef<PorcupineWorker | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    
    const cleanup = useCallback(() => {
        console.log("Cleaning up resources...");
        porcupineWorkerRef.current?.terminate();
        porcupineWorkerRef.current = null;

        mediaRecorderRef.current?.stop();
        mediaRecorderRef.current = null;
        
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;

        audioContextRef.current?.close().catch(console.error);
        audioContextRef.current = null;
    }, []);

    const stopSession = useCallback(() => {
        cleanup();
        setStatus('idle');
        setMessages([]);
        setError(null);
    }, [cleanup]);

    const processAudio = async (audioBlob: Blob) => {
        setStatus('processing');
        try {
            // 1. Transcribe with Whisper
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.wav');
            const whisperResponse = await fetch(WHISPER_API_URL, { method: 'POST', body: formData });
            if (!whisperResponse.ok) throw new Error('Whisper transcription failed');
            const { text: userText } = await whisperResponse.json();

            const userMessage: ChatMessage = { id: `user-${Date.now()}`, sender: 'user', text: userText, timestamp: new Date() };
            setMessages(prev => [...prev, userMessage]);

            // 2. Process with Ollama (handle tool calls)
            let ollamaResponseText = await getOllamaResponse(userMessage);

            const aiMessage: ChatMessage = { id: `ai-${Date.now()}`, sender: 'ai', text: ollamaResponseText, timestamp: new Date() };
            setMessages(prev => [...prev, aiMessage]);
            
            // 3. Synthesize with Piper
            setStatus('speaking');
            const piperResponse = await fetch(PIPER_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: ollamaResponseText }) });
            if (!piperResponse.ok) throw new Error('Piper TTS failed');
            const audioData = await piperResponse.arrayBuffer();
            
            // 4. Play audio
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const buffer = await audioCtx.decodeAudioData(audioData);
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(audioCtx.destination);
            source.start(0);
            source.onended = () => {
                setStatus('listening');
                audioCtx.close();
            };

        } catch (err) {
            console.error("Processing failed:", err);
            setError(err instanceof Error ? err.message : "An error occurred during processing.");
            setStatus('error');
        }
    };
    
    const getOllamaResponse = async (userMessage: ChatMessage): Promise<string> => {
        const history = messages.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text }));
        
        const ollamaPayload = {
            model: OLLAMA_MODEL,
            stream: false,
            messages: [
                { role: 'system', content: OLLAMA_SYSTEM_PROMPT },
                ...history,
                { role: 'user', content: userMessage.text }
            ],
        };

        const ollamaResponse = await fetch(OLLAMA_API_URL, { method: 'POST', body: JSON.stringify(ollamaPayload) });
        if (!ollamaResponse.ok) throw new Error('Ollama API request failed');
        const responseData = await ollamaResponse.json();
        let content = responseData.message.content;

        // Check for tool call
        try {
            const potentialToolCall = JSON.parse(content);
            if (potentialToolCall.tool_name === 'control_mcp_server') {
                const { command, server_name } = potentialToolCall.arguments;
                let result;
                switch (command) {
                    case 'list':
                        result = await handleMcpoApiCall('/servers');
                        break;
                    case 'start':
                        result = await handleMcpoApiCall(`/servers/${server_name}/start`, 'POST');
                        break;
                    case 'stop':
                        result = await handleMcpoApiCall(`/servers/${server_name}/stop`, 'POST');
                        break;
                    default:
                        result = { error: `Unknown command: ${command}` };
                }
                
                // Send result back to Ollama for natural language response
                const toolResponsePayload = {
                    ...ollamaPayload,
                    messages: [ ...ollamaPayload.messages, { role: 'assistant', content }, { role: 'tool', content: JSON.stringify(result) } ],
                };
                const finalOllamaResponse = await fetch(OLLAMA_API_URL, { method: 'POST', body: JSON.stringify(toolResponsePayload) });
                const finalData = await finalOllamaResponse.json();
                return finalData.message.content;
            }
        } catch (e) {
            // Not a tool call, just a regular response
        }

        return content;
    };


    const startSession = useCallback(async () => {
        if (porcupineWorkerRef.current) return;

        setStatus('initializing');
        setError(null);
        
        try {
            const keywordCallback = (detection: { label: string }) => {
                if (detection.label === 'Tornade') {
                    console.log('Wake word detected:', detection.label);
                    setStatus('recording');
                    if (!audioStreamRef.current) return;
                    mediaRecorderRef.current = new MediaRecorder(audioStreamRef.current);
                    const audioChunks: Blob[] = [];
                    mediaRecorderRef.current.ondataavailable = (event) => audioChunks.push(event.data);
                    mediaRecorderRef.current.onstop = () => processAudio(new Blob(audioChunks));
                    mediaRecorderRef.current.start();
                    
                    // Stop recording after 5 seconds of speaking
                    setTimeout(() => {
                        if (mediaRecorderRef.current?.state === 'recording') {
                            mediaRecorderRef.current.stop();
                        }
                    }, 5000);
                }
            };

            // FIX: The arguments for PorcupineWorker.create were incorrect. This passes keywordCallback and model as separate arguments to match the expected function signature.
            const accessKey = import.meta.env.VITE_PICOVOICE_ACCESS_KEY as string | undefined;
            if (!accessKey) {
                throw new Error('PICOVOICE access key (VITE_PICOVOICE_ACCESS_KEY) manquant.');
            }

            porcupineWorkerRef.current = await PorcupineWorker.create(
                accessKey,
                [{ label: 'Tornade', publicPath: '/porcupine/tornade_wasm.ppn', forceWrite: true }],
                keywordCallback,
                { publicPath: '/porcupine/porcupine_params.pv', forceWrite: true },
                {
                    processErrorCallback: (error) => { setError(error.toString()); setStatus('error'); }
                }
            );

            audioStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            const source = audioContextRef.current.createMediaStreamSource(audioStreamRef.current);
            source.connect(analyserRef.current);

            // Forward audio to Porcupine
            const porcupineNode = audioContextRef.current.createScriptProcessor(512, 1, 1);
            porcupineNode.onaudioprocess = (event) => {
                const inputData = event.inputBuffer.getChannelData(0);
                const pcm = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    pcm[i] = inputData[i] * 32767;
                }
                // FIX: The PorcupineWorker class provides a .process() method to send audio frames,
                // abstracting away the underlying postMessage call.
                porcupineWorkerRef.current?.process(pcm);
            };
            source.connect(porcupineNode);
            porcupineNode.connect(audioContextRef.current.destination); // Required for some browsers
            
            setStatus('listening');

        } catch (err) {
            console.error("Failed to start session:", err);
            setError(err instanceof Error ? err.message : "Failed to start. Check permissions, API key, and model files.");
            setStatus('error');
            cleanup();
        }
    }, [cleanup]);

    return { status, messages, error, analyserNode: analyserRef.current, startSession, stopSession, setMessages };
};
