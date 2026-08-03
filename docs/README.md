# Weblate MCP Server Documentation

Welcome to the comprehensive documentation for the Weblate Model Context Protocol (MCP) Server. This documentation will help you understand, install, configure, and contribute to the project.

## 📚 Documentation Overview

### Getting Started
- **[Installation & Setup](./MCP_SETUP.md)** - Complete guide to installing and configuring the MCP server
- **[Quick Start](#quick-start)** - Get up and running in minutes

### Development & Contributing
- **[Development Guide](./DEVELOPMENT.md)** - Setting up the development environment
- **[API Reference](./API.md)** - Complete API documentation
- **[Architecture](./ARCHITECTURE.md)** - Understanding the codebase structure

### Release Management
- **[Release Process](./RELEASE.md)** - How releases are managed and published
- **[Changesets Guide](./CHANGESETS.md)** - Using changesets for version management

## 🚀 Quick Start

### NPX Installation (Recommended)
```bash
# Install and run directly with npx
npx @mmntm/weblate-mcp
```

### Global Installation
```bash
# Install globally
npm install -g @mmntm/weblate-mcp

# Run the server
weblate-mcp
```

### Configuration
Add to your Claude Desktop configuration:
```json
{
  "mcpServers": {
    "weblate": {
      "command": "npx",
      "args": ["-y", "@mmntm/weblate-mcp"],
      "env": {
        "WEBLATE_API_URL": "https://your-weblate-instance.com/api/",
        "WEBLATE_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `WEBLATE_API_URL` | Your Weblate instance API URL | ✅ |
| `WEBLATE_API_TOKEN` | Your Weblate API token | ✅ |
| `PORT` | Server port (default: 3000) | ❌ |
| `NODE_ENV` | Environment mode | ❌ |

## 📖 Available Tools

The MCP server provides comprehensive tools for interacting with Weblate:

### Project Management
- `listProjects` - List all available Weblate projects
- Comprehensive project information with URLs and metadata

### Component Management
- `listComponents` - List components in a specific project
- Component details with source language information

### Translation Management
- `searchUnitsWithFilters` ⭐ - **Efficient search using Weblate's native filtering syntax**
- `searchUnitsWithFailingChecks` - Read-only search for units with failing quality checks
- `searchStringInProject` - Search for translations containing specific text
- `getTranslationForKey` - Get translation value for a specific key
- `writeTranslation` - Update or write translation values with approval support
- `bulkWriteTranslations` ⚡ - **Batch update multiple translations efficiently**
- `findTranslationsForKey` - Find all translations for a specific key

### Translation Memory
- `lookupTranslationMemory` - Find read-only translation memory matches for source strings
- `listTranslationMemory` - List filtered read-only Translation Memory entries
- `getTranslationMemoryEntry` - Get one Translation Memory entry with provenance

### Translation Case Context (read-only)
- `getUnitDetails` - Get complete details for one translation unit
- `getUnitChecks` - Resolve failing quality-check IDs and read-only descriptions for one unit
- `getUnitComments` - Get comments attached to a translation unit
- `getUnitHistory` - Get history for a translation unit
- `getChangeDetails` - Get details for one translation change
- `getTranslationDetails` - Get translation metadata and statistics
- `getProjectDetails` - Get project metadata and configuration
- `getComponentDetails` - Get component metadata and glossary settings
- `getUnitScreenshots` - Get screenshots associated with a translation unit
- `listTranslationUnits` - List units for an exact project/component/language scope
- `getRepositoryStatus` - Get repository synchronization status

### Language Management
- `listLanguages` - List languages available in a specific project

### 📊 Translation Statistics Dashboard
- `getProjectStatistics` - Comprehensive project statistics with completion rates
- `getComponentStatistics` - Detailed statistics for specific components
- `getProjectDashboard` - Complete dashboard overview with all component statistics
- `getTranslationStatistics` - Statistics for specific translation combinations
- `getComponentLanguageProgress` - Translation progress for all languages in a component
- `getLanguageStatistics` - Statistics for a language across all projects
- `getUserStatistics` - User contribution statistics and activity metrics

### 📈 Change Tracking & History
- `listRecentChanges` - Recent changes across all projects with filtering
- `getProjectChanges` - Recent changes for a specific project
- `getComponentChanges` - Recent changes for a specific component
- `getChangesByUser` - Recent changes by a specific user

## 🏗️ Architecture

The server is built with:
- **NestJS** - Modern Node.js framework
- **TypeScript** - Type-safe development
- **MCP SDK** - Model Context Protocol implementation
- **Modular Services** - Clean separation of concerns

```
src/
├── services/weblate/     # Weblate API services
│   ├── base-weblate.service.ts
│   ├── projects.service.ts
│   ├── components.service.ts
│   ├── translations.service.ts
│   └── languages.service.ts
├── types/               # TypeScript definitions
├── tools/              # MCP tool implementations
└── main.ts            # Application entry point
```

## 🤝 Contributing

We welcome contributions! Please see our [Development Guide](./DEVELOPMENT.md) for details on:
- Setting up the development environment
- Code style and conventions
- Testing procedures
- Submitting pull requests

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🔗 Links

- [GitHub Repository](https://github.com/mmntm/weblate-mcp)
- [NPM Package](https://www.npmjs.com/package/@mmntm/weblate-mcp)
- [Weblate Documentation](https://docs.weblate.org/)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## 📞 Support

If you encounter any issues or have questions:
1. Check the [documentation](./MCP_SETUP.md)
2. Search [existing issues](https://github.com/mmntm/weblate-mcp/issues)
3. Create a [new issue](https://github.com/mmntm/weblate-mcp/issues/new)
