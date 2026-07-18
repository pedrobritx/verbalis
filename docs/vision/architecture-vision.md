<!-- Converted from the original product document (Verbalis_Architecture.docx) on 2026-07-17.
     Part of the canonical context for the Translation IDE revamp: see docs/revamp/ROADMAP.md -->

# Verbalis Architecture
## Philosophy
Verbalis is not a CAT tool.
It is a Translation Development Environment (TDE): a platform where professional translators, reviewers, editors, project managers, terminologists, and localization engineers collaborate throughout the entire localization lifecycle.
Its architecture follows five principles:
AI-assisted, human-led
Offline-first
Modular by design
Cross-platform from a single engine
Enterprise-ready without sacrificing usability
# High-Level Architecture
┌─────────────────────────────┐                 │         Verbalis UI         │                 │ Windows │ macOS │ Linux     │                 └─────────────┬───────────────┘                               │                      Presentation Layer                               │        ┌──────────────────────┴──────────────────────┐        │                                             │ Command System                              Workspace Manager Docking Layout                              Session Manager Theme Engine                                Navigation Shortcuts                                   Accessibility                               │                        Application Core                               │┌────────────────────────────────────────────────────────────┐│                                                            ││ Translation Engine                                         ││ Version Control Engine                                     ││ AI Copilot Engine                                          ││ Search & Index Engine                                      ││ Terminology Engine                                         ││ Translation Memory Engine                                  ││ Collaboration Engine                                       ││ Quality Assurance Engine                                   ││ Automation Engine                                          ││ Plugin Runtime                                              ││                                                            │└────────────────────────────────────────────────────────────┘                               │                        Service Layer                               │      Local Services                    Cloud Services                               │──────────────────────────────────────────────────────────────                               │                        Storage Layer                               │ Workspace Database Translation Memories Project Files Cache Plugin Data User Settings AI Embeddings Version History
# Layers
## 1. Presentation Layer
Everything users interact with.
Responsibilities
Native experience on every OS
Dockable panels
Command palette
Keyboard-first navigation
Accessibility
Workspace layouts
Multiple windows
Dark/Light themes
Custom themes
Responsive UI
Examples
EditorPreviewTerminologyTranslation MemoryVersion HistoryCopilotQACommentsSearchOutlineProject ExplorerPublishing
## 2. Application Core
The brain.
No UI.
No platform code.
Contains every business rule.
Every desktop version shares this exact core.
# Core Modules
## Translation Engine
Responsible for
segment management
bilingual editing
document parsing
inline tags
placeholders
formatting preservation
document reconstruction
Supports
DOCX
XLSX
PPTX
HTML
XML
Markdown
CSV
XLIFF
SDLXLIFF
TMX
TBX
PO
JSON
YAML
RESX
IDML
INX
EPUB
SRT
VTT
PDF (where feasible)
## AI Copilot Engine
AI never edits automatically.
Everything is proposed.
Capabilities
rewrite
explain
summarize
terminology suggestions
consistency checking
translation alternatives
tone adaptation
style guide enforcement
context retrieval
ambiguity detection
terminology extraction
machine translation orchestration
Providers
Local LLMs
OpenAI
Anthropic
Google
Ollama
LM Studio
Azure OpenAI
Custom APIs
## Version Control Engine
Inspired by Git.
Every change becomes recoverable.
Features
Snapshots
Commits
Branches
Merge
Diff
History
Restore
Timeline
Comparison
Blame
Translator attribution
Revision history
## Translation Memory Engine
Supports
TMX
SDLTM
MemoQ
Star Transit
Custom databases
Capabilities
Fuzzy matching
Exact matching
Context matching
Penalty system
Priority ranking
Multiple memories
Read-only memories
Shared memories
## Terminology Engine
Supports
TBX
CSV
Excel
Custom dictionaries
Features
Forbidden terms
Preferred terms
Definitions
Examples
Images
Domains
Inflections
Automatic recognition
AI-assisted terminology suggestions
## Search Engine
Instant indexing.
Supports
Full-text search
Regex
Semantic search
Cross-project search
Context search
Similarity search
Saved searches
## QA Engine
Real-time validation.
Checks
Numbers
Tags
Variables
Whitespace
Capitalization
Punctuation
Consistency
Terminology
Formatting
Placeholders
Date formats
Units
Custom rules
## Collaboration Engine
Supports
Multiple reviewers
Live comments
Suggestions
Approvals
Assignments
Roles
Notifications
Conflict resolution
Track Changes
Activity feed
Audit logs
## Automation Engine
Workflow automation.
Examples
Import
Pretranslate
QA
Export
Publish
Notify
Convert
Rename
Backup
Scheduled jobs
Hooks
Triggers
## Publishing Engine
Final delivery.
Exports
DOCX
PDF
HTML
Markdown
EPUB
JSON
Localized software resources
Website bundles
Translation packages
## Plugin Runtime
Everything extensible.
Plugin types
Panels
Themes
Commands
AI providers
Importers
Exporters
QA rules
Terminology providers
Automation actions
File parsers
Visualizations
Templates
Marketplace integration
# Workspace Manager
Everything revolves around Workspaces.
Workspace ├── Projects ├── Memories ├── Termbases ├── Dictionaries ├── Corpora ├── AI Providers ├── Plugins ├── Settings ├── Layouts ├── Shortcuts └── Version History
# Storage
Projects are self-contained.
Project/project    manifest.json    source/    target/    memories/    terminology/    corpus/    versions/    comments/    exports/    assets/    settings.json
Everything is portable.
Everything is reproducible.
# Plugin Architecture
Plugins are sandboxed.
PluginManifestPermissionsCommandsPanelsAPIAssetsLocalizationLifecycleDependencies
Permissions are explicit.
For example
Read projectWrite translationAccess AIInternetFilesystemClipboard
# Connector Architecture
Official connectors.
Examples
MemoQ
Trados
Phrase
Crowdin
Lokalise
Git
GitHub
GitLab
Bitbucket
Google Drive
Dropbox
OneDrive
SharePoint
DeepL
OpenAI
Anthropic
Google Gemini
Microsoft Translator
LibreTranslate
LanguageTool
Custom REST APIs
# Security
Zero-trust philosophy.
Sandboxed plugins
Signed extensions
Encrypted secrets
Local-first storage
Optional cloud sync
Automatic backups
Crash recovery
Immutable version history
Granular permissions
Enterprise authentication (SSO/OAuth)
# Technology Stack
## Core
Rust (performance, safety, portability)
## Desktop
Tauri
Native platform APIs
## UI
React
TypeScript
Tailwind CSS
shadcn/ui
Custom design system
## Database
SQLite
PostgreSQL (team/server)
DuckDB (analytics)
## Search
Tantivy
SQLite FTS
Vector embeddings
## AI
Model Context Protocol (MCP)
LangGraph
Ollama
OpenAI-compatible APIs
## Collaboration
CRDT-based synchronization
WebSockets
Event sourcing
# Design Principles
Human-first, AI-second.
Everything is recoverable.
Every action is explainable.
Offline by default.
Extensible by design.
Native on every platform.
Fast enough for million-segment projects.
Beautiful enough to use all day.
Open enough to integrate with the localization ecosystem.
Stable enough to become the translator’s primary workspace.
