# Theme Rules for TuneTok MVP

This document defines our visual design guidelines and theming principles for the TuneTok MVP. It outlines color palettes, typography, layout styles, and other visual cues required to create a minimalist and sleek UI that focuses on content. These rules also consider integration with our tech stack and backend services to ensure a cohesive user experience.

---

## 1. General Design Approach

- **Minimalist & Sleek:**
  - Clean, uncluttered interfaces that focus on the primary content—music videos and imagery.
- **Subtle Color Palette:**
  - Use muted tones with support for both light and dark modes. Avoid neon or harsh gradients.
- **Typography-First:**
  - Emphasize elegant, legible sans-serif fonts (e.g., Inter, SF Pro, Montserrat) to maintain a premium look.
- **Flat Design:**
  - Avoid excessive effects; use intuitive layouts with natural shadows and layering for depth.

---

## 2. Color Palette

### Primary Colors (Muted & Modern)

- **Dark Mode Background:**
  - Soft Black (#121212) to provide a deep, immersive experience.
- **Light Mode Background:**
  - Off-White (#F5F5F5) for a clean, bright interface.
- **Primary Accent:**
  - Muted Blue or Slate Gray can be used for subtle highlights and borders.
- **Secondary Accents:**
  - Deep Burgundy or Olive Green for interactive elements such as buttons, icons, and active states.

### Accent Colors (Minimal Use)

- **Highlight Colors:**
  - Muted Copper (#B67B5D) or Warm Sand (#D6B99D) for small, eye-catching elements.
- **Secondary Elements:**
  - Dark Blue-Gray (#37474F) for non-intrusive accents helping to demarcate UI sections.

---

## 3. Typography & Text Styling

- **Primary Font:**
  - Use modern, sans-serif fonts (e.g., Inter, SF Pro, Montserrat).
- **Hierarchy:**
  - Headings should be bold and larger for prominence.
  - Body text should have subtle weight differences to maintain hierarchy (e.g., song titles larger than artist names).
- **Legibility:**
  - Ensure adequate contrast between text and background across both light and dark modes.

---

## 4. Layout and Component Styles

### Navigation

- **Bottom Navigation Bar:**
  - Simple, recognizable icons (Home, Search, Library, Profile). Ensure icons are intuitive and easy to tap.
- **Swipe-Based Interaction:**
  - Implement swipe gestures for browsing content in a TikTok-like style.
- **Floating Action Button (FAB):**
  - Use for key actions, such as accessing playlists, ensuring it stands out without overwhelming other elements.

### Video Feed & Content Display

- **Full-Screen Video Player:**
  - Employ a minimal overlay design. Use auto-hide controls to ensure an immersive viewing experience.
- **Engagement Icons:**
  - Place interactive icons (like, comment, share) in consistent locations (e.g., bottom-right corner) that are accessible yet unobtrusive.

### Search & Filtering

- **Search Bar:**
  - Rounded, clean design with intuitive placement. Avoid excessive dropdowns or clutter.
- **Filter Buttons:**
  - Use pill-shaped designs for selecting genres or moods, emphasizing ease of selection through clear visual feedback.

### Profile & Playlists

- **Profile Cards:**
  - Minimalist, card-based layouts with soft shadows to add depth without distraction.
- **Toggle Views:**
  - Allow switching between grid and list views for saved songs and artist profiles.

---

## 5. Dark & Light Mode Guidelines

- **Contrast and Readability:**
  - In dark mode, use soft contrasts to maintain readability (e.g., light text on dark backgrounds).
  - In light mode, ensure text is clear against off-white backgrounds.
- **Consistent Theming:**
  - Both modes should harmonize with the overall muted color palette, ensuring no harsh contrasts.
- **Dynamic Switching:**
  - Allow smooth transitions between dark and light modes without jarring effects.

---

## 6. Integration with the Tech Stack

- **Responsive Design:**
  - Ensure that UI components dynamically adjust based on screen size and orientation using React Native's styling capabilities.
- **Performance Considerations:**
  - Use style pre-processing and caching where possible (e.g., StyleSheet in React Native) to maintain fluid interactions.
- **Real-Time Data:**
  - Design components to gracefully handle real-time updates from backend services such as Firestore.
- **Error States:**
  - Provide clear, minimalist visual cues for error handling (e.g., subtle color changes, icons) aligned with the theme.

---

## 7. Key UI Design Principles

- **Clarity over Complexity:** Avoid overwhelming the user with too much information on any screen.
- **Depth with Shadows, Not Neon:** Use subtle drop shadows and layering to create a sense of depth without resorting to bright or flashy effects.
- **Content is King:** Let the media (music videos, album covers) be the focal point of the interface.
- **Consistency:** Maintain consistent spacing, iconography, and typography throughout the app.
- **Adaptability:** Ensure that the design is flexible enough to evolve as additional features are integrated.

---

## Conclusion

The theme rules provide a structured framework to achieve a minimalist yet engaging user interface that aligns with our design preferences and technical requirements. Adherence to these rules will help create a cohesive experience that enhances content visibility, ensures usability, and ties seamlessly into our chosen tech stack. 