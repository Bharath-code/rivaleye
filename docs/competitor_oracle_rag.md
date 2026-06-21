# 🔮 Blueprint: Competitor Oracle (RAG-Powered Chat)

## 📌 Vision
Transform RivalEye from a reactive alerting tool into a **Strategic Intelligence Partner**. Users should be able to "chat" with the entire public footprint of their competitors to extract non-obvious insights, benchmark features, and simulate competitive moves.

---

## 🏗️ Technical Architecture

### 1. The Ingestion Pipeline (ELT)
- **Source**: Firecrawl `/crawl` endpoint.
- **API Pattern**:
  ```typescript
  const crawlResponse = await firecrawl.crawlUrl(url, {
    limit: 100,
    scrapeOptions: { formats: ["markdown"] } // Clean LLM-ready data
  });
  ```
- **Orchestration**: Weekly Trigger.dev task to keep the "Knowledge Base" fresh.
- **Processing**:
  - Split Markdown into semantic chunks (e.g., by headers).
  - Generate embeddings using OpenAI `text-embedding-3-small`.
  - Store in Supabase `competitor_knowledge` table with `pgvector`.

### 2. The Retrieval Engine (RAG)
- **Vector DB**: Supabase with `pgvector` extension.
- **Query Pattern**:
  ```sql
  -- match_competitor_knowledge RPC
  CREATE OR REPLACE FUNCTION match_competitor_knowledge (
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    p_competitor_id uuid
  ) RETURNS TABLE (id uuid, content text, metadata jsonb, similarity float)
  ```
- **Augmentation**: Combine retrieved chunks with the latest "Pricing Snapshot" and "Branding Extract".

### 3. The Chat Layer (Vercel AI SDK)
- **Model**: Gemini 1.5 Pro (large 1M+ context window).
- **Implementation**:
  ```typescript
  // Server Action
  const result = await streamText({
    model: google('gemini-1.5-pro'),
    messages,
    tools: {
      getLatestPricing: tool({ ... }),
      searchKnowledgeBase: tool({ ... })
    }
  });
  ```
- **Interface**: `useChat` hook for streaming responses.

---

## 💎 Pricing & Plan Alignment (Enterprise/Teams)

The "Competitor Oracle" is a high-cost, high-value feature and should be gated accordingly:

### 1. Teams Plan ($99/mo base + $15/seat)
- **Collaboration Base**: Includes 3 seats by default.
- **Limited Oracle**: Chat with up to 10 competitors across the team.
- **Shared History**: Shared oracle threads so the team doesn't repeat research.

### 2. Enterprise Plan ($199/mo base + $25/seat)
- **Unlimited Oracle Access**: Global knowledge base across all tracked markets.
- **Real-time Ingestion**: Knowledge base refreshed daily via Firecrawl.
- **Role-Based Access**: Manage who can "Search" vs "Simulate" (e.g., restricted tone simulation for junior staff).
- **Consolidated Billing**: One platform fee + variable seat count.

---

## ⚡ Specialized: Competitive Benchmarking Framework

Benchmarking is the most critical use case for RAG. It moves beyond "What changed?" to "Where do we stand?".

### 1. Automated Feature Parity Matrix
- **Mechanism**: The Oracle extracts feature lists from multiple competitors and maps them to a standardized "Capability Taxonomy" (e.g., Core API, Dashboard, Enterprise SSO).
- **Output**: A dynamic table comparing the user's functionality against the field.
- **Strategic Value**: Instantly see if you are a "Laggard", "Contender", or "Leader" in specific categories.

### 2. "Table Stakes" Gap Detection
- **Mechanism**: RAG analyzes the marketing pages of the top 3 competitors to identify features that *all* of them have but the user *doesn't*.
- **Output**: "Urgent Product Gaps" alerts (e.g., *"All major competitors now offer SAML; you are the only one without it."*)

### 3. Pricing-to-Value Mapping
- **Mechanism**: Cross-references price points (from our specific Pricing Engine) with feature chunks (from RAG).
- **Oracle Insight**: *"Competitor A offers 'Advanced Export' at $49, while you gate it at $199. You are losing the mid-market on this specific feature."*

### 4. Direct "Win/Loss" Simulation
- **Mechanism**: The user provides a hypothetical sales objection or a specific prospect requirement.
- **Oracle Response**: Simulates how each competitor would pitch against the user, using their crawled documentation to find their specific "Selling Points" and "Negative Patterns" they use against peers.

---

## 🎭 Generative Marketing & Tone Simulation

RAG isn't just for understanding; it's for **Counter-Action**. We leverage specialized embeddings for "Brand Identity" to help users out-market their competition.

### 1. The "Shadow Campaign" Planner
- **Mechanism**: RAG analyzes a competitor's historical blog posts and product launches to identify their "Preferred Channels" and "Keyword Obsessions."
- **Output**: A suggested counter-marketing plan (e.g., *"Competitor X always launches on Product Hunt on Tuesdays with a 'Developer First' angle. You should launch your rebuttal on Monday emphasizing 'Security/Compliance'."*)

### 2. AI-Powered Rebuttals (Tone Matching)
- **Mechanism**: Combine retrieved technical documentation (RAG) with extracted Branding Data.
- **Output**: Scripts for sales teams or social media drafts that match the *competitor's* perceived level of sophistication while subtly highlighting the user's advantages.
- **Tone Control**: Support for "Aggressive Disruption", "Quiet Authority", or "Helpful Peer" personas.

### 3. Content Positioning Alignment
- **Mechanism**: The Oracle identifies the "Semantic Gap" between the user's landing page copy and the competitor's top-performing crawled content.
- **Strategic Insight**: *"Your copy focuses on 'Efficiency', but the industry top-performer is now winning on 'Reliability'. Here is how to rewrite your Hero section to pivot without losing your brand DNA."*

---

## 📈 Cross-Competitor Synthesis (The "Market Map")

Instead of a single document search, the Oracle uses **Multi-Vector Retrieval** to synthesize data from the entire industry:

- **Aggregated Sentiment**: Detecting shifts in industry-wide messaging (e.g., "Is the market moving from 'Stability' to 'Speed'?").
- **Tone Mapping**: Plotting all competitors on a 2D axis of *Sophistication vs. Approachability* to find empty "Voice Spaces."
- **Innovation Velocity**: Measuring how often competitors update their docs/blogs vs the user's own velocity.
- **The 'Blue Ocean' Finder**: Using AI to find customer pain points mentioned in competitor support docs that nobody is solving yet.

---

## 🛠️ Updated Schema Updates (Vector Tags)

```sql
-- Knowledge Base for RAG
CREATE TABLE competitor_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID REFERENCES competitors(id),
    content TEXT, -- Markdown chunk
    metadata JSONB, -- {url, title, breadcrumb}
    embedding VECTOR(1536), -- Vector for similarity search
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 🚀 Execution Strategy (Phase 4)
1. **Pilot**: Implement "Chat with single competitor" first.
2. **Expansion**: Allow "Cross-competitor synthesis" (Multi-RAG).
3. **Advanced**: Feature "Competitor Newsroom" — an AI-curated daily brief that reads their blog/press and matches it against your roadmap.
