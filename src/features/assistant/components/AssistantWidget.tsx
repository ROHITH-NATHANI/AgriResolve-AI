import React, { useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User } from 'lucide-react';
import { useAIChat } from '../hooks/useAIChat';
import { AssessmentData } from '../../../types';

interface AssistantWidgetProps {
    data: AssessmentData | null;
}

export const AssistantWidget: React.FC<AssistantWidgetProps> = ({ data }) => {
    const { messages, isLoading, isOpen, toggleChat, sendMessage } = useAIChat(data);
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = () => {
        if (inputRef.current?.value) {
            sendMessage(inputRef.current.value);
            inputRef.current.value = '';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSend();
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">

            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-[90vw] md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-200 flex flex-col h-[500px]">
                    {/* Header */}
                    <div className="bg-green-700 p-4 flex items-center justify-between text-white">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">Field Assistant</h3>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                                    <span className="text-[10px] text-green-100 uppercase tracking-wide">Online</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={toggleChat} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-5 h-5 text-white/80" />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 scrollbar-thin scrollbar-thumb-gray-200"
                    >
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
                                    {msg.text}
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

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t border-gray-100">
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-green-500/20 focus-within:border-green-500 transition-all">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Ask a question..."
                                className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400"
                                onKeyDown={handleKeyDown}
                            />
                            <button
                                onClick={handleSend}
                                className="p-1.5 bg-green-600 rounded-full text-white hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                                disabled={isLoading}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="text-[10px] text-center text-gray-400 mt-2 font-medium">
                            AI assisted guidance. Verify critical field decisions.
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Action Button (FAB) */}
            <button
                onClick={toggleChat}
                className={`${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'} transition-all duration-300 w-14 h-14 bg-green-700 hover:bg-green-800 text-white rounded-full shadow-[0_4px_20px_rgba(21,128,61,0.4)] flex items-center justify-center border-2 border-white/20 hover:scale-105 active:scale-95`}
                aria-label="Open Assistant"
            >
                <MessageSquare className="w-7 h-7" />
            </button>
        </div>
    );
};
