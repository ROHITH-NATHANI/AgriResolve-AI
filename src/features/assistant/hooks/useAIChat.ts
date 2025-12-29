import { useState } from 'react';
import { AssessmentData } from '../../../types';
import { routeGeminiCall } from '../../../services/gemini';

export interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    timestamp: number;
}

export const useAIChat = (contextData: AssessmentData | null) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    // Initial welcome message
    const toggleChat = () => {
        if (!isOpen && messages.length === 0) {
            setMessages([{
                id: 'welcome',
                sender: 'ai',
                text: "Hello! I'm your Field Assistant. Ask me anything about crop health or the current diagnosis.",
                timestamp: Date.now()
            }]);
        }
        setIsOpen(!isOpen);
    };

    const sendMessage = async (text: string) => {
        if (!text.trim()) return;

        // Add User Message
        const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            sender: 'user',
            text: text,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            // Construct Context-Aware Prompt
            let systemContext = `
        You are an expert Agricultural Field Assistant.
        Your goal is to help farmers and agronomists understand crop health issues.
        Be concise, practical, and helpful. 
        If a diagnosis is provided below, use it to answer questions specifically about THAT problem.
      `;

            if (contextData) {
                systemContext += `
          \n--- CURRENT DIAGNOSIS ---
          Problem: ${contextData.arbitrationResult.final_diagnosis}
          Confidence: ${(contextData.arbitrationResult.confidence_score * 100).toFixed(0)}%
          Explanation: ${contextData.explanation.summary}
          Recommended Actions: ${contextData.explanation.guidance.join(', ')}
          Healthy Probability: ${(contextData.healthyResult.score * 100).toFixed(0)}%
          Disease Probability: ${(contextData.diseaseResult.score * 100).toFixed(0)}%
          \n--- END DIAGNOSIS ---
          
          The user is asking a question about this specific case.
        `;
            } else {
                systemContext += `\nNo specific image has been analyzed yet. Answer general agricultural questions.`;
            }

            const prompt = `${systemContext}\n\nUser Question: ${text}`;

            // Call Gemini
            const responseText = await routeGeminiCall("CHAT_INTERACTIVE", prompt);

            // Add AI Response
            const aiMsg: ChatMessage = {
                id: crypto.randomUUID(),
                sender: 'ai',
                text: responseText,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, aiMsg]);

        } catch (error) {
            console.error("Chat Error:", error);
            const errorMsg: ChatMessage = {
                id: crypto.randomUUID(),
                sender: 'ai',
                text: "I'm having trouble connecting to the network. Please try again.",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        messages,
        isLoading,
        isOpen,
        toggleChat,
        sendMessage
    };
};
