# GitHub Workflow

## Pre-Commit Checklist
- [ ] Check current branch
    ```bash
    git status
    ```
    - [ ] If not on 'main', get user permission
    - [ ] If on 'main', proceed

- [ ] Determine branch name
    - [ ] Check task type:
        - bug fix → fix/
        - new feature → feat/
        - documentation → docs/
        - refactor → refactor/
        - performance → perf/
    - [ ] Format name:
        - Convert spaces to dashes
        - Use lowercase
        - Remove special characters

- [ ] Create branch
    ```bash
    git checkout -b <branch-type>/<task-name>
    ```

## Commit Checklist
- [ ] Create commit message file
    ```bash
    touch commit-message.md
    ```

- [ ] Write commit message
    - [ ] Add task description
    - [ ] List changes made
    - [ ] Follow commit conventions

- [ ] Commit changes
    ```bash
    git add .
    git commit -F commit-message.md
    ```

- [ ] Clean up
    ```bash
    rm commit-message.md
    ```

## Push & PR Checklist
- [ ] Push to remote
    ```bash
    git push -u origin <branch-name>
    ```
    - [ ] If push fails, verify remote config

- [ ] Create PR
    - [ ] Create description file
        ```bash
        touch pr-description.md
        ```
    - [ ] Write PR description
        - [ ] List completed tasks
        - [ ] Detail changes
        - [ ] Add impact statement
    - [ ] Submit PR
        ```bash
        gh pr create --title "<type>: <description>" --body-file pr-description.md --base main
        ```
    - [ ] Clean up
        ```bash
        rm pr-description.md
        ```

- [ ] Finalize
    ```bash
    git checkout main
    ```
