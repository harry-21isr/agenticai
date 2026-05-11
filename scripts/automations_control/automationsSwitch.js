/**
 * Automations Switch Configuration
 * 
 * This file controls which HTML processing automations are enabled.
 * Set any automation to true to enable it, false to disable it.
 */

const AUTOMATIONS = {
  // AUTOMATION_FIX_1: Process percentage values with zero-width joiners
  AUTOMATION_FIX_1: true,
  
  // AUTOMATION_FIX_2: Add zero-width joiners to long numbers
  AUTOMATION_FIX_2: true,
  
  // AUTOMATION_FIX_3: Replace regular hyphens with non-breaking hyphens
  AUTOMATION_FIX_3: true,
  
  // AUTOMATION_FIX_4: Escape ampersands in text content
  AUTOMATION_FIX_4: true,
  
  // AUTOMATION_FIX_5: Escape angle brackets in text content
  AUTOMATION_FIX_5: true,
  
  // AUTOMATION_FIX_6: Convert special characters to HTML entities
  AUTOMATION_FIX_6: true,
  
  // AUTOMATION_FIX_7: Process preheader content
  AUTOMATION_FIX_7: true,

  // AUTOMATION_FIX_8: Ensure all <img> tags have an alt attribute
  AUTOMATION_FIX_8: true,

  // AUTOMATION_FIX_9: Ensure all <td> elements wrapping an <a><img></a> structure have required font styles
  AUTOMATION_FIX_9: true,

  // AUTOMATION_FIX_10: Sync anchor title with image alt attribute
  AUTOMATION_FIX_10: true,
};

export { AUTOMATIONS }; 