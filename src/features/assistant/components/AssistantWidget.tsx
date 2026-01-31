import React, { useRef, useEffect, useMemo, useState } from 'react';
import { MessageSquare, X, Send, Bot, User, Mic, MicOff, Volume2, VolumeX, Play, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAIChat } from '../hooks/useAIChat';
import { AssessmentData } from '../../../types';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { useLocationWeather } from '../hooks/useLocationWeather';


interface AssistantWidgetProps {
    data: AssessmentData | null;
}

import { useTranslation } from 'react-i18next';

export const AssistantWidget: React.FC<AssistantWidgetProps> = ({ data }) => {
    const { t, i18n } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const {
        isListening,
        transcript,
        interimTranscript,
        error: sttError,
        startListening,
        stopListening,
        clearTranscript,
        hasSupport: hasSTT
    } = useSpeechRecognition();
    const { speak, cancel: stopSpeaking, hasSupport: hasTTS, isSpeaking } = useTextToSpeech();
    const [isTtsMuted, setIsTtsMuted] = useState(false);

    const {
        locationContextForPrompt,
    } = useLocationWeather();

    const { messages, isLoading, isOpen, toggleChat, sendMessage } = useAIChat(data, locationContextForPrompt);

    const speechLang = useMemo(() => {
        const code = (i18n.language || 'en').toLowerCase();
        if (code.startsWith('hi')) return 'hi-IN';
        if (code.startsWith('te')) return 'te-IN';
        if (code.startsWith('ta')) return 'ta-IN';
        if (code.startsWith('ml')) return 'ml-IN';
        if (code.startsWith('kn')) return 'kn-IN';
        if (code.startsWith('mr')) return 'mr-IN';
        if (code.startsWith('bn')) return 'bn-IN';
        if (code.startsWith('gu')) return 'gu-IN';
        if (code.startsWith('pa')) return 'pa-IN';
        return 'en-US';
    }, [i18n.language]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = () => {
        if (inputRef.current?.value) {
            stopSpeaking();
            sendMessage(inputRef.current.value);
            inputRef.current.value = '';
        }
    };

    const lastAiMessage = useMemo(() => {
        const lastMsg = [...messages].reverse().find((m) => m.sender === 'ai');
        return lastMsg?.text || '';
    }, [messages]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSend();
    };

    useEffect(() => {
        if (!inputRef.current) return;
        if (interimTranscript) {
            inputRef.current.value = interimTranscript;
            return;
        }
        if (transcript) {
            inputRef.current.value = transcript;
        }
    }, [transcript, interimTranscript]);

    useEffect(() => {
        if (!transcript || isListening || isLoading) return;
        stopSpeaking();
        sendMessage(transcript);
        if (inputRef.current) inputRef.current.value = '';
        clearTranscript();
    }, [transcript, isListening, isLoading, clearTranscript, sendMessage, stopSpeaking]);

    useEffect(() => {
        if (!hasTTS || isTtsMuted) return;
        const lastMsg = messages[messages.length - 1];
        if (!lastMsg) return;
        if (isLoading) return;
        if (lastMsg.sender !== 'ai') return;

        speak(lastMsg.text, speechLang);
    }, [messages, isLoading, hasTTS, isTtsMuted, speak, speechLang]);

    useEffect(() => {
        if (!isOpen) stopSpeaking();
    }, [isOpen, stopSpeaking]);

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">

            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-[90vw] md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-200 flex flex-col h-[500px]">
                    {/* Header */}
                    <div className="bg-green-700 p-3 text-white">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm">{t('assistant_title')}</h3>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                                        <span className="text-[10px] text-green-100 uppercase tracking-wide">{t('online')}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!hasTTS) return;
                                        if (isSpeaking) {
                                            stopSpeaking();
                                            return;
                                        }
                                        if (!lastAiMessage) return;
                                        if (isTtsMuted) setIsTtsMuted(false);
                                        speak(lastAiMessage, speechLang);
                                    }}
                                    className="p-1 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                                    disabled={!hasTTS || !lastAiMessage}
                                    aria-label={isSpeaking ? 'Stop voice output' : 'Play last response'}
                                    title={isSpeaking ? 'Stop' : 'Play'}
                                >
                                    {isSpeaking ? (
                                        <Square className="w-5 h-5 text-white/80" />
                                    ) : (
                                        <Play className="w-5 h-5 text-white/80" />
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!hasTTS) return;
                                        if (isTtsMuted) {
                                            setIsTtsMuted(false);
                                        } else {
                                            setIsTtsMuted(true);
                                            stopSpeaking();
                                        }
                                    }}
                                    className="p-1 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                                    disabled={!hasTTS}
                                    aria-label={isTtsMuted ? 'Unmute assistant voice' : 'Mute assistant voice'}
                                    title={isTtsMuted ? 'Unmute' : 'Mute'}
                                >
                                    {isTtsMuted ? (
                                        <VolumeX className="w-5 h-5 text-white/80" />
                                    ) : (
                                        <Volume2 className="w-5 h-5 text-white/80" />
                                    )}
                                </button>

                                <button onClick={toggleChat} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-white/80" />
                                </button>
                            </div>
                        </div>


                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto bg-gray-50 scrollbar-thin scrollbar-thumb-gray-200 relative">
                        <div className="p-4 space-y-4" ref={scrollRef}>
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
                                >
                                    <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center mt-1 shadow-sm border ${msg.sender === 'user' ? 'bg-white border-green-100' : 'bg-green-700 border-green-800'
                                        }`}>
                                        {msg.sender === 'user' ? (
                                            <User className="w-4 h-4 text-green-700" />
                                        ) : (
                                            <Bot className="w-4 h-4 text-white" />
                                        )}
                                    </div>

                                    <div className={`max-w-[80%] rounded-2xl p-3 text-sm leading-relaxed shadow-sm ${msg.sender === 'user'
                                        ? 'bg-green-600 text-white rounded-tr-none'
                                        : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                                        }`}>
                                        <ReactMarkdown
                                            components={{
                                                p: ({ node: _node, ...props }) => <p className="mb-1 last:mb-0" {...props} />,
                                                ul: ({ node: _node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                                                li: ({ node: _node, ...props }) => <li className={`marker:${msg.sender === 'user' ? 'text-green-200' : 'text-green-600'}`} {...props} />,
                                                strong: ({ node: _node, ...props }) => <strong className={`font-bold ${msg.sender === 'user' ? 'text-green-100' : 'text-green-700'}`} {...props} />
                                            }}
                                        >
                                            {msg.text}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ))}

                            {isLoading && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 bg-green-700 rounded-full flex items-center justify-center shrink-0">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t border-gray-100">


                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-green-500/20 focus-within:border-green-500 transition-all">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder={t('ask_placeholder')}
                                className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400"
                                onKeyDown={handleKeyDown}
                            />

                            <button
                                type="button"
                                onClick={() => {
                                    if (!hasSTT) return;
                                    if (isListening) stopListening();
                                    else startListening(speechLang);
                                }}
                                className="p-1.5 rounded-full text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                                disabled={!hasSTT || isLoading}
                                aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                                title={isListening ? 'Stop voice input' : 'Start voice input'}
                            >
                                {isListening ? (
                                    <MicOff className="w-4 h-4" />
                                ) : (
                                    <Mic className="w-4 h-4" />
                                )}
                            </button>

                            <button
                                onClick={handleSend}
                                className="p-1.5 bg-green-600 rounded-full text-white hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                                disabled={isLoading}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                        {hasSTT && (isListening || sttError) && (
                            <div className={`mt-2 text-[10px] font-medium ${sttError ? 'text-red-600' : 'text-gray-500'}`}>
                                {sttError
                                    ? `Voice input unavailable (${sttError}).`
                                    : 'Listening… speak clearly and pause to send.'}
                            </div>
                        )}
                        <div className="text-[10px] text-center text-gray-400 mt-2 font-medium">
                            {t('disclaimer')}
                        </div>
                    </div>
                </div>
            )
            }

            {/* Floating Action Button (FAB) */}
            <button
                onClick={toggleChat}
                className={`${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'} transition-all duration-300 w-14 h-14 bg-green-700 hover:bg-green-800 text-white rounded-full shadow-[0_4px_20px_rgba(21,128,61,0.4)] flex items-center justify-center border-2 border-white/20 hover:scale-105 active:scale-95`}
                aria-label="Open Assistant"
            >
                <MessageSquare className="w-7 h-7" />
            </button>
        </div >
    );
};
