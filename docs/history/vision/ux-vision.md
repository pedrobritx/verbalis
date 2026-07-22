<!-- Converted from the original product document (Verbalis_UX_Vision.docx) on 2026-07-17.
     Part of the canonical context for the Translation IDE revamp: see docs/revamp/ROADMAP.md -->

# Verbalis UX Vision

Designing the Translation IDE professionals have always deserved.

# Vision

Verbalis is not another Computer-Assisted Translation (CAT) tool.
It is a Translation Integrated Development Environment (Translation IDE) designed around how translators actually think, research, collaborate, and publish.
Instead of centering the experience around documents and segmented tables, Verbalis is built around knowledge.
Every document becomes part of a larger ecosystem consisting of translation memories, terminology, references, style guides, AI assistance, collaboration, version history, and publishing workflows.
The objective is simple:
Reduce cognitive load while increasing translator control.
AI is not the translator.
AI is the translator’s copilot.

# Design Principles

## Knowledge over Documents

Traditional CAT tools organize work around files.
Verbalis organizes work around knowledge.
A document is only one node inside a much larger workspace.
Every translation benefits from everything the project knows.

## Progressive Disclosure

The application should feel approachable to beginners while remaining extremely powerful for professionals.
A new user should be translating within minutes.
An expert should be able to customize nearly every aspect of the interface and workflow.
Complexity is revealed only when it becomes useful.

## Context is Everything

Every action should provide contextual information automatically.
Users should rarely have to search manually for:
terminology
previous translations
references
corpus examples
reviewer notes
style guide instructions
The system should surface these proactively.

## AI as Copilot

Artificial Intelligence supports decision making.
It never replaces professional translators.
It assists by:
suggesting translations
detecting inconsistencies
summarizing references
explaining terminology
finding similar segments
automating repetitive work
The translator remains fully in control.

## Native Everywhere

Verbalis shares one application engine across every platform while respecting platform conventions.
The experience should feel natural on:
Windows
macOS
Linux
Shared architecture.
Native experience.

# User Journey

Instead of a linear pipeline:
Import
↓
Translate
↓
Review
↓
Export
Verbalis follows a continuous knowledge cycle:
Discover
↓
Understand
↓
Translate
↓
Validate
↓
Collaborate
↓
Publish
↓
Learn
↓
Improve
Every completed project improves future projects.

# Home Workspace

Opening Verbalis should not feel like opening a file.
It should feel like entering a workspace.
The home dashboard provides:

## Continue Working

Recent projects.
Pinned workspaces.
Current progress.

## Daily Overview

pending translations
reviewer feedback
terminology warnings
AI suggestions
recent activity

## Universal Search

Search everything.
Projects.
Sentences.
Terms.
Translation memories.
Corpora.
Comments.
Commits.
References.

# Workspaces

Projects are grouped into reusable workspaces.
Examples:
Apple
Netflix
European Commission
Nintendo
Each workspace stores:
translation memories
terminology
dictionaries
corpora
AI preferences
prompt templates
QA profiles
style guides
plugins
automation rules
collaborators
Switching projects should automatically load the entire working environment.

# Project Creation

Instead of asking users which file to import, Verbalis first asks what they are creating.
Examples:
Website
Mobile Application
Software
Subtitle
Game
Patent
Legal Contract
Marketing Campaign
Book
Technical Manual
This decision automatically configures:
segmentation
QA rules
export formats
preview engines
terminology extraction
AI behavior
recommended plugins

# Workspace Architecture

Each project contains multiple interconnected resources.
Project
├── Documents
├── Reference Material
├── Screenshots
├── PDFs
├── Style Guide
├── Terminology
├── Translation Memory
├── AI Conversations
├── QA Reports
├── Comments
└── Published Deliverables
Projects become complete translation ecosystems.

# Translation View

The editor is designed for focus.
Instead of spreadsheet rows, translators work inside a clean writing environment.
Each segment displays:
source text
translation
inline AI suggestions
quality indicators
Suggestions appear naturally and never interrupt typing.

# Context Panel

The right sidebar dynamically changes according to the selected content.
For each segment it may display:
terminology
translation memory matches
corpus examples
dictionaries
client preferences
reviewer notes
previous decisions
AI explanations
legal or technical context
Everything relevant appears automatically.

# AI Experience

AI should rarely require opening a chat window.
Instead, assistance appears exactly when useful.
Examples:
“This sentence already exists.”
“Reuse approved translation?”
“The preferred terminology changed.”
“Apply throughout project?”
“Tone differs from the style guide.”
“Review?”
Interaction is immediate.
No prompting required.

# Version Control

Every translation project behaves like software.
Each sentence has its own history.
Every modification records:
author
timestamp
revision
reviewer
AI participation
Features include:
history
diff comparison
rollback
branching
merging
blame
restore previous versions
Entire projects may also have branches.
Examples:
Brazilian Portuguese
European Portuguese
Marketing
Technical
Legal
Changes can later be merged.

# Review Experience

Review mode presents work similarly to code review systems.
Each change displays:
Original
↓
Translator
↓
Reviewer
↓
Discussion
↓
Approval
Reviewers can:
comment
approve
reject
suggest edits
resolve conversations

# Focus Modes

Different tasks require different interfaces.

## Translation

Minimal distractions.
Writing first.

## Review

Differences dominate.
Comments remain visible.

## Research

Reference-heavy.
Corpora.
Dictionaries.
Web.
PDFs.
AI.
Parallel texts.

## QA

Displays only validation issues.

## Publishing

Validation.
Preview.
Packaging.
Export.

# Knowledge Graph

Instead of navigating folders, users can explore relationships visually.
Connections may include:
Client
↓
Style Guide
↓
Document
↓
Sentence
↓
Terminology
↓
Translation Memory
↓
Reference Material
↓
Published Version
This encourages discovery rather than searching.

# Universal Search

One search engine indexes everything.
Searchable resources include:
documents
terminology
corpora
comments
commits
AI memories
screenshots
PDFs
dictionaries
translation memories
Search behaves more like Spotlight than a traditional file browser.

# Resource Center

All reusable linguistic assets are managed centrally.
Resources include:
Translation Memories
Term Bases
Dictionaries
Corpora
Style Guides
Prompt Templates
QA Profiles
Regular Expressions
Macros
Scripts
Automation Rules
Resources can be shared across projects.

# Automation Builder

Users can automate repetitive workflows through a visual pipeline.
Examples:
Document Imported
↓
Extract Terminology
↓
Run AI Analysis
↓
Notify Reviewer
↓
Generate QA Report
↓
Publish Draft
Automation requires no programming knowledge.

# Plugin Marketplace

Verbalis is designed to be extended.
Plugins may provide:
AI providers
Machine Translation engines
Dictionaries
QA tools
File formats
OCR
Accessibility tools
Preview renderers
Automation nodes
External integrations
A public marketplace encourages community innovation.

# Collaboration

Teams collaborate in real time.
Features include:
live presence
comments
mentions
review requests
approvals
shared resources
project permissions
Verbalis supports the complete localization workflow:
Translate
↓
Revise
↓
Edit
↓
Approve
↓
Publish

# Publishing Pipeline

Publishing follows a structured workflow.
Validate
↓
Quality Assurance
↓
Accessibility Checks
↓
Preview
↓
Package
↓
Export
↓
Publish
Every deliverable remains reproducible and traceable.

# Cross-Platform Philosophy

Verbalis uses a shared engine while embracing native conventions.

### Windows

Explorer integration
multi-window workflows
PowerToys compatibility

### macOS

native menus
Spotlight
Quick Look
iCloud integration
Apple Intelligence
SF Symbols

### Linux

GNOME
KDE
Wayland
X11
native package management
Users should feel at home regardless of platform.

# Long-Term Vision

Verbalis is not intended to become another CAT tool.
It aims to become the operating environment for professional translation.
An application where translators think, collaborate, research, translate, revise, publish, and continuously improve.
Just as Visual Studio Code transformed software development by becoming an extensible development platform rather than a text editor, Verbalis seeks to redefine translation software by becoming an extensible knowledge platform for language professionals.
The ultimate goal is not merely to make translation faster.
It is to make translators more informed, more consistent, more collaborative, and more confident in every decision they make.
