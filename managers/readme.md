# Enhanced Search Strategy Implementation

## Overview

This implementation provides a comprehensive search strategy system that intelligently detects and handles different types of search queries:

1. **Transaction ID** - UUIDs, GUIDs, long alphanumeric strings
2. **JIRA ID** - Format like PROJ-123, TICKET-456
3. **Batch ID** - 5-8 digit alphanumeric identifiers
4. **Natural Language** - AI-powered search (placeholder for future integration)

## New Files Created

### Core Services

#### 1. `search-query-detection.service.ts`
- **Purpose**: Analyzes search queries and determines their type with confidence scoring
- **Location**: `src/app/features/search-logs/services/`
- **Key Features**:
  - Pattern matching for different query types
  - Confidence scoring (0-1)
  - Metadata extraction
  - Validation methods

#### 2. Enhanced Search Strategies (`search-strategies.ts`)
- **Purpose**: Individual strategy implementations for each search type
- **Location**: `src/app/features/search-logs/services/`
- **Strategies**:
  - `TransactionSearchStrategy`
  - `JiraSearchStrategy`
  - `BatchSearchStrategy`
  - `NaturalLanguageSearchStrategy`
  - `SseStrategy` (streaming)
  - `GuidSearchStrategy` (legacy support)

### Components

#### 3. Enhanced Search Bar (`search-bar.component.ts/.html/.scss`)
- **Purpose**: Intelligent search input with real-time detection
- **Location**: `src/app/features/search-logs/components/search-bar/`
- **Features**:
  - Real-time query type detection
  - Confidence indicators
  - Search examples overlay
  - Favorites integration
  - Context-aware placeholders

#### 4. Toolbar Components
- **BatchToolbarComponent**: Controls for batch processing views
- **JiraToolbarComponent**: JIRA-specific actions and view selection
- **Location**: `src/app/features/search-logs/components/`

#### 5. Viewer Components
- **BatchViewerComponent**: Displays batch processing status and metrics
- **JiraViewerComponent**: Shows JIRA ticket details and associated transactions
- **Location**: `src/app/features/search-logs/components/`

### Models

#### 6. Updated Models (`search.model.ts`, `batch-view.model.ts`)
- **Enhanced SearchType**: Added 'jira', 'batch', 'natural' types
- **New Response Interfaces**: Type-specific response structures
- **Search Metadata**: Detection results and execution context

## Modified Files

### 1. `search-orchestrator.service.ts` - **COMPLETE REWRITE**
**Key Changes**:
- Reorganized into logical sections with clear separation of concerns
- Added strategy registry pattern for extensibility
- Implemented intelligent query detection and routing
- Enhanced error handling and state management
- Better TypeScript patterns with signals and computed properties

**New Methods**:
- `performIntelligentSearch()` - Uses query detection
- `getStrategyForSearch()` - Dynamic strategy selection
- `enhanceRequestFromDetection()` - Enriches requests with detection data
- `testQueryDetection()` - Development helper

### 2. `search-result.component.ts/.html/.scss`
**Key Changes**:
- Support for multiple search types with conditional toolbars/viewers
- Enhanced header with search type indicators and confidence badges
- Progress indicators for batch processing
- Improved responsive design and accessibility

### 3. `search-logs.component.ts/.html/.scss`
**Key Changes**:
- Enhanced empty states with interactive examples
- Better mode handling and page descriptions
- Search statistics display
- Improved responsive design

## Integration Points

### API Endpoints Expected
The implementation expects these API endpoints (configurable via ConfigService):

```typescript
{
  transactionSearch: '/api/search/transaction',
  jiraSearch: '/api/search/jira',
  batchSearch: '/api/search/batch',
  browseSSE: '/api/stream/browse',
  errorSSE: '/api/stream/error'
}
```

### Query Parameters
Each strategy sends appropriate query parameters:
- `applications`, `environment`, `location`
- `startDate`, `endDate` (from date range)
- `preFilter` (for error streams)
- `streamFilters` (serialized)
- Type-specific identifiers (transactionId, jiraId, batchId)

## Configuration

### 1. Add to ConfigService
```typescript
api: {
  transactionSearch: '/api/search/transaction',
  jiraSearch: '/api/search/jira', 
  batchSearch: '/api/search/batch'
}
```

### 2. Update Route Configuration
```typescript
{
  path: 'search',
  component: SearchLogsComponent,
  data: { 
    mode: 'search',
    allowedFilters: ['application', 'environment', 'location', 'dateRange']
  }
}
```

## Usage Examples

### 1. Transaction Search
```typescript
// User enters: "550e8400-e29b-41d4-a716-446655440000"
// Detection: { type: 'transaction', confidence: 0.95 }
// Strategy: TransactionSearchStrategy
// Result: Transaction details with related spans
```

### 2. JIRA Search
```typescript
// User enters: "PROJ-123"
// Detection: { type: 'jira', confidence: 0.95 }
// Strategy: JiraSearchStrategy  
// Result: JIRA ticket details with associated transactions
```

### 3. Batch Search
```typescript
// User enters: "ABC123"
// Detection: { type: 'batch', confidence: 0.8 }
// Strategy: BatchSearchStrategy
// Result: Batch processing status and logs
```

### 4. Natural Language (Future)
```typescript
// User enters: "show me errors from the last hour"
// Detection: { type: 'natural', confidence: 0.8 }
// Strategy: NaturalLanguageSearchStrategy
// Result: AI-interpreted search results
```

## Testing

### Query Detection Testing
```typescript
// In browser console or component:
this.searchOrchestrator.testQueryDetection('PROJ-123');
// Returns: { type: 'jira', confidence: 0.95, ... }
```

### Strategy Testing
```typescript
// Check available strategies:
this.searchOrchestrator.getAvailableStrategies();
// Returns: ['transaction', 'jira', 'batch', 'natural', 'browse', 'error']
```

## Future Enhancements

### 1. AI Integration
- Replace `NaturalLanguageSearchStrategy` placeholder
- Integrate with OpenAI, Claude, or similar services
- Add query interpretation and suggestion features

### 2. Enhanced Batch Features
- Real-time batch monitoring with WebSocket connections
- Batch comparison and analytics
- Batch operation controls (pause, resume, cancel)

### 3. JIRA Integration
- Direct JIRA API integration for real-time data
- Ticket creation and updates from search results
- Enhanced ticket relationship mapping

### 4. Performance Optimizations
- Query result caching
- Intelligent prefetching
- Search result persistence

## Error Handling

The implementation includes comprehensive error handling:
- Low confidence detection warnings
- Strategy execution failures
- Network and API errors
- Graceful degradation for unsupported query types

## Accessibility

The implementation follows accessibility best practices:
- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Reduced motion preferences

## Migration Notes

If migrating from the previous implementation:
1. The `SearchOrchestratorService` has been completely rewritten - update any direct dependencies
2. New search types require corresponding backend API endpoints
3. Column definitions may need updates for new search types
4. Consider updating mock data structure for testing

This implementation provides a solid foundation for intelligent search capabilities while maintaining backward compatibility and extensibility for future enhancements.