import os
from typing import Dict, Any, Optional
from typing_extensions import TypedDict
from dotenv import load_dotenv

from langchain_groq import ChatGroq
from langchain_tavily import TavilySearch
from langgraph.graph import StateGraph, START, END
from langchain_core.callbacks.base import BaseCallbackHandler
from langchain_core.outputs import LLMResult
from langgraph.checkpoint.redis.aio import AsyncRedisSaver
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

load_dotenv()

llm         = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.2)
search_tool = TavilySearch(max_results=3)

# =====================================================================
# COST TRACKER (unchanged from AGENT-OS)
# =====================================================================
INPUT_COST_PER_TOKEN  = 0.00000059
OUTPUT_COST_PER_TOKEN = 0.00000079

class CostTracker(BaseCallbackHandler):
    def __init__(self):
        self.total_input_tokens  = 0
        self.total_output_tokens = 0
        self.total_cost_usd      = 0.0
        self.call_count          = 0

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        usage         = response.llm_output.get("token_usage", {}) if response.llm_output else {}
        input_tokens  = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)
        self.total_input_tokens  += input_tokens
        self.total_output_tokens += output_tokens
        self.total_cost_usd      += (input_tokens  * INPUT_COST_PER_TOKEN +
                                     output_tokens * OUTPUT_COST_PER_TOKEN)
        self.call_count += 1
        print(f"   💰 LLM call #{self.call_count} | in={input_tokens} out={output_tokens} | run cost=${self.total_cost_usd:.6f}")

    def get_summary(self) -> Dict:
        return {
            "total_tokens" : self.total_input_tokens + self.total_output_tokens,
            "input_tokens" : self.total_input_tokens,
            "output_tokens": self.total_output_tokens,
            "cost_usd"     : round(self.total_cost_usd, 6),
            "llm_calls"    : self.call_count,
        }

    def reset(self):
        self.total_input_tokens  = 0
        self.total_output_tokens = 0
        self.total_cost_usd      = 0.0
        self.call_count          = 0

cost_tracker = CostTracker()


# =====================================================================
# 1. SHARED STATE — DueSight version
# =====================================================================
# CHANGED: "task" → "company_name" (clearer intent)
# NEW: competitor_data, risk_data, swot_analysis
# =====================================================================
class PlatformState(TypedDict):
    company_name    : str              # ── CHANGED: was "task"
    plan            : str
    research_data   : str
    competitor_data : str              # ── NEW
    risk_data       : str              # ── NEW
    current_draft   : str              # holds the final investment memo
    review_feedback : str
    loop_count      : int
    review_score    : int
    human_approved  : Optional[bool]
    human_feedback  : Optional[str]


# =====================================================================
# RETRY WRAPPER (unchanged)
# =====================================================================
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
def _search_with_retry(query: str) -> Any:
    print("   🔄 Calling Tavily search...")
    return search_tool.invoke({"query": query})


# =====================================================================
# 2. AGENT NODES — DueSight pipeline
# =====================================================================

def planner_node(state: PlatformState) -> Dict:
    """
    CHANGED: Planner now creates a due-diligence research plan
    instead of a generic task roadmap.
    """
    print("\n[🧠 Planner Agent] Building due-diligence research plan...")
    prompt = (
        f"You are a venture capital research analyst. A founder wants to evaluate: "
        f"'{state['company_name']}'.\n\n"
        f"Create a structured due-diligence research plan covering:\n"
        f"1. Company overview (founding, product, team, funding history)\n"
        f"2. Market opportunity and target customer\n"
        f"3. Key metrics to investigate (revenue signals, growth, traction)\n"
        f"List this as a clear numbered plan."
    )
    if state.get("review_feedback"):
        prompt += (
            f"\n\nPrevious AI review score: {state.get('review_score', 0)}/10"
            f"\nAI feedback: {state['review_feedback']}"
        )
    if state.get("human_approved") is False and state.get("human_feedback"):
        prompt += (
            f"\n\n⚠️ HUMAN REVIEWER REJECTED the previous memo."
            f"\nHuman feedback (fix this first):\n{state['human_feedback']}"
        )
    response = llm.invoke(prompt, config={"callbacks": [cost_tracker]})
    return {
        "plan"          : response.content,
        "loop_count"    : state.get("loop_count", 0) + 1,
        "human_approved": None,
        "human_feedback": None,
    }


def researcher_node(state: PlatformState) -> Dict:
    """
    CHANGED: Researches the specific company — overview, funding,
    team, product — instead of a generic task topic.
    """
    print("\n[🔍 Research Agent] Gathering company intelligence...")
    query = f"{state['company_name']} company overview funding team product"
    try:
        results = _search_with_retry(query)
    except Exception as e:
        print(f"   ❌ Tavily failed: {e}")
        results = "Web search unavailable. Use general knowledge."

    prompt = (
        f"Summarize key facts about '{state['company_name']}' from this research:\n{results}\n\n"
        f"Cover: founding story, product/service, team background, funding raised, "
        f"target market. Be factual and cite what you find."
    )
    response = llm.invoke(prompt, config={"callbacks": [cost_tracker]})
    return {"research_data": response.content}


# =====================================================================
# NEW — COMPETITOR AGENT
# =====================================================================
def competitor_node(state: PlatformState) -> Dict:
    """
    NEW AGENT: Identifies and analyzes top competitors of the company.
    Searches live web for competitive landscape, then synthesizes
    a comparison covering positioning, pricing, and market share.
    """
    print("\n[⚔️ Competitor Agent] Mapping competitive landscape...")
    query = f"{state['company_name']} competitors alternatives market comparison"
    try:
        results = _search_with_retry(query)
    except Exception as e:
        print(f"   ❌ Tavily failed: {e}")
        results = "Web search unavailable. Use general knowledge."

    prompt = (
        f"Based on this research about competitors to '{state['company_name']}':\n{results}\n\n"
        f"Identify the top 3-5 competitors. For each one, describe:\n"
        f"- Their positioning vs {state['company_name']}\n"
        f"- Relative strengths and weaknesses\n"
        f"- Estimated market share or scale if known\n"
        f"Format as a clear competitor comparison."
    )
    response = llm.invoke(prompt, config={"callbacks": [cost_tracker]})
    return {"competitor_data": response.content}


# =====================================================================
# NEW — RISK AGENT
# =====================================================================
def risk_node(state: PlatformState) -> Dict:
    """
    NEW AGENT: Identifies risks across regulatory, market, team,
    and technology dimensions based on all research gathered so far.
    """
    print("\n[⚠️ Risk Agent] Identifying investment risks...")
    prompt = (
        f"You are a risk analyst reviewing '{state['company_name']}' for investment.\n\n"
        f"Company research:\n{state['research_data']}\n\n"
        f"Competitor landscape:\n{state['competitor_data']}\n\n"
        f"Identify risks in these categories:\n"
        f"1. Market risk (competition, market saturation, timing)\n"
        f"2. Regulatory risk (compliance, legal exposure)\n"
        f"3. Team risk (execution capability, key-person dependency)\n"
        f"4. Technology risk (moat, defensibility, technical debt)\n"
        f"For each identified risk, rate severity as LOW / MEDIUM / HIGH."
    )
    response = llm.invoke(prompt, config={"callbacks": [cost_tracker]})
    return {"risk_data": response.content}


def writer_node(state: PlatformState) -> Dict:
    """
    CHANGED: Compiles all research into a structured investment
    memo with SWOT analysis instead of a generic document.
    """
    print("\n[✍️ Report Agent] Compiling investment memo...")
    prompt = (
        f"Write a professional investment memo for '{state['company_name']}'.\n\n"
        f"RESEARCH PLAN:\n{state['plan']}\n\n"
        f"COMPANY RESEARCH:\n{state['research_data']}\n\n"
        f"COMPETITOR ANALYSIS:\n{state['competitor_data']}\n\n"
        f"RISK ASSESSMENT:\n{state['risk_data']}\n\n"
        f"CRITICAL WRITING RULES — a memo that breaks these will be REJECTED:\n"
        f"1. Never repeat the same phrase or claim in more than one section. "
        f"Each section must add NEW information — do not restate what a previous section said.\n"
        f"2. Do not use vague filler phrases (e.g. 'growing revenue growth', or any phrase "
        f"appearing more than once across the whole memo). Vary your word choice and sentence openings.\n"
        f"3. You MUST include ALL 8 sections below in this exact order, with these exact headers. "
        f"Section 8 is mandatory — never omit it.\n\n"
        f"Structure the memo with these 8 sections:\n"
        f"1. EXECUTIVE SUMMARY (2-3 paragraphs: what the company does, why it matters, one-sentence thesis)\n"
        f"2. COMPANY OVERVIEW (founding, product, team, funding — do not repeat section 1's wording)\n"
        f"3. MARKET OPPORTUNITY (TAM/SAM/SOM, growth trajectory, timing)\n"
        f"4. COMPETITIVE LANDSCAPE (top competitors, positioning, moat — new details only)\n"
        f"5. SWOT ANALYSIS (Strengths, Weaknesses, Opportunities, Threats — each bullet distinct, no repeats)\n"
        f"6. RISK ASSESSMENT (categorized risks with LOW/MEDIUM/HIGH severity)\n"
        f"7. INVESTMENT RECOMMENDATION (one clear word: INVEST/PASS/MONITOR, then 2-3 sentences of reasoning)\n"
        f"8. KEY QUESTIONS FOR MANAGEMENT (exactly 5 numbered questions an investor should ask the founders — MANDATORY, do not skip)\n"
    )
    if state.get("review_score", 0) > 0 and state.get("review_feedback"):
        prompt += (
            f"\n\nRevision loop #{state.get('loop_count', 1)}. "
            f"Previous score: {state['review_score']}/10. "
            f"Fix: {state['review_feedback']}"
        )
    response = llm.invoke(prompt, config={"callbacks": [cost_tracker]})
    return {"current_draft": response.content}


# =====================================================================
# HUMAN REVIEW NODE (unchanged from AGENT-OS)
# =====================================================================
def human_review_node(state: PlatformState) -> Dict:
    approved = state.get("human_approved")
    feedback = state.get("human_feedback", "")
    print(f"\n[👤 Human Review] Decision: {'APPROVED' if approved else 'REJECTED'} | feedback='{feedback}'")
    return {}


def reviewer_node(state: PlatformState) -> Dict:
    """
    CHANGED: Reviews the memo for due-diligence completeness
    instead of generic quality criteria.
    """
    print("\n[🛡️ Reviewer Agent] Auditing memo completeness...")
    prompt = (
        f"Review this investment memo for '{state['company_name']}'.\n\n"
        f"MEMO:\n{state['current_draft']}\n\n"
        f"Score 0-10 based on:\n"
        f"- Does it include ALL 8 required sections (Executive Summary, Company Overview, Market "
        f"Opportunity, Competitive Landscape, SWOT, Risk Assessment, Investment Recommendation, "
        f"Key Questions for Management)? Missing even ONE section caps the score at 5 maximum. (3 points)\n"
        f"- Is the SWOT analysis specific and well-reasoned, with no repeated bullets? (3 points)\n"
        f"- Are risks clearly identified with severity ratings? (2 points)\n"
        f"- Is the writing free of repeated phrases/claims across sections? Scan for any phrase, "
        f"sentence, or claim that appears more than once in the memo — if found, deduct 2 points "
        f"and this cannot score above 6. (2 points)\n\n"
        f"BE STRICT. A memo with repetitive filler language or a missing section is NOT investment-grade "
        f"regardless of how complete it otherwise looks.\n\n"
        f"FORMAT:\nSCORE: [0-10]\nVERDICT: [APPROVED or REJECTED]\n"
        f"FEEDBACK: [list every missing section AND every repeated phrase found, or 'Meets all due-diligence standards.']\n"
        f"RULES: 7+ = APPROVED. 6 or below = REJECTED."
    )
    response      = llm.invoke(prompt, config={"callbacks": [cost_tracker]})
    feedback_text = response.content
    score = 0
    for line in feedback_text.split("\n"):
        if line.strip().upper().startswith("SCORE:"):
            try:
                score = int(line.split(":")[1].strip().split()[0])
                score = max(0, min(10, score))
            except (ValueError, IndexError):
                score = 0
            break
    verdict = "APPROVED" if score >= 7 else "REJECTED"
    print(f"   📊 Review score: {score}/10 → {verdict}")
    return {"review_feedback": feedback_text, "review_score": score}


# =====================================================================
# 3. ROUTING FUNCTIONS (unchanged)
# =====================================================================

def route_after_human(state: PlatformState) -> str:
    if state.get("human_approved") is True:
        print("   ✅ Human approved → routing to AI Reviewer.")
        return "go_to_reviewer"
    print("   🔄 Human rejected → routing back to Planner.")
    return "go_to_planner"


def routing_gatekeeper(state: PlatformState) -> str:
    score      = state.get("review_score", 0)
    loop_count = state.get("loop_count", 0)
    if loop_count >= 3:
        print(f"\n⚠️  Max loops reached. Force-exiting. Score: {score}/10")
        return "exit_pipeline"
    if score >= 7:
        print(f"\n✅ Score {score}/10 — APPROVED.")
        return "exit_pipeline"
    print(f"\n🔄 Score {score}/10 — REJECTED. Loop {loop_count}/3")
    return "send_to_planner"


# =====================================================================
# 4. GRAPH — DueSight pipeline
# =====================================================================
# NEW FLOW:
#   START → planner → researcher → competitor → risk → writer
#           → human_review → reviewer → END (or loop back)
# =====================================================================
workflow = StateGraph(PlatformState)

workflow.add_node("planner",      planner_node)
workflow.add_node("researcher",   researcher_node)
workflow.add_node("competitor",   competitor_node)   # ── NEW
workflow.add_node("risk",         risk_node)          # ── NEW
workflow.add_node("writer",       writer_node)
workflow.add_node("human_review", human_review_node)
workflow.add_node("reviewer",     reviewer_node)

workflow.add_edge(START,        "planner")
workflow.add_edge("planner",    "researcher")
workflow.add_edge("researcher", "competitor")   # ── NEW EDGE
workflow.add_edge("competitor", "risk")          # ── NEW EDGE
workflow.add_edge("risk",       "writer")        # ── NEW EDGE
workflow.add_edge("writer",     "human_review")

workflow.add_conditional_edges(
    "human_review", route_after_human,
    {"go_to_reviewer": "reviewer", "go_to_planner": "planner"}
)
workflow.add_conditional_edges(
    "reviewer", routing_gatekeeper,
    {"send_to_planner": "planner", "exit_pipeline": END}
)