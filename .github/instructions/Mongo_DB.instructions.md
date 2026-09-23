---
description: define the MongoDB project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.
applyTo: **/*.ts, **/*.js, **/*.json 
---

<!-- Tip: Use /create-instructions in chat to generate content with agent assistance -->
You MUST always use the official MongoDB Node.js driver when interacting with MongoDB in this project. The driver provides a robust and efficient way to connect to and interact with MongoDB databases.

When writing code that interacts with MongoDB, follow these guidelines:
Create a template file for MongoDB connection and database operations. This template should include functions for connecting to the database, performing CRUD operations, and handling errors.