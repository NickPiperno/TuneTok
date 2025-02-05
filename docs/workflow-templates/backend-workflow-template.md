# Backend Workflow Template

## Project State
Project Phase: [Phase Number/Name]
Backend-Focused

## Task Management
- [ ] Identify current backend tasks from docs/living/checklists or relevant phase file
- [ ] Copy task details to "Primary Feature" section
- [ ] Break down into "Component Features" if needed

---

## Primary Feature
Name: [Feature Name]
Description: [Feature Description]

### Component Features
- [ ] [Component Feature Name]
  - [ ] [Backend Task 1]
  - [ ] [Backend Task 2]

---

## Progress Checklist

### Understanding Phase
- [ ] Documentation Review
    - [ ] Tech stack guidelines (`tech-stack.md`, `tech-stack-rules.md`)
    - [ ] Existing services and utils (`services.ts`, `database.ts`, `feature/*/utils`)
    - [ ] Data models (`lib/types`)
    - [ ] Integration points (endpoints, auth boundaries)
    - [ ] Real-time features (presence, typing, notifications)
- Notes: [ Notes ]

### Planning Phase
- [ ] Architecture
    - [ ] Data flow and relationships
    - [ ] API/route handler structure
    - [ ] Type definitions and Zod schemas
    - [ ] Real-time requirements
    - [ ] Test specifications (per `test-rules.md`)
    - [ ] PAUSE, Check in with user
- Notes: [ Notes ]

### Implementation Phase
- [ ] Setup
    - [ ] Verify data types and shapes
    - [ ] Confirm UI integration points
    - [ ] Review file structure requirements
- Notes: [ Notes ]

- [ ] Development
    - [ ] Create route handlers/server actions
    - [ ] Implement database integration
    - [ ] Add business logic
    - [ ] Implement data validation
    - [ ] Add real-time features if needed
    - [ ] Write and maintain tests
- Notes: [ Notes ]

- [ ] Integration
    - [ ] Connect with UI components
    - [ ] Document API endpoints
    - [ ] Configure state management
- Notes: [ Notes ]

### Verification Phase
- [ ] Quality Check
    - [ ] Feature completeness
    - [ ] Error handling
    - [ ] Performance and security
    - [ ] Code organization
    - [ ] Type safety
    - [ ] Test coverage
    - [ ] Documentation
- Notes: [ Notes ]

### Completion
- [ ] User sign-off
- [ ] Update task tracking

## Notes
Key decisions and learnings:
1. [ ]
2. [ ]