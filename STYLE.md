# UI/UX Style Guide: Chimera MES

This document defines the high-fidelity aesthetic structure for **Chimera MES** (Manufacturing Execution System).

## 1. Design Philosophy: "Futuristic Industrial Delight"
The platform balances the rigor of industrial manufacturing with the delight of a futuristic interface. It should feel "airy," "intelligent," and "effortless."

### Core Principles:
- **Azure White Base**: All backgrounds use a specialized Azure White (`#F0FBFF`) to reduce eye strain while maintaining a high-tech feel.
- **Electric Accents**: Use **Royal Blue** and **Teal Blue** gradients for all active states and primary interactions.
- **Glassmorphism**: Cards and panels utilize `backdrop-filter: blur(16px)` and subtle `rgba` transparency to create depth.

## 2. Color Palette & Visual Language

### Primary Palette
- **Azure White** (`#F0FBFF`): Main Application Background
- **Royal Blue** (`#4169E1`): Primary Actions / Start of Gradients
- **Teal Blue** (`#008080`): Success Indicators / End of Gradients
- **Deep Ocean** (`#001A4D`): Primary Text and Bold Headings

### Aesthetic Structure
- **Bento-Grid Layout**: Information is modularized into cards with a `24px` to `32px` border radius.
- **Neon Shadows**: Active elements emit a soft, colored glow (`box-shadow`) matching their gradient.
- **Interactive HUD Nodes**: Hexagonal nodes for the VSM timeline that scale and glow when active.

## 3. Typography: The "Outfit" Identity
- **Brand Headings**: Use **Outfit (800 weight)** with `-0.04em` letter-spacing.
- **Interface Text**: Use **Inter** for high-fidelity legibility in data grids and labels.

## 4. Branding Distribution
- **Main Titles**: Always use the full "Manufacturing Execution System".
- **Copyright/Footers**: Always use "Chimera MES // Industrial Core".
