# Future Implementation Roadmap

As RivalEye matures from an alert-based tool to a comprehensive Intelligence Platform, the following technical milestones are prioritized to deepen the value and defensibility of the product.

## 1. Time-Series Pricing Graphs (The "Chronological" Edge)
Currently, RivalEye is "Event-Driven" (notifies when a change happens). Pricing Graphs turn this into "Trend-Driven" intelligence.

### Technical Concept:
Using the historical `pricing_snapshots` table, we will generate multi-modal charts that track:
- **Price Trajectory**: Visualizing price increases/decreases over 6, 12, and 24 months.
- **Positioning Shifts**: Tracking how a competitor's "Featured Plan" changes over time.
- **Elasticity Inference**: If a competitor drops prices and shortly after raises them or adds a "Pro" tier, RivalEye will flag this as a "Failed Market Test" or "Successful Expansion."

### Aesthetic Direction (VisuaLab):
- **Tactile Timelines**: Use high-fidelity horizontal scales with **noise overlays** and **dot-grid** backgrounds.
- **Glow-Traces**: Line graphs that use the **emerald accent** with a subtle outer glow to signify "active intelligence."

---

## 2. Residential Proxy Integration (The "Invisible" Edge)
As we scale to target enterprise competitors (Salesforce, HubSpot, etc.), simple scraping (data center IPs) will be blocked by Cloudflare/Akamai.

### Technical Concept:
Swap the standard `Playwright` and `Firecrawl` outbound IPs for a **Residential Proxy Network** (e.g., Bright Data, Oxylabs).
- **Legitimate Traffic**: Requests will originate from actual household IPs (e.g., a Comcast or Verizon home connection) rather than a Google Cloud or AWS data center.
- **Bot Detection Bypass**: Residentials have a near-100% success rate against even the most aggressive "Bot Management" suites.
- **Geo-Precision**: Allows RivalEye to scrape a "Paris" pricing page from an actual ISP in Paris, providing 100% accurate regional pricing truth.

---

## 3. Positioning Radar (Phase 3)
A radical UI view that maps competitors on a 2D quadrant (e.g., "Price vs. Feature Density").
- **Dynamic Migration**: As a competitor changes their pricing schema, their dot on the radar "migrates" in real-time.
- **White Space Detection**: RivalEye identifies gaps in the market where no competitor currently sits, suggesting a pricing "White Space" for the user.
