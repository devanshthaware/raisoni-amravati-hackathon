# AegisAuth 🛡️

AegisAuth is a production-grade **Adaptive Authentication & Risk Assessment Pipeline**. It provides developers with the tools to implement context-aware security, device fingerprinting, and real-time threat detection into any web application.

---

# 🧠 SYSTEM ARCHITECTURE OVERVIEW

AegisAuth is composed of four independent systems that work together to form a unified security product.

```text
                 ┌────────────────────┐
                 │    Aegis Platform   │
                 │     (frontend)      │
                 └──────────┬──────────┘
                            │ Issues API Key
                            ▼
┌────────────┐      ┌────────────────────┐      ┌────────────────────┐
│ Demo App   │─────▶│ SDK (Client Layer) │─────▶│ ML Backend         │
│ (SaaS App) │      │ (Integration Layer)│      │ (Risk Engine API)  │
└────────────┘      └────────────────────┘      └────────────────────┘
```

---

## 🏗️ The Four Pillars

### 1. 🔹 aegis-demo-app (The Consumer)
Your live demo SaaS application used to showcase the product.
- **Does**: Uses SDK, sends login/session signals, displays risk scores, simulates attacks.
- **Does NOT**: Calculate risk, train models, or store ML logic.

### 2. 🔹 sdk (The Integration)
The bridge between your application and the Aegis platform.
- **Does**: Collects device fingerprints, formats payloads, attaches API keys, calls backend `/predict/risk`, supports continuous monitoring.
- **Role**: Pure integration and abstraction layer.

### 3. 🔹 ml-backend (The Intelligence)
The risk engine microservice powered by machine learning.
- **Does**: Loads 5 ML models, runs inference, aggregates risk components, returns structured `RiskResponse`.
- **Role**: The stateless "brain" of the system.

### 4. 🔹 frontend (The Platform)
The AegisAuth admin console for security teams.
- **Does**: API key management, project oversight, threat analytics, session monitoring.
- **Does NOT**: Perform ML inference (it queries the backend/DB for results).

---

## 🔁 Complete Runtime Flow

### 🟢 Normal Login Flow
`Demo App` → `SDK` → `ML Backend (/predict/risk)` → `Return RiskResponse` → `Demo App UI Updates` → `Platform Dashboard Logs Updated`

### 🔴 Attack Flow (Mid-session)
`Attack Simulator` → `SDK checkRisk()` → `ML Backend` → `Risk Increase` → `RiskAggregator (CRITICAL)` → `Demo App Locks Session` → `Platform Logs Updated`

---

## 📡 Communication & Responsibility

### System Interaction
| System | Talks To | Protocol |
| :--- | :--- | :--- |
| **Demo App** | SDK | Direct Import |
| **SDK** | ML Backend | HTTP REST |
| **ML Backend** | Database | Internal |
| **Platform** | ML Backend | REST |
| **Platform** | Database | Direct |

### Separation of Concerns
| System | Responsibility |
| :--- | :--- |
| **Demo App** | UX + Simulation |
| **SDK** | Integration Abstraction |
| **ML Backend** | Intelligence (Inference) |
| **Platform** | Management + Analytics |

---

## 📂 Project Structure

```text
sbjit-project/
├── frontend/             # AegisAuth Platform Dashboard
├── ml-backend/           # FastAPI Risk Assessment Engine
├── sdk/                  # AegisAuth TypeScript SDK
├── aegis-demo-app/       # Reference SaaS Implementation
└── CURSOR.md             # AI Context & Master Prompt
```

---

## 🚀 Getting Started

To get the full system running locally, follow the setup guides in each subdirectory:
1. **Backend**: [ml-backend/README.md](./ml-backend/README.md)
2. **Dashboard**: [frontend/README.md](./frontend/README.md)
3. **SDK**: [sdk/README.md](./sdk/README.md)
4. **Demo**: [aegis-demo-app/README.md](./aegis-demo-app/README.md)

---

Built with ❤️ for a safer web.
