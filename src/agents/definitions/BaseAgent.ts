export interface BaseAgent {
    agentName: string;
    role: string;
    run(...args: any[]): Promise<any>;
}

export abstract class Agent implements BaseAgent {
    abstract agentName: string;
    abstract role: string;

    // Helper to standardise parsing JSON responses from LLMs
    protected parseJSON(text: string): any {
        try {
            // Remove any markdown code blocks if present
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanText);
        } catch (e) {
            console.error(`Failed to parse JSON from ${this.agentName}:`, text);
            throw new Error(`Invalid JSON response from ${this.agentName}`);
        }
    }

    abstract run(...args: any[]): Promise<any>;
}
