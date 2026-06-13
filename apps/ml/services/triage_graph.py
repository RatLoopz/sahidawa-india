import os
import logging
from typing import List, Dict, Any, TypedDict, Literal
from pydantic import BaseModel, Field

# Check if LangChain and LangGraph are available
try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.prompts import ChatPromptTemplate
    from langgraph.graph import StateGraph, END
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    logging.warning("LangGraph or LangChain components are missing. Triage workflow will run mocked or fail.")

# ── Graph State Definition ───────────────────────────────────────────────────

class TriageState(TypedDict):
    messages: List[Dict[str, str]]    # [{ "role": "user"|"assistant", "content": "..." }]
    language: str                     # Detected language (e.g. English, Hindi, Tamil)
    emergency_detected: bool
    collected_info: Dict[str, Any]    # onset, severity, location, associated_symptoms
    clarifying_question: str
    final_summary: str
    recommendations: List[str]
    disclaimer: str
    response: str                     # The final response text sent back to the user

# ── Structured Extraction Schemas ─────────────────────────────────────────────

class EmergencyAssessment(BaseModel):
    is_emergency: bool = Field(description="True only if symptoms indicate a potential medical emergency requiring immediate attention (e.g. chest pain, breathing difficulty, severe bleeding, sudden paralysis, unconsciousness).")
    explanation: str = Field(description="Reasoning behind the emergency classification.")

class SymptomDetails(BaseModel):
    onset: str = Field(description="When the symptoms started (e.g. 'morning', '2 days ago'). Use 'unknown' if not mentioned.")
    severity: str = Field(description="Severity (e.g. 'mild', 'moderate', 'severe'). Use 'unknown' if not mentioned.")
    location: str = Field(description="Where in the body the symptoms are located. Use 'unknown' if not mentioned.")
    associated_symptoms: List[str] = Field(description="Other symptoms mentioned. Empty list if none.")
    is_complete: bool = Field(description="True only if onset, severity, location, and associated symptoms are sufficiently clear to make a triage assessment.")

class TriageAnalysis(BaseModel):
    summary: str = Field(description="One or two short sentences describing the likely condition and next steps.")
    recommendations: List[str] = Field(description="The 3 most important actions, each a short sentence.")
    disclaimer: str = Field(description="Brief medical disclaimer.")

# ── Node Implementations ──────────────────────────────────────────────────────

def get_llm(model: str = "gemini-2.5-flash"):
    api_key = os.getenv("GOOGLE_API_KEY")
    return ChatGoogleGenerativeAI(model=model, temperature=0, google_api_key=api_key)

def input_guardrail_node(state: TriageState) -> Dict[str, Any]:
    """
    Evaluates the latest user message for immediate life-threatening emergency signs.
    """
    logging.info("Running input_guardrail_node...")
    messages = state.get("messages", [])
    if not messages:
        return {"emergency_detected": False}

    last_user_message = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    if not last_user_message:
        return {"emergency_detected": False}

    try:
        llm = get_llm()
        structured_llm = llm.with_structured_output(EmergencyAssessment)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert emergency medical triager. Evaluate the user's message. Identify if it indicates an immediate medical emergency (e.g., chest pain, shortness of breath, severe bleeding, stroke, anaphylaxis)."),
            ("human", "{text}")
        ])
        
        chain = prompt | structured_llm
        result = chain.invoke({"text": last_user_message})
        
        logging.info(f"Guardrail assessment: is_emergency={result.is_emergency}, explanation={result.explanation}")
        return {"emergency_detected": result.is_emergency}
    except Exception as e:
        logging.error(f"Error in input_guardrail_node: {e}")
        # Default to False but log
        return {"emergency_detected": False}

def language_detector_node(state: TriageState) -> Dict[str, Any]:
    """
    Detects the user's input language to keep responses consistent.
    """
    logging.info("Running language_detector_node...")
    messages = state.get("messages", [])
    last_user_message = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "English")
    
    try:
        llm = get_llm()
        class LanguageDetection(BaseModel):
            language: str = Field(description="The primary language of the text, e.g. English, Hindi, Tamil, Telugu, Gujarati, Bengali.")

        structured_llm = llm.with_structured_output(LanguageDetection)
        prompt = ChatPromptTemplate.from_messages([
            ("system", "Determine the primary language of the text. Respond with a single language name."),
            ("human", "{text}")
        ])
        
        result = (prompt | structured_llm).invoke({"text": last_user_message})
        logging.info(f"Detected language: {result.language}")
        return {"language": result.language}
    except Exception as e:
        logging.error(f"Error in language_detector_node: {e}")
        return {"language": "English"}

def symptom_triage_node(state: TriageState) -> Dict[str, Any]:
    """
    Extracts symptom details from the conversation and determines if more details are needed.
    """
    logging.info("Running symptom_triage_node...")
    messages = state.get("messages", [])
    history_text = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in messages])
    
    try:
        llm = get_llm()
        structured_llm = llm.with_structured_output(SymptomDetails)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are analyzing a clinical chat history. Extract details regarding the onset, severity, location, and any associated symptoms. Assess if this information is complete enough to make a triage suggestion."),
            ("human", "{history}")
        ])
        
        details = (prompt | structured_llm).invoke({"history": history_text})
        logging.info(f"Symptom extraction: complete={details.is_complete}, details={details}")
        
        collected_info = {
            "onset": details.onset,
            "severity": details.severity,
            "location": details.location,
            "associated_symptoms": details.associated_symptoms
        }

        if not details.is_complete:
            # Generate a clarifying question in the user's language
            lang = state.get("language", "English")
            class ClarifyingQuestion(BaseModel):
                question: str = Field(description="A friendly, empathetic question asking for the missing symptom details (onset, severity, location, or associated symptoms) in the specified language.")

            prompt_q = ChatPromptTemplate.from_messages([
                ("system", "You are an empathetic medical assistant. Generate a single clarifying question in {language} to ask the user for missing details (onset, severity, location, or other symptoms). Keep it friendly and concise."),
                ("human", "Missing info: {missing_info}\nHistory: {history}")
            ])
            
            missing_fields = [k for k, v in collected_info.items() if v == "unknown" or not v]
            q_result = (prompt_q | llm.with_structured_output(ClarifyingQuestion)).invoke({
                "language": lang,
                "missing_info": ", ".join(missing_fields),
                "history": history_text
            })
            return {
                "collected_info": collected_info,
                "clarifying_question": q_result.question,
                "response": q_result.question
            }
            
        return {"collected_info": collected_info, "clarifying_question": ""}
    except Exception as e:
        logging.error(f"Error in symptom_triage_node: {e}")
        return {
            "collected_info": state.get("collected_info", {}),
            "clarifying_question": "Can you tell me more about your symptoms, specifically how long you've had them and where they are located?",
            "response": "Can you tell me more about your symptoms, specifically how long you've had them and where they are located?"
        }

def emergency_response_node(state: TriageState) -> Dict[str, Any]:
    """
    Formulates a critical emergency alert message.
    """
    logging.info("Running emergency_response_node...")
    lang = state.get("language", "English")
    try:
        llm = get_llm()
        class EmergencyText(BaseModel):
            message: str = Field(description="A clear, urgent notification in the requested language advising the user to contact emergency services or go to the nearest hospital immediately.")
            summary: str = Field(description="One sentence summary of the emergency.")

        prompt = ChatPromptTemplate.from_messages([
            ("system", "Formulate a critical, urgent notification in {language} advising the user to seek immediate professional medical attention or call emergency services. Do not offer self-care steps. Be direct, clear, and reassuring."),
            ("human", "State language: {language}")
        ])
        
        result = (prompt | llm.with_structured_output(EmergencyText)).invoke({"language": lang})
        return {
            "response": result.message,
            "final_summary": result.summary,
            "recommendations": ["Seek immediate medical attention", "Call emergency services", "Do not self-medicate"],
            "disclaimer": "EMERGENCY: These symptoms require immediate medical care."
        }
    except Exception as e:
        logging.error(f"Error in emergency_response_node: {e}")
        return {
            "response": "Please seek immediate medical attention. Your symptoms could indicate a medical emergency.",
            "final_summary": "Potential emergency symptoms detected.",
            "recommendations": ["Go to nearest emergency room", "Call an ambulance"],
            "disclaimer": "EMERGENCY: Urgent care required."
        }

def final_synthesis_node(state: TriageState) -> Dict[str, Any]:
    """
    Formulates the final non-emergency triage recommendations.
    """
    logging.info("Running final_synthesis_node...")
    lang = state.get("language", "English")
    history_text = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in state.get("messages", [])])
    
    try:
        llm = get_llm()
        structured_llm = llm.with_structured_output(TriageAnalysis)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are synthesizing a symptom triage report. Based on the user's symptoms, provide a short summary, 3 action items, and a standard disclaimer. Write everything in {language}."),
            ("human", "{history}")
        ])
        
        analysis = (prompt | structured_llm).invoke({"language": lang, "history": history_text})
        
        response_text = f"{analysis.summary}\n\nRecommendations:\n" + "\n".join([f"- {r}" for r in analysis.recommendations]) + f"\n\nDisclaimer: {analysis.disclaimer}"
        
        return {
            "final_summary": analysis.summary,
            "recommendations": analysis.recommendations,
            "disclaimer": analysis.disclaimer,
            "response": response_text
        }
    except Exception as e:
        logging.error(f"Error in final_synthesis_node: {e}")
        return {
            "response": "Based on your symptoms, we recommend checking in with a doctor. Rest and monitor your condition.",
            "final_summary": "Non-urgent symptoms analyzed.",
            "recommendations": ["Consult a doctor", "Rest and hydrate"],
            "disclaimer": "This information is for guidance only."
        }

# ── Routing Functions ─────────────────────────────────────────────────────────

def route_after_guardrail(state: TriageState) -> str:
    if state.get("emergency_detected", False):
        return "emergency_response"
    return "language_detector"

def route_after_triage(state: TriageState) -> str:
    clarifying = state.get("clarifying_question", "")
    if clarifying:
        # Triage details missing, ask the clarifying question
        return END
    # Triage details complete, compile final response
    return "final_synthesis"

# ── Graph Compilation ─────────────────────────────────────────────────────────

def build_triage_graph():
    workflow = StateGraph(TriageState)
    
    # Add Nodes
    workflow.add_node("input_guardrail", input_guardrail_node)
    workflow.add_node("language_detector", language_detector_node)
    workflow.add_node("symptom_triage", symptom_triage_node)
    workflow.add_node("emergency_response", emergency_response_node)
    workflow.add_node("final_synthesis", final_synthesis_node)
    
    # Define Flow
    workflow.set_entry_point("input_guardrail")
    
    # Conditional Edges
    workflow.add_conditional_edges(
        "input_guardrail",
        route_after_guardrail,
        {
            "emergency_response": "emergency_response",
            "language_detector": "language_detector"
        }
    )
    
    workflow.add_edge("language_detector", "symptom_triage")
    
    workflow.add_conditional_edges(
        "symptom_triage",
        route_after_triage,
        {
            END: END,
            "final_synthesis": "final_synthesis"
        }
    )
    
    workflow.add_edge("emergency_response", END)
    workflow.add_edge("final_synthesis", END)
    
    return workflow.compile()

# Instantiated compiled graph
triage_app = build_triage_graph() if LANGGRAPH_AVAILABLE else None

def run_triage_flow(messages: List[Dict[str, str]], locale: str = "en") -> Dict[str, Any]:
    """
    Interface function to run the compiled LangGraph triage workflow.
    """
    if not LANGGRAPH_AVAILABLE or triage_app is None:
        logging.warning("LangGraph is unavailable. Returning mock triage response.")
        # Fallback basic mock logic
        return {
            "response": "Hello, how can I help you? (Mock triage)",
            "emergency": False,
            "language": "English",
            "details": {}
        }
        
    initial_state = {
        "messages": messages,
        "language": "English",
        "emergency_detected": False,
        "collected_info": {},
        "clarifying_question": "",
        "final_summary": "",
        "recommendations": [],
        "disclaimer": "",
        "response": ""
    }
    
    try:
        final_state = triage_app.invoke(initial_state)
        return {
            "response": final_state.get("response", ""),
            "emergency": final_state.get("emergency_detected", False),
            "language": final_state.get("language", "English"),
            "summary": final_state.get("final_summary", ""),
            "recommendations": final_state.get("recommendations", []),
            "disclaimer": final_state.get("disclaimer", ""),
            "details": final_state.get("collected_info", {})
        }
    except Exception as e:
        logging.error(f"Error executing triage graph flow: {e}")
        return {
            "response": "An error occurred during symptom triage assessment. Please try again.",
            "emergency": False,
            "language": "English",
            "details": {}
        }
