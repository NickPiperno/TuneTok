# UI Workflow Template
Strictly adhere to this workflow.
Items should be addressed one-by-one, in order.
Always reference `ui-rules.md`, `theme-rules.md`, and `codebase-best-practices.md`.

## Project State
Project Phase: [Phase Number/Name]
UI-Focused

## Task Management
- [ ] Identify current UI tasks from docs/living/checklists or relevant phase file
- [ ] Copy task details to "Primary Feature" section
- [ ] Break down into "Component Features" if needed

---

## Primary Feature
Name: [Feature Name]
Description: [Feature Description]

### Component Features
- [ ] [Component Feature Name]
  - [ ] [UI Task 1]
  - [ ] [UI Task 2]

---

## Progress Checklist

### Understanding Phase
- [ ] Documentation Review
    - [ ] UI guidelines from `ui-rules.md`
    - [ ] Theming guidelines from `theme-rules.md`
    - [ ] Relevant component strategies (shadcn/ui, Radix, Tailwind)
    - [ ] UX directives (glassmorphism, transitions, presence)
- [ ] Implementation Plan
  - [ ] Theming approach
  - [ ] Accessibility requirements
  - [ ] Animation/transition needs
- Notes: [ Notes ]

### Planning Phase
- [ ] Component Architecture
  - [ ] Define component tree/wireframes
        [ Component Tree or Wireframe goes here ]
  - [ ] List styling requirements
  - [ ] Define file structure (per `codebase-best-practices.md`)
  - [ ] PAUSE, Check in with user
- Notes: [ Notes ]

### Implementation Phase
- [ ] Setup
  - [ ] Verify layout in Next.js App Router
  - [ ] Check shared states (Zustand)
- Notes: [ Notes ]

- [ ] Development
  - [ ] Create/update component files
  - [ ] Implement styling and interactions
  - [ ] Add accessibility features
  - [ ] Integrate placeholder data and loading states
- Notes: [ Notes ]

### Verification Phase
- [ ] Quality Check
  - [ ] Design compliance
  - [ ] Animation/transition behavior
  - [ ] Theme compatibility
  - [ ] Accessibility
  - [ ] Code organization
  - [ ] Documentation
- Notes: [ Notes ]

### Completion
- [ ] User sign-off
- [ ] Update task tracking
- [ ] Document learnings

## Notes
Key decisions and learnings:
1. [ ]
2. [ ]