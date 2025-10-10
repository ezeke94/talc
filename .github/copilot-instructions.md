# GitHub Copilot Instructions

## Overview
This document provides guidelines for using GitHub Copilot effectively within the `talc` project. It aims to assist AI coding agents in understanding the project structure, workflows, and conventions.

## Project Structure
- **src/**: Contains the main application code.
- **public/**: Static assets like images and icons.
- **functions/**: Serverless functions for handling backend logic.
- **docs/**: Documentation files for project guidance.
- **.github/**: GitHub-specific configurations and workflows.

## Workflows
1. **Development**: Use the `src` folder for all new features and bug fixes.
2. **Testing**: Ensure all new code is covered by tests located in the `test` folders.
3. **Deployment**: Follow the deployment scripts in the `deploy-notifications` files.

## Coding Conventions
- Follow the existing code style in the project.
- Use meaningful variable and function names.
- Write comments for complex logic.

## Integration Points
- **Firebase**: Ensure proper integration with Firebase for authentication and data storage.
- **Netlify**: Use Netlify for deployment and hosting of the application.

## Examples
- **Creating a New Component**: When creating a new component, ensure it is placed in the appropriate folder within `src/components/` and follows the naming conventions.
- **Using Functions**: When calling serverless functions, ensure to handle responses and errors appropriately.

## Additional Functionality
- Ensure that all functionalities not explicitly listed in this document are also covered in the instructions for AI agents. This includes any project-specific workflows, integrations, or coding standards that may arise during development.

## Conclusion
This document should be updated regularly to reflect any changes in project structure, workflows, or conventions. AI agents are encouraged to refer to this document for guidance on best practices and project-specific instructions.