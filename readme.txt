:host {
  display: block;
  margin-bottom: 1rem; // Space between accordions
}

// Override PrimeNG accordion styles for a compact look
:host ::ng-deep .result-accordion.p-accordion {
  .p-accordion-header-link {
    padding: 0.5rem 1rem !important; // Reduced header padding
    min-height: auto;
  }
  
  // ✨ PADDING FIX: Remove padding from the accordion's content area ✨
  .p-accordion-content {
    padding: 0; 
  }
}

// Custom styles for our dynamic header content
.accordion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.header-left, .header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.streaming-indicator {
  display: flex;
  align-items: center;
}

// ✨ HEIGHT & PADDING FIX: This wrapper controls the layout ✨
.result-content-wrapper {
  // We make it a flex container so its children can use flex-grow
  display: flex;
  flex-direction: column;
  // It should have a defined height for the table's `scrollHeight="flex"` to work against.
  // Using vh (viewport height) is a good way to make it responsive.
  height: 75vh;
  max-height: 800px; // A sensible max height
}