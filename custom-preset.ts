// src/app/theme/custom-preset.ts
import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

export const CustomPreset = definePreset(Aura, {
  semantic: {
    // Primary color remains default (emerald) - you can change this if needed
    primary: {
      50: '{emerald.50}',
      100: '{emerald.100}',
      200: '{emerald.200}',
      300: '{emerald.300}',
      400: '{emerald.400}',
      500: '{emerald.500}',
      600: '{emerald.600}',
      700: '{emerald.700}',
      800: '{emerald.800}',
      900: '{emerald.900}',
      950: '{emerald.950}'
    },
    
    // Custom color scheme for light/dark modes
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712'
        }
      },
      dark: {
        surface: {
          0: '#ffffff',
          50: '#1e1e1e',
          100: '#2a2a2a',
          200: '#363636',
          300: '#404040',
          400: '#525252',
          500: '#737373',
          600: '#a3a3a3',
          700: '#d4d4d4',
          800: '#e5e5e5',
          900: '#f5f5f5',
          950: '#fafafa'
        }
      }
    }
  },
  
  components: {
    // Accordion customization with reduced padding and professional colors
    accordion: {
      panel: {
        borderWidth: '1px',
        borderColor: '{surface.300}',
        borderRadius: '6px'
      },
      header: {
        color: '{text.color}',
        borderWidth: '1px',
        borderColor: '{surface.300}',
        background: '#b8b8b8', // Darker shade of #CDCDCD
        hoverBackground: '#a8a8a8',
        borderRadius: '6px',
        padding: '0.5rem 1rem', // Reduced padding
        fontWeight: '600'
      },
      content: {
        background: '#f7f7f7', // Your specified light mode color
        color: '{text.color}',
        borderWidth: '1px',
        borderColor: '{surface.300}',
        borderRadius: '6px',
        padding: '0.75rem' // Reduced padding
      },
      colorScheme: {
        dark: {
          header: {
            background: '#1a1a1a', // Darker shade for dark mode
            hoverBackground: '#0f0f0f',
            color: '{text.color}'
          },
          content: {
            background: '#2a2a2a', // Your specified dark mode color
            color: '{text.color}'
          }
        }
      }
    },
    
    // Toolbar customization using your specified blue color
    toolbar: {
      background: '#0171c5', // Your specified toolbar color
      borderColor: '#0171c5',
      color: '#ffffff',
      gap: '0.5rem',
      padding: '0.5rem 1rem' // Reduced padding
    },
    
    // DataTable customization for compact layout and professional colors
    datatable: {
      header: {
        cell: {
          borderColor: '#CDCDCD', // Your specified gridline color
          borderWidth: '1px',
          background: '#CDCDCD', // Professional header background
          color: '#333333', // Dark text for contrast
          padding: '0.375rem 0.5rem', // Compact padding
          fontSize: '0.875rem',
          fontWeight: '600'
        }
      },
      body: {
        cell: {
          borderColor: '#CDCDCD', // Your specified gridline color
          borderWidth: '1px',
          padding: '0.25rem 0.5rem', // Very compact padding
          fontSize: '0.875rem'
        }
      },
      filter: {
        cell: {
          background: '#CDCDCD', // Same as header
          borderColor: '#CDCDCD',
          padding: '0.2rem' // Minimal padding for filter row
        }
      },
      colorScheme: {
        dark: {
          header: {
            cell: {
              borderColor: '#404040', // Dark mode gridline color
              background: '#404040', // Dark mode header background
              color: '#e5e5e5' // Light text for dark mode
            }
          },
          body: {
            cell: {
              borderColor: '#404040' // Dark mode gridline color
            }
          },
          filter: {
            cell: {
              background: '#404040', // Dark mode filter background
              borderColor: '#404040'
            }
          }
        }
      }
    },
    
    // Button customizations with proper contrast
    button: {
      root: {
        fontSize: '0.875rem',
        fontWeight: '500'
      },
      outlined: {
        primary: {
          color: '#0171c5', // Professional blue for light mode
          borderColor: '#0171c5',
          hoverColor: '#ffffff',
          hoverBackground: '#0171c5'
        }
      },
      text: {
        primary: {
          color: '#0171c5', // Professional blue for light mode
          hoverColor: '#0171c5',
          hoverBackground: 'rgba(1, 113, 197, 0.1)'
        }
      },
      colorScheme: {
        dark: {
          outlined: {
            primary: {
              color: '#60a5fa', // Light blue for dark mode
              borderColor: '#60a5fa',
              hoverColor: '#000000',
              hoverBackground: '#60a5fa'
            }
          },
          text: {
            primary: {
              color: '#60a5fa', // Light blue for dark mode
              hoverColor: '#60a5fa',
              hoverBackground: 'rgba(96, 165, 250, 0.1)'
            }
          }
        }
      }
    },
    
    // Input customizations for proper sizing and compact layout
    inputtext: {
      paddingX: '0.375rem',
      paddingY: '0.25rem',
      fontSize: '0.8rem',
      borderRadius: '4px'
    },
    
    // Dropdown customizations for toolbar
    dropdown: {
      fontSize: '0.875rem',
      colorScheme: {
        dark: {
          background: 'rgba(255, 255, 255, 0.1)',
          borderColor: 'rgba(255, 255, 255, 0.3)',
          color: '#ffffff'
        }
      }
    },
    
    // MultiSelect customizations for toolbar  
    multiselect: {
      fontSize: '0.875rem',
      colorScheme: {
        dark: {
          background: 'rgba(255, 255, 255, 0.1)',
          borderColor: 'rgba(255, 255, 255, 0.3)',
          color: '#ffffff'
        }
      }
    }
  }
});