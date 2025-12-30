# PRD: Web UI for MCP Server Interaction

**Issue**: [#1](https://github.com/vfarcic/dot-ai-ui/issues/1)
**Created**: 2025-09-17
**Status**: In Progress (blocked on MCP chat endpoint)
**Priority**: Medium

> *Migrated from [vfarcic/dot-ai#109](https://github.com/vfarcic/dot-ai/issues/109)*

---

## Executive Summary

Create a web-based user interface that communicates with the DevOps AI Toolkit MCP server via its REST API. The Web UI provides visual, interactive interfaces for deploying applications, managing organizational patterns, and troubleshooting Kubernetes issues—offering an accessible alternative to CLI-based MCP clients like Claude Code.

**Key Technical Approach:**
- Separate repository from `dot-ai` MCP server
- Uses existing REST API gateway (no MCP protocol in Web UI)
- TypeScript types auto-generated from OpenAPI schema
- Direct React component rendering from semantic JSON responses
- **Visualization-only model**: UI displays rich visualizations, user interacts via chat/text
- **Typed content blocks**: MCP returns typed data (`image`, `cards`, `code`), UI renders appropriately
- **MVP: Server-generated images**: MCP generates Mermaid diagrams → SVG, UI simply displays them (no graph libraries needed)

## Problem Statement

### Current State
- MCP server provides powerful Kubernetes AI capabilities through CLI clients (Claude Code, Cursor)
- Users must use MCP-compatible editors or command-line tools to interact with the system
- No web-based interface exists for users who prefer browser-based interactions
- Visual data representation is limited in text-based CLI environments

### Pain Points
- **Accessibility Barrier**: Users unfamiliar with CLI tools or MCP clients can't easily access the system
- **Limited Visualization**: Complex Kubernetes data and AI recommendations are hard to visualize in text-only interfaces
- **User Experience Gap**: No graphical interface for exploring cluster capabilities, solutions, and deployments
- **Sharing & Collaboration**: Difficult to share visual insights or collaborate on deployment decisions

## Success Criteria

### User Experience Success
- [ ] Users can interact with all MCP functionality through a web browser
- [ ] Chat interface provides intuitive conversation flow similar to Claude Code
- [ ] Complex data (cluster capabilities, recommendations, manifests) displays with visual representations
- [ ] Response time for MCP tool calls under 3 seconds for standard operations

### Technical Success
- [ ] Web UI successfully connects to and communicates with existing MCP server
- [ ] All current MCP tools accessible through the web interface
- [ ] Visual components render Kubernetes resources, deployment statuses, and AI recommendations
- [ ] System handles concurrent users without performance degradation

### Business Success
- [ ] Increased MCP adoption due to improved accessibility
- [ ] Positive user feedback on visual data representation
- [ ] Documentation demonstrates clear setup and usage workflows

## Target Users

### Primary Users
- **DevOps Engineers**: Need visual overview of cluster capabilities and deployment status
- **Platform Engineers**: Want graphical interface for managing AI recommendations and solutions
- **Developers**: Prefer browser-based tools over CLI for exploring Kubernetes deployment options

### Secondary Users
- **Engineering Managers**: Need visual dashboards for understanding deployment patterns and cluster usage
- **Site Reliability Engineers**: Want graphical monitoring of AI-assisted deployment outcomes

## User Stories & Workflows

### Core User Journey
```
User opens Web UI → Authenticated session → Chat interface loads →
User types intent ("deploy web app") → MCP processes request →
Visual solution cards displayed → User types selection in chat →
MCP returns configuration questions as visualization → User types answers →
Deployment manifests shown with syntax highlighting →
User types "deploy" → Status updates shown graphically
```

**Note on Interaction Model**: Users interact via text/chat, not forms or buttons. The UI displays rich visualizations (graphs, cards, code), but all user input flows through the chat. This simplifies cross-platform compatibility and leverages AI's ability to interpret natural language.

### Detailed User Stories

**As a DevOps Engineer**, I want to:
- See cluster capabilities as interactive graphs/cards rather than text lists
- View configuration options as visual cards while typing my choices in chat
- View generated Kubernetes manifests with syntax highlighting and collapsible sections
- Monitor deployment progress through visual status indicators

**As a Platform Engineer**, I want to:
- Browse solution patterns through a visual catalog interface
- See organizational patterns visualized as relationship graphs
- Visualize resource dependencies as interactive graphs (Cluster Capability Map)
- Share deployment configurations via shareable URLs

**As a Developer**, I want to:
- Chat with the AI in a familiar interface similar to ChatGPT/Claude
- See deployment recommendations as visual comparison cards
- Preview deployment topology (how resources relate) before deploying
- Get visual feedback on deployment success/failure with actionable next steps

## Technical Architecture

### High-Level Architecture
```
[Web Browser] ↔ [Frontend (React)] ↔ [REST API] ↔ [Existing MCP Server] ↔ [Kubernetes API]
                      ↓
                Parse semantic JSON
                      ↓
                Render React components
```

### Technical Design Decisions

**Data Flow:**
```
MCP Server REST API → Semantic JSON → Web UI → Parse JSON → Render React Components
```

The MCP server's existing REST API gateway returns structured, semantic JSON. The Web UI:
1. Fetches OpenAPI 3.0 schema from `GET /api/v1/openapi`
2. Generates TypeScript types from OpenAPI schema
3. Makes REST API calls to `POST /api/v1/tools/{toolName}`
4. Parses semantic JSON from responses
5. Renders directly using React components

**Key Architectural Principles:**
- **Server stays UI-agnostic**: MCP server returns semantic JSON, no UI-specific formatting
- **Web UI controls presentation**: Full control over styling, layout, and interactions
- **OpenAPI provides contract**: Types generated automatically, no shared code needed
- **No transformation layer**: Direct rendering from semantic JSON to React components
- **Standard HTTP**: Simple REST API calls, no MCP protocol complexity in Web UI

**What We're NOT Doing:**
- Microsoft Adaptive Cards (unnecessary transformation layer for single-platform web app)
- MCP-UI or Remote DOM (returns HTML/components instead of data; couples server to UI)
- Server-driven UI (couples server to presentation logic, breaks other clients)
- MCP protocol in Web UI (REST API is simpler and sufficient)
- Custom UI protocol (semantic JSON from server is already structured)
- Complex form/button interactions (use chat-based input; AI interprets natural language)
- Cross-platform client SDKs (focus on Web UI first; other clients are future scope)

**Format Standardization:**
During Web UI development, if multiple tools return semantically identical data in different formats (e.g., questions, solutions, status), we will standardize these in the MCP server to:
- Simplify Web UI component architecture
- Provide cleaner OpenAPI schema
- Benefit all future clients

### Typed Content Blocks

MCP responses include typed visualization blocks that the UI renders based on type, not tool identity. This decouples visualization from specific tools.

**Visualization Types:**
```typescript
type Visualization =
  | { type: "text", data: string }
  | { type: "code", data: { content: string, language: string } }
  | { type: "table", data: { headers: string[], rows: string[][] } }
  | { type: "cards", data: { items: Card[] } }
  | { type: "image", data: ImageData }              // MVP: MCP-generated diagrams
  | { type: "graph", data: GraphData }              // Future: interactive graphs
  | { type: "tree", data: { root: TreeNode } }
  | { type: "diff", data: { before: string, after: string } }
  | { type: "progress", data: { steps: Step[], current: number } }

interface Card {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, string>;
}

// MVP: MCP generates images (Mermaid → SVG)
interface ImageData {
  format: "svg" | "png";
  content: string;                    // Inline SVG or base64-encoded PNG
  alt: string;                        // Accessibility description
  source?: "mermaid" | "graphviz";    // How the image was generated
}

// Future: Interactive graphs (requires D3/Cytoscape in UI)
interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

interface Node {
  id: string;
  label: string;
  category?: string;
  metadata?: Record<string, any>;
}

interface Edge {
  from: string;
  to: string;
  label?: string;
  relationship?: string;
}
```

**MVP Approach: Server-Generated Images**

For MVP, the MCP server generates diagram images using Mermaid, and the UI simply displays them. This dramatically simplifies the UI (no graph libraries needed) while still providing visual value.

| Visualization | MVP Approach | Future Enhancement |
|---------------|--------------|-------------------|
| Cluster Capability Map | Mermaid → SVG image | Interactive D3/Cytoscape graph |
| Remediation Flow | Mermaid flowchart → SVG | Interactive step-through |
| Deployment Topology | Mermaid → SVG | Interactive preview |
| Solution Cards | Structured data (cards type) | Same |
| Code/Manifests | Structured data (code type) | Same |

**Why Mermaid for MVP:**
- Deterministic output (same input = same diagram)
- Fast generation (milliseconds)
- No API costs (unlike AI image generation)
- High quality SVG output
- Well-suited for flowcharts, graphs, sequence diagrams

**Response Structure:**
```typescript
interface MCPVisualizationResponse {
  message: string;                    // AI's text response (rendered in chat)
  visualizations?: Visualization[];   // Visual elements to render
  prompt?: string;                    // Suggested follow-up question
  workflow?: {
    sessionId: string;
    progress?: { current: number, total: number, label?: string };
  }
}
```

**Example Response:**
```json
{
  "message": "Here are the available solutions for PostgreSQL deployment:",
  "visualizations": [
    {
      "type": "cards",
      "data": {
        "items": [
          { "id": "sol-1", "title": "PostgreSQL Operator", "tags": ["HA", "recommended"] },
          { "id": "sol-2", "title": "Helm Chart", "tags": ["simple"] }
        ]
      }
    }
  ],
  "prompt": "Which solution would you like? You can say 'the HA one' or 'compare them'.",
  "workflow": { "sessionId": "rec-123", "progress": { "current": 1, "total": 5 } }
}
```

### AI-Generated Visualization Data

For complex visualizations like the **Cluster Capability Map**, the AI generates the visualization. The MCP server doesn't just return raw capability lists—it uses AI to infer relationships and generate diagrams.

**MVP: AI → Mermaid → SVG Pipeline**
```
AI analyzes CRDs → Generates Mermaid code → Renders to SVG → Returns image
```

**Example: Capability Map Generation**
```typescript
// Instead of returning flat list:
{ capabilities: [{ kind: "VPC" }, { kind: "Subnet" }, { kind: "SecurityGroup" }] }

// MCP returns AI-generated Mermaid diagram as SVG:
{
  "visualizations": [{
    "type": "image",
    "data": {
      "format": "svg",
      "content": "<svg>...</svg>",  // Rendered Mermaid diagram
      "alt": "Cluster capabilities: VPC contains Subnet and SecurityGroup. Subnet and SecurityGroup both require VPC.",
      "source": "mermaid"
    }
  }]
}

// The AI internally generated this Mermaid code:
// graph TD
//     subgraph Networking
//         VPC[VPC]
//         Subnet[Subnet] -->|requires| VPC
//         SG[SecurityGroup] -->|requires| VPC
//     end
```

The AI analyzes CRD schemas and infers:
- Logical groupings (networking, databases, observability)
- Dependency relationships (Subnet requires VPC)
- Composition patterns (resources typically deployed together)

**Benefits of Server-Side Image Generation:**
- UI is trivially simple (just display `<img>` or inline SVG)
- Same image works in Web UI, future Claude Code (with graphics), documentation
- AI controls the visualization logic, not the UI
- No graph library complexity in frontend

### Fallback Representations (Future-Proofing)

To support future clients with varying capabilities (e.g., Claude Code if terminal graphics are added), visualizations can include fallback representations:

```typescript
{
  type: "graph",
  data: { nodes: [...], edges: [...] },
  render: {
    mermaid: "graph TD; VPC-->Subnet; VPC-->SecurityGroup",
    ascii: "VPC\n├── Subnet\n└── SecurityGroup",
    text: "VPC contains Subnet and SecurityGroup"
  }
}
```

| Client | Renders |
|--------|---------|
| Web UI | Interactive graph from `data` |
| Future Claude Code (with graphics) | Mermaid or image |
| Current Claude Code | ASCII or text fallback |

**Note**: Fallback generation can happen server-side (MCP generates all formats) or client-side (client transforms `data`). Start with server-side for simplicity.

### Component Breakdown

**Frontend Application**
- **API Client**: TypeScript types auto-generated from OpenAPI schema
- **REST Communication**: Standard HTTP fetch/axios calls to MCP server
- **React Components**: Direct rendering (SolutionPicker, ManifestViewer, QuestionForm, etc.)
- **UI Library**: Material-UI (MUI) or shadcn/ui for base components
- **State Management**: User sessions, conversation history, deployment tracking

**Backend Integration (Required MCP Server Additions)**
- **MCP Server**: Existing REST API gateway at `/api/v1/*`
- **OpenAPI Endpoint**: Schema available at `GET /api/v1/openapi`
- **Tool Endpoints**: All tools at `POST /api/v1/tools/{toolName}` (called internally by MCP, not directly by Web UI)
- **CORS**: Already configured for cross-origin requests
- **New**: Mermaid.js integration for diagram generation (server-side rendering to SVG)
- **New (Required)**: Unified chat endpoint at `POST /api/v1/chat` (see Chat Endpoint Architecture below)

### Chat Endpoint Architecture

The Web UI is a presentation layer without AI capabilities. It cannot determine which tool endpoint to call based on natural language. The MCP server provides a unified chat endpoint where **MCP acts as an AI agent** and **Web UI acts as the agent's interface**.

**Key Design Principles:**
- MCP handles all AI logic (intent classification, tool selection, response generation)
- Web UI handles presentation only (rendering visualizations, managing UI state)
- **Conversation state**: Echo-back model - Web UI sends `lastResponse` + new `message`
- **Workflow state**: MCP maintains server-side via `sessionId`
- MCP is **stateless for conversation history** but **stateful for active workflows**

**Chat Endpoint API:**

```
POST /api/v1/chat
```

**New Conversation Request** (no prior context):
```json
{
  "message": "deploy a postgres database"
}
```

**Continuation Request** (with prior context):
```json
{
  "lastResponse": {
    "message": "Here are 3 PostgreSQL deployment options...",
    "sessionId": "rec-123",
    "toolUsed": "recommend",
    "prompt": "Which solution would you like?"
  },
  "message": "I'll take option 1"
}
```

**Response:**
```json
{
  "message": "Great choice! I need a few details to configure the PostgreSQL Operator...",
  "visualizations": [
    { "type": "cards", "data": { "items": [...] } }
  ],
  "sessionId": "rec-123",
  "toolUsed": "recommend",
  "prompt": "What size database do you need?"
}
```

**State Management:**
| State Type | Managed By | How |
|------------|------------|-----|
| Conversation context | Web UI | Echo back `lastResponse` (excluding `visualizations`) |
| Workflow state | MCP Server | Server-side, keyed by `sessionId` |
| UI state | Web UI | Local (which visualizations shown, scroll position, etc.) |

**New Conversation / Clear:**
- Web UI provides "New Chat" button (similar to `/clear` in Claude Code)
- Clears stored `lastResponse`
- Next message sent without `lastResponse` field → MCP treats as new conversation

**Intent Classification (MCP Server Responsibility):**
| User Intent Pattern | Tool |
|---------------------|------|
| deploy, create, setup, install, run, launch | `recommend` |
| fix, remediate, troubleshoot, why is, what's wrong | `remediate` |
| scale, update, rollback, delete, restart | `operate` |
| patterns, policies, capabilities, scan | `manageOrgData` |
| setup project, audit repo, add README, add LICENSE | `projectSetup` |
| General questions, no tool match | Direct AI response (no tool call) |

**Note**: The chat endpoint is a **blocking dependency** for Web UI functionality. Individual tool endpoints (`/api/v1/tools/{toolName}`) remain available for direct MCP client access but are not used by the Web UI.

### Technology Stack

**Frontend** (Decided)
- **Framework**: React with Vite
- **Language**: TypeScript
- **API Client**: Manual TypeScript types (OpenAPI generator available via `npm run generate:api` for future use)
- **UI Components**: Tailwind CSS (shadcn/ui components to be added as needed)
- **Styling**: Tailwind CSS v4
- **State Management**: React hooks + Context (conversation state: `lastResponse` echo-back)
- **Syntax Highlighting**: Prism.js or react-syntax-highlighter (to be added)
- **HTTP Client**: Fetch API
- **Graph Visualization**: Not needed for MVP (server generates images); Future: D3.js, Cytoscape.js, or React Flow

**Backend (dot-ai MCP Server - Minor Additions)**
- **REST API Gateway**: Already implemented
- **OpenAPI 3.0**: Auto-generated specification
- **Response Format**: Semantic JSON with typed visualization blocks
- **Diagram Generation**: Mermaid.js for rendering diagrams to SVG (new dependency)
- **Image Pipeline**: AI generates Mermaid code → Mermaid renders to SVG → Return in response

## Feature Requirements

### Must-Have Features (MVP)

#### Intent Input Interface
- [ ] Text input for entering deployment intents and queries
- [ ] History of previous intents and results
- [ ] Loading states during REST API calls
- [ ] Quick action buttons for common operations

**Note**: Primary UX combines chat input with rich visual output. Users type intents and responses in chat; the UI renders results as visual components (graphs, cards, code). This "visualization-only" model keeps interaction simple while maximizing visual value.

#### REST API Tool Integration
- [ ] All existing MCP tools accessible via REST API
- [ ] Support for `recommend`, `chooseSolution`, `answerQuestion`, `generateManifests`, `deployManifests`
- [ ] Support for `manageOrgData`, `remediate`, `projectSetup` workflows
- [ ] Proper error handling for REST API failures

#### Visual Data Representation
- [ ] Cluster capabilities displayed as Mermaid-generated diagrams (Cluster Capability Map)
- [ ] Solution options shown as visual cards with comparison capability
- [ ] Kubernetes manifests with syntax highlighting and collapsible sections
- [ ] Deployment status with progress indicators and success/error states
- [ ] Remediation investigation flow as Mermaid flowchart diagrams

#### Core Workflows
- [ ] Solution recommendation → configuration → deployment flow
- [ ] Organizational pattern management with visual editors
- [ ] Remediation workflows with issue visualization and step-by-step guidance
- [ ] Documentation testing with results presentation

### Should-Have Features (Phase 2)

#### High-Value Visualizations (Priority)

| Visualization | Value | MVP Implementation | Future Enhancement |
|---------------|-------|-------------------|-------------------|
| Cluster Capability Map | High | Mermaid diagram (SVG) | Interactive D3/Cytoscape graph |
| Remediation Investigation Flow | High | Mermaid flowchart (SVG) | Interactive step-through |
| Solution Comparison Cards | Medium | Structured cards data | Same |
| Deployment Topology Preview | Medium | Mermaid diagram (SVG) | Interactive preview |

#### Enhanced Visualization
- [ ] Resource dependency graphs using network diagrams
- [ ] Cluster topology visualization showing nodes, pods, services
- [ ] Deployment timeline with historical data
- [ ] Comparison tables for solution alternatives

#### Collaboration Features
- [ ] Shareable conversation URLs
- [ ] Export conversation/deployment configs
- [ ] Team workspaces for shared patterns and solutions

#### Advanced UX
- [ ] Auto-complete suggestions in chat input
- [ ] Saved conversation templates and quick actions
- [ ] Dark/light mode theming
- [ ] Clickable elements in visualizations that insert text into chat (e.g., click card → "I want solution 1")

### Tool-Specific Web UI Enhancement Review (Phase 2)

After basic chat+MCP integration is functional, systematically review each tool for Web UI-specific enhancements:

| Tool | Review Status | Enhancement PRD |
|------|---------------|-----------------|
| [ ] Kubernetes Deployment Recommendations (`recommend`) | Not started | — |
| [ ] Cluster Query (`query`) | Not started | — |
| [ ] Capability Management (`manageOrgData` - capabilities) | Not started | — |
| [ ] Pattern Management (`manageOrgData` - patterns) | Not started | — |
| [ ] Policy Management (`manageOrgData` - policies) | Not started | — |
| [ ] Kubernetes Issue Remediation (`remediate`) | Not started | — |
| [ ] Kubernetes Operations (`operate`) | Not started | — |
| [ ] Project Setup & Governance (`projectSetup`) | Not started | — |

**For each tool, evaluate:**
- Visualization opportunities (graphs, diagrams, cards)
- Response format optimizations for Web UI rendering
- UI-specific features that wouldn't work in CLI
- Workflow improvements for visual interaction

**Reference**: [MCP Tools Overview](https://devopstoolkit.ai/docs/mcp/guides/mcp-tools-overview)

### Could-Have Features (Future)
- [ ] Mobile-responsive design for tablet access
- [ ] Integration with Git repositories for manifest storage
- [ ] Webhook notifications for deployment events
- [ ] Multi-cluster support with cluster switching

## Implementation Milestones

### Milestone 0: MCP Chat Endpoint (Blocking Dependency)
- [ ] MCP server implements `POST /api/v1/chat` endpoint
- [ ] Endpoint accepts `{ message, lastResponse? }` request format
- [ ] Endpoint returns `{ message, visualizations?, sessionId?, toolUsed?, prompt? }` response format
- [ ] AI classifies intent and routes to appropriate tool (or responds directly)
- [ ] Workflow state maintained server-side via `sessionId`

**Owner**: dot-ai repository
**Status**: In Progress
**Note**: Web UI cannot fully function until this endpoint is available.

### Milestone 1: API Client & Basic Framework
- [x] Set up React + TypeScript project with Vite
- [x] Configure OpenAPI code generation (available via `npm run generate:api`)
- [x] Create manual TypeScript types for MCP responses
- [x] Create basic routing structure
- [x] Implement API client wrapper with error handling
- [x] Basic Chat page with connection status indicator
- [ ] Make API URL configurable (environment variable)
- [ ] Update API client to use `/chat` endpoint (blocked on Milestone 0)

**Success Criteria**: Project builds, basic UI shell functional
**Status**: Partially Complete (blocked on MCP chat endpoint)

### Milestone 2: Core Visual Components
- [x] Define TypeScript interfaces for typed content blocks (Visualization types) - in `src/types/visualization.ts`
- [ ] Implement type-based renderer that dispatches to appropriate component
- [ ] Implement CardRenderer component (displays solution options, patterns)
- [ ] Implement CodeRenderer component with syntax highlighting (manifests, configs)
- [ ] Implement ImageRenderer component (displays SVG/PNG from MCP - trivially simple)
- [ ] Implement ProgressRenderer component (workflow progress, remediation steps)
- [ ] Implement TableRenderer component (tabular data)
- [ ] Implement DiffRenderer component (before/after comparisons)
- [x] Create base layout with chat input and visualization area
- [ ] Add "New Chat" button to clear conversation and start fresh

**Success Criteria**: UI renders typed content blocks from MCP responses; ImageRenderer simply displays server-generated diagrams (no graph library complexity)

### Milestone 3: Chat Integration & Workflows
- [ ] Integrate with MCP `/chat` endpoint
- [ ] Implement `lastResponse` state management (store, echo back on next message)
- [ ] Implement conversation display (user messages + assistant responses + visualizations)
- [ ] Handle multi-step workflows via `sessionId` continuations
- [ ] Test full `recommend` workflow (intent → solutions → questions → manifests → deploy)
- [ ] Test `remediate` workflow (issue analysis → remediation steps)
- [ ] Test `manageOrgData` workflows (patterns, policies, capabilities)
- [ ] Test `projectSetup` workflow
- [ ] Test general questions (no tool match → direct AI response)
- [ ] Error handling and user feedback systems

**Success Criteria**: All major MCP tools accessible via unified chat interface with complete multi-step workflows

### Milestone 4: Enhanced User Experience
- [ ] Responsive design for different screen sizes
- [ ] Message history persistence and session management
- [ ] Copy/export functionality for manifests and configurations
- [ ] Performance optimization for large data sets

**Success Criteria**: Professional-grade user experience comparable to modern web applications

### Milestone 5: Testing & Documentation
- [ ] Comprehensive test suite for frontend components
- [ ] Integration tests with MCP server
- [ ] Complete user documentation and setup guides
- [ ] Deployment documentation for production environments

**Success Criteria**: System ready for production use with complete documentation

### Milestone 6: Production Deployment
- [ ] Production deployment pipeline setup
- [ ] Security review and hardening
- [ ] Performance monitoring and analytics
- [ ] User feedback collection mechanisms

**Success Criteria**: Web UI publicly available and monitored in production

## Technical Considerations

### Security
- **Authentication**: Determine if web interface needs user authentication (MVP may skip for internal use)
- **Authorization**: Kubernetes RBAC enforced by MCP server, not Web UI
- **Network Security**:
  - HTTPS for production Web UI deployment
  - CORS properly configured for allowed origins
  - API rate limiting if Web UI is public-facing
- **Input Validation**:
  - Client-side validation for UX
  - Server-side validation already in place (MCP server validates all inputs)
- **Secrets Management**: Web UI should never expose Kubernetes credentials or API keys

### Performance
- **REST API Calls**: Standard HTTP requests with proper loading states and feedback
- **Large Data Handling**: Pagination or virtualization for large cluster capability lists
- **Caching**: Client-side caching of cluster data, solution templates, and OpenAPI schema
- **Bundle Size**: Code splitting, lazy loading, tree shaking for fast initial loads
- **TypeScript Compilation**: Generated API types increase build time but provide type safety

### Scalability
- **Concurrent Users**: Multiple simultaneous web sessions connecting to single MCP server
- **Session Management**: Persistent conversations across browser refreshes
- **Resource Usage**: Frontend memory usage with large conversation histories

### Integration Challenges
- **OpenAPI Schema Drift**: Web UI TypeScript types must stay synchronized with REST API changes
  - Mitigation: CI/CD regenerates types from OpenAPI schema on every build
  - TypeScript compilation will fail if incompatible changes detected
- **REST API Versioning**: Managing breaking changes in REST API responses
  - Mitigation: OpenAPI schema versioning, semantic versioning for both repositories
- **State Synchronization**: Keeping web UI state consistent with MCP server state during multi-step workflows
  - Mitigation: Session management via sessionId in tool responses
- **Error Handling**: Graceful handling of REST API errors, timeouts, and network issues
  - Mitigation: Proper error boundaries, retry logic, user-friendly error messages
- **CORS Configuration**: Ensuring CORS settings allow Web UI to call REST API
  - Note: Already configured in dot-ai REST API gateway

## Dependencies & Risks

### Technical Dependencies
- **MCP Server Chat Endpoint (BLOCKING)**: Web UI requires `POST /api/v1/chat` endpoint for all functionality
- **MCP Server REST API**: Web UI depends on existing REST API gateway in dot-ai
- **OpenAPI Schema Availability**: Requires `GET /api/v1/openapi` endpoint for type generation (optional, manual types work)
- **CORS Configuration**: MCP server must allow cross-origin requests from Web UI domain
- **Kubernetes Access**: MCP server must have cluster access (Web UI is presentation layer only)
- **Browser Support**: Modern browsers with ES6+, fetch API, and modern JavaScript features

### Project Risks
- **Complexity Risk**: Web UI development may be more complex than anticipated
- **Maintenance Risk**: Additional codebase to maintain alongside MCP server
- **User Adoption Risk**: Users may prefer existing CLI tools over web interface
- **Performance Risk**: Web interface may be slower than direct CLI interaction

### Mitigation Strategies
- **Start Simple**: Begin with basic chat interface, add visual components incrementally
- **Reuse Patterns**: Leverage existing web UI component libraries and patterns
- **Early Feedback**: Get user feedback after each milestone to guide development
- **Performance Testing**: Regular performance testing with realistic data loads

## Success Metrics

### Adoption Metrics
- Number of unique users per month
- Session duration and frequency of use
- Conversion from CLI to Web UI users

### Usage Metrics
- Most frequently used MCP tools through web interface
- Average time to complete deployment workflows
- User completion rates for multi-step processes

### Quality Metrics
- User satisfaction surveys and feedback
- Bug reports and resolution time
- Performance metrics (load time, responsiveness)

## Future Considerations

### Potential Expansions
- **Mobile App**: Native mobile applications for iOS/Android
- **Desktop App**: Electron-based desktop application
- **Enterprise Features**: SSO integration, audit logging, role-based permissions
- **AI Enhancements**: Visual AI recommendations, drag-and-drop deployment building

### Integration Opportunities
- **IDE Plugins**: Browser-based IDE integration
- **CI/CD Integration**: Trigger deployments from CI/CD pipelines through web interface
- **Monitoring Integration**: Connect to monitoring systems for deployment health visualization

---

## Change Log

- **2025-09-17**: Initial PRD creation (as dot-ai#109)
- **2025-01-15**: Major architectural revision
  - Changed from MCP protocol to REST API communication
  - Specified separate repository
  - Added OpenAPI schema-driven TypeScript type generation
  - Removed Adaptive Cards, MCP-UI, and transformation layer approaches
  - Added Technical Design Decisions section
  - Updated all milestones to reflect REST API approach
  - Added format standardization strategy
  - Clarified that MCP server requires minimal/no changes
- **2025-12-03**: Visualization architecture refinement
  - Added **visualization-only interaction model**: UI displays, user interacts via chat
  - Added **typed content blocks** specification with TypeScript interfaces
  - Added **AI-generated visualization data** concept (MCP generates graph relationships)
  - Added **fallback representations** for future multi-client support
  - Identified **high-value visualizations**: Cluster Capability Map, Remediation Investigation Flow
  - Updated user stories to reflect chat-based interaction
  - Updated milestones to include type-based renderer architecture
  - Explicitly rejected: MCP-UI approach (returns HTML), separate standard project (premature), complex form interactions
- **2025-12-17**: MVP simplification - server-generated images
  - Added **image type** to visualization types for server-generated diagrams
  - Changed MVP approach: MCP generates Mermaid diagrams → renders to SVG → UI displays
  - Added **Mermaid.js** to backend tech stack for diagram generation
  - Removed D3/Cytoscape from MVP frontend requirements (future enhancement only)
  - Updated ImageRenderer to be trivially simple (just display SVG/PNG)
  - Updated high-value visualizations table with MVP vs Future columns
  - Key insight: Server-generated images dramatically simplify UI while providing visual value
- **2025-12-30**: Migrated to dot-ai-ui repository
  - Moved from vfarcic/dot-ai#109 to vfarcic/dot-ai-ui#1
  - Removed Milestone 0 (repository already exists)
  - Updated repository references
- **2025-12-30**: Added Tool-Specific Web UI Enhancement Review phase
  - New Phase 2 section with trackable checklist of all 8 MCP tools
  - Each tool to be reviewed for visualization opportunities, response format optimizations, and UI-specific features
  - May generate additional PRDs for significant tool enhancements
- **2025-12-30**: Chat endpoint architecture and implementation progress
  - **Architecture Decision**: MCP acts as AI agent, Web UI acts as agent interface
  - **State Management**: Echo-back model - Web UI sends `lastResponse` + `message`, MCP reconstructs context
  - **Workflow State**: MCP maintains server-side via `sessionId`; MCP stateless for conversation, stateful for workflows
  - **New Milestone 0**: MCP chat endpoint is blocking dependency (owned by dot-ai repo)
  - **Technology Stack Finalized**: Vite (not Next.js), Tailwind CSS v4, manual TypeScript types
  - **Milestone 1 Progress**: Project structure, API client, types, basic UI complete; blocked on chat endpoint
  - **New Requirement**: "New Chat" button to clear conversation (like `/clear` in Claude Code)
  - **New Requirement**: API URL must be configurable (environment variable)
- **Status**: In Progress (blocked on MCP chat endpoint)

## Stakeholders

- **Product Owner**: [To be assigned]
- **Tech Lead**: [To be assigned]
- **Designer**: [To be assigned]
- **QA Lead**: [To be assigned]
