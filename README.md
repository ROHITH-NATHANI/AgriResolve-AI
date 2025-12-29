<div align="center">
  <img src="https://github.com/user-attachments/assets/3e912edf-92bb-4903-8e44-fb6d545033b7" width="100%" alt="AgriResolve AI Banner">

  # AgriResolve AI
  ### Explainable AI for Early Crop Health Risk Assessment

  <p align="center">
    <img src="https://img.shields.io/badge/Status-Online-success?style=for-the-badge" alt="Status">
    <img src="https://img.shields.io/badge/AI-Gemini%202.5%20Flash-blue?style=for-the-badge" alt="AI Model">
    <img src="https://img.shields.io/badge/Stack-React%20%7C%20Vite%20%7C%20TypeScript-blueviolet?style=for-the-badge" alt="Tech Stack">
    <img src="https://img.shields.io/badge/Languages-10%2B-orange?style=for-the-badge" alt="Multilingual">
  </p>
</div>

---

## 🌾 Overview

**AgroResolve AI** is a professional-grade diagnostic tool designed to empower farmers and agronomists with instant, explainable insights into crop health. 

Built on the **Gemini 2.5** engine, it employs a unique **Multi-Agent Consensus System** where diverse AI personas (Defense, Pathology, Arbitration) debate the diagnosis in real-time before issuing a verdict. The application is fully multilingual, supporting **10 Indian languages** with instant, zero-cost switching.

## ✨ Key Features

### 🌍 Universal Multilingual Support
-   **10 Supported Languages**: English, Hindi, Telugu, Tamil, Malayalam, Kannada, Marathi, Bengali, Gujarati, Punjabi.
-   **Instant Translation Cache**: Switch languages *after* a scan without re-running the heavy analysis.
-   **Zero-Cost Switching**: Results are cached locally, so flipping between languages costs 0 API credits.
-   **Dynamic Content**: AI generates not just the UI, but the *analysis logic* (bullet points, rationale) in the target language.

### 🧠 Multi-Agent Analysis Pipeline
1.  **👁️ Vision Agent**: Scans textures and lesions (`Gemini 2.5 Vision`).
2.  **🛡️ Healthy Hypothesis Agent**: Argues for abiotic causes/healthy variations.
3.  **🦠 Disease Hypothesis Agent**: Argues for potential pathology risks.
4.  **⚖️ Arbitration Agent**: Weighs the debate and issues a final, confidence-weighted verdict.
5.  **📝 Explanation Agent**: Generates actionable guidance.

### 🎮 Immersive Experience
-   **3D Bio-Network Background**: Interactive neural particle system (`React Three Fiber`).
-   **Glassmorphism UI**: Premium "Gunmetal" aesthetic with frosted glass elements.
-   **Field Assistant Protocol**: Context-aware chat sidebar for follow-up questions.

## 🛠️ Technology Stack

-   **Frontend**: React 19, Vite 6, TypeScript
-   **AI**: Google Gemini 2.5 Flash (`@google/genai`)
-   **State/Internationalization**: `i18next`, `react-i18next`
-   **Styling**: Tailwind CSS v4, Framer Motion
-   **3D Graphics**: React Three Fiber, Maath

## 🚀 Getting Started

### Prerequisites
-   Node.js (v18+)
-   Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/AgroResolve-AI.git
    cd AgriResolve-AI
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Setup Environment**
    Create a `.env` file in the root directory:
    ```env
    VITE_GEMINI_API_KEY=your_api_key_here
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```

## ⚠️ Quota & Billing
This app uses **Gemini 2.5**, which has a strict free tier (~20 requests/day).
-   If you see **"Quota Exceeded"**, please link a billing account to your Google Cloud Project.
-   The "Pay-As-You-Go" tier is extremely cheap (~$0.10/million tokens) and removes these limits.

---

<p align="center">
  Built with ❤️ for precision agriculture.
</p>
