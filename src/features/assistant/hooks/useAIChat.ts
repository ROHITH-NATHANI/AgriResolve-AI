import { useState } from 'react';
import { AssessmentData } from '../../../types';
import { routeGeminiCall } from '../../../services/gemini';
import { checkUserSafety } from '../../../lib/safety';

export interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    timestamp: number;
}

import { useTranslation } from 'react-i18next';

export const useAIChat = (contextData: AssessmentData | null, locationContext?: string | null) => {
    const { t, i18n } = useTranslation();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    // Initial welcome message
    const toggleChat = () => {
        if (!isOpen && messages.length === 0) {
            setMessages([{
                id: 'welcome',
                sender: 'ai',
                text: t('assistant_placeholder') || "Hello! I'm your Field Assistant.", // Fallback if key missing
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
            const safety = checkUserSafety(text);
            if (safety.blocked) {
                const aiMsg: ChatMessage = {
                    id: crypto.randomUUID(),
                    sender: 'ai',
                    text: t('safety_refusal', {
                        defaultValue:
                            "I can’t help with chemical dosing/mixing or other potentially dangerous instructions. For safety, follow the product label/SDS and consult a qualified agronomist or local extension officer. If there was any exposure or poisoning risk, contact local emergency services/poison control immediately.",
                    }),
                    timestamp: Date.now(),
                };

                setMessages(prev => [...prev, aiMsg]);
                return;
            }

            // Construct Context-Aware Prompt
            let systemContext = `
        You are AgriResolve, a conservative Agricultural Field Assistant.
        Your goal is to help farmers and agronomists understand crop health issues based on the provided analysis.
        
        IMPORTANT: The user is speaking in language code: "${i18n.language}".
        You MUST answer in this language.

        If local context (location/weather) is provided:
        1. You MUST use it to tailor seasonality, irrigation timing, disease risk factors, and monitoring guidance.
        2. If the user asks about growing a specific plant, you MUST evaluate if it is suitable for the current local weather and season.
           - If the plant is NOT suitable (e.g., wrong season, temperature too extreme), explicitly WARN the user.
           - If the plant is invasive or unsafe for the region, provide a safety warning.
        3. Do NOT claim exact locality names if only coordinates are provided.
        4. Explicitly acknowledge in the FIRST sentence that you considered local weather/season conditions (without naming a specific town/village).
        
        PRINCIPLES:
        - Be helpful but conservative.
        - Do not invent certainty where there is none.
        - Use the specific leaf assessments provided below.
      `;

            if (locationContext) {
                systemContext += `

        --- LOCAL CONTEXT (user permission granted) ---
        ${locationContext}
        --- END LOCAL CONTEXT ---
        `;
            }

            if (contextData && contextData.arbitrationResult) {
                // Formatting Leaf Assessments for the prompt
                const leafCtx = contextData.leafAssessments
                    ? contextData.leafAssessments.map(l => `- ${l.id}: ${l.condition} (${(l.confidence * 100).toFixed(0)}% conf). Notes: ${l.notes}`).join('\n')
                    : "No individual leaf data.";

                // Formatting Uncertainty Factors
                const uncCtx = contextData.uncertaintyFactors
                    ? `Quality Issues: ${contextData.uncertaintyFactors.lowImageQuality ? 'YES' : 'No'}. Multiple Leaves: ${contextData.uncertaintyFactors.multipleLeaves ? 'YES' : 'No'}. Ambiguous: ${contextData.uncertaintyFactors.visuallySimilarConditions ? 'YES' : 'No'}.`
                    : "Uncertainty data not available.";

                systemContext += `
          \n--- CURRENT DIAGNOSIS ---
          Overall Decision: ${contextData.arbitrationResult.decision || "Unknown"}
          Explanation: ${contextData.explanation.summary}
          
          --- DETAILED ANALYSIS ---
          Visual Findings: ${contextData.visionEvidence?.anomalies_detected?.join(', ') || "None"}
          
          --- LEAF ASSESSMENTS ---
          ${leafCtx}
          
          --- UNCERTAINTY FACTORS ---
          ${uncCtx}
          
          Recommended Actions: ${contextData.explanation.guidance?.join(', ') || "None"}
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
