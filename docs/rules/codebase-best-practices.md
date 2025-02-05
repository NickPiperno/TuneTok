# Codebase Best Practices for TuneTok MVP

This document outlines the best practices, folder structures, file naming conventions, and coding rules for the TuneTok MVP. Our goal is to create an AI-first codebase that is modular, scalable, and easy to understand. All files must be highly navigable and well-organized, with clear documentation and commentary using appropriate standards (e.g., JSDoc/TSDoc).

## Platform Support
This codebase is specifically designed for Android development. While some code may be platform-agnostic due to React Native's nature, we are not actively supporting or testing for iOS or web platforms.

---

## 1. Folder Structure & File Organization

A well-organized folder structure is key to maintainability and scalability. Below is an updated example file tree, reflecting the current structure in your codebase and our recommended organization:

```
TuneTok/
├── docs/
│   ├── project-info/
│   │   ├── tech-stack-options.md
│   │   └── [other project documents...]
│   ├── rules/
│   │   ├── tech-stack-rules.md
│   │   ├── ui-rules.md
│   │   └── theme-rules.md
│   └── codebase-best-practices.md    # (This document)
├── app/                      # Main source code directory
│   ├── assets/               # Images, fonts, and other static resources
│   ├── components/           # Reusable UI components
│   │   ├── common/           # Shared components (buttons, cards, etc.)
│   │   └── screens/          # Screen components for different views
│   ├── hooks/                # Custom React hooks
│   ├── constants/            # Constant values and configuration
│   ├── scripts/              # Utility and build scripts
│   ├── services/             # API calls, Firebase integrations, etc. (if applicable)
│   ├── styles/               # Global styles and theme definitions (if applicable)
│   ├── types/                # TypeScript type definitions (if applicable)
│   ├── App.tsx               # Main entry point for the app
│   └── google-services.json  # Firebase configuration (if applicable)
├── node_modules/             # Auto-generated dependencies (do not edit manually)
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md

```

### Key Considerations:

- **Separation of Concerns:** Group files by functionality. All UI components, hooks, services, and types are consolidated under the `app` folder, which promotes modularity and clarity.
- **Modularity:** Each subfolder (e.g., components, hooks, services) is designed to be self-contained, making it easier to add or modify features later.
- **Scalability:** This structure is built to accommodate future expansion. New features can be added by extending the appropriate folders.
- **Auto-generated Directories:** The `node_modules` folder is automatically created by your package manager and should not be manually edited.

---

## 2. File Naming Conventions

- **Component Files:** Use PascalCase for React components (e.g., `VideoPlayer.tsx`).
- **Utility and Service Files:** Use camelCase or kebab-case based on team preference (e.g., `apiService.ts` or `api-service.ts`).
- **Style Files:** Preferably use kebab-case for CSS/SCSS files (e.g., `global-styles.scss`).
- **Test Files:** Name test files similarly to their corresponding source files with an appended suffix (e.g., `VideoPlayer.test.tsx`).

### Additional Guidelines:

- **File Header Comments:** Each file should start with a brief explanation of its purpose, dependencies, and any other relevant context.
- **Function Documentation:** All functions, classes, and methods must include proper documentation using JSDoc/TSDoc, describing the purpose, parameters, return values, and any side effects.

---

## 3. Code Organization & Line Limitations

- **Modular Code:** Keep modules small and focused. If a file exceeds 250 lines, consider breaking it into smaller, more manageable modules.
- **Readable & Maintainable:** Follow established coding conventions (e.g., ESLint, Prettier, TypeScript best practices) to maintain consistency.
- **Comments & Documentation:** Use inline comments sparingly; focus on clear, descriptive function headers and file-level documentation to aid both human developers and AI tools (such as Cursor) in understanding the code.

---

## 4. Integration with Our Tech Stack & UI/Theme Rules

- **Tech Stack Alignment:** The codebase should mirror the modularity and separation of concerns outlined in our tech stack and tech-stack rules.
- **UI & Theme Consistency:** Ensure components adhere to our defined UI and theme rules (color palettes, typography, layout, etc.).
- **Documentation of Integrations:** Every integration with third-party services (e.g., Firebase Auth, Firestore, Cloud Functions) should be documented within their respective modules.

---

## 5. Additional Best Practices

- **Version Control:** Use Git effectively with meaningful commit messages and branch management strategies.
- **Automated Testing:** Write unit, integration, and end-to-end tests for critical parts of the codebase, keeping test files close to the source code.
- **CI/CD Pipelines:** Utilize CI/CD tools to automate testing and deployment, ensuring a consistently deployable codebase.
- **Regular Refactoring:** Periodically review and refactor code to maintain clarity and reduce technical debt.

---

## Additional Platform-Specific Guidelines

### Android-Specific Considerations
- Keep Android-specific configuration in appropriate locations (android/ folder, app.json)
- Test thoroughly on various Android API levels
- Consider Android-specific UI patterns and material design guidelines
- Optimize performance for Android devices
- Handle Android-specific permissions and features appropriately

### Cross-Platform Code
While we're targeting Android only:
- Avoid iOS-specific imports or code
- Remove unnecessary platform-specific checks (Platform.select, Platform.OS)
- Keep shared business logic platform-agnostic for future extensibility
- Document any Android-specific implementations or limitations

---

## Conclusion

Adhering to these best practices and guidelines will help ensure that the TuneTok codebase remains modular, scalable, and easy to understand. A clear, well-documented folder structure, combined with strict naming conventions and comprehensive documentation standards, will facilitate smooth development and integration across our AI-first application stack. 