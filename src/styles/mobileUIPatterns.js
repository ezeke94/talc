/* 
 * Mobile UI Improvements - Quick Reference
 * 
 * This file documents the key CSS/MUI styling improvements made to the Mentors page
 * for better mobile experience. Use these patterns for other pages.
 */

// ===== CARD STYLING =====
const mobileCardStyle = {
  mb: 2, 
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)', 
  borderRadius: 3, 
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  '&:hover': {
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    transform: 'translateY(-2px)'
  },
  '&:active': {
    transform: 'translateY(0)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  }
};

// ===== AVATAR STYLING =====
const mobileAvatarStyle = {
  width: 56, 
  height: 56, 
  bgcolor: 'primary.main',
  color: 'primary.contrastText',
  fontWeight: 700,
  fontSize: '1.5rem',
  boxShadow: '0 2px 8px rgba(123,198,120,0.3)'
};

// ===== CHIP STYLING (Form Status) =====
const formChipStyle = (isSubmitted, isDesktop) => ({
  bgcolor: isSubmitted ? 'success.main' : 'background.paper',
  color: isSubmitted ? 'success.contrastText' : 'text.primary',
  borderColor: isSubmitted ? 'success.main' : 'divider',
  fontWeight: isSubmitted ? 600 : 500,
  fontSize: isDesktop ? '0.75rem' : '0.8125rem',
  height: isDesktop ? 24 : 32,
  minHeight: isDesktop ? 24 : 44, // Larger touch target for mobile
  '&:hover': {
    bgcolor: isSubmitted ? 'success.dark' : 'grey.100',
    borderColor: isSubmitted ? 'success.dark' : 'grey.400',
  },
  transition: 'all 0.2s ease',
  boxShadow: isSubmitted ? '0 2px 4px rgba(76, 175, 80, 0.2)' : 'none'
});

// ===== INFO BOX (Evaluator Section) =====
const infoBoxStyle = {
  mb: 2,
  p: 1.5,
  bgcolor: 'background.default',
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider'
};

// ===== SECTION LABEL =====
const sectionLabelStyle = {
  display: 'block',
  mb: 0.5,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

// ===== ACTION BUTTONS =====
const viewButtonStyle = {
  flex: 1,
  minHeight: 44,
  borderRadius: 2
};

const iconButtonStyle = {
  minWidth: 44,
  minHeight: 44,
  bgcolor: 'primary.main',
  color: 'white',
  borderRadius: 2,
  '&:hover': {
    bgcolor: 'primary.dark'
  }
};

const deleteIconButtonStyle = {
  minWidth: 44,
  minHeight: 44,
  bgcolor: 'error.main',
  color: 'white',
  borderRadius: 2,
  '&:hover': {
    bgcolor: 'error.dark'
  }
};

// ===== FAB (Floating Action Button) =====
const mobileFabStyle = {
  position: 'fixed', 
  bottom: { xs: 24, sm: 32 }, 
  right: { xs: 20, sm: 32 }, 
  width: { xs: 64, sm: 56 },
  height: { xs: 64, sm: 56 },
  zIndex: 1000,
  boxShadow: '0 4px 20px rgba(123,198,120,0.4)',
  '&:hover': {
    boxShadow: '0 6px 24px rgba(123,198,120,0.5)'
  }
};

// ===== PAGE CONTAINER =====
const pageContainerStyle = {
  width: '100%',
  pb: { xs: 10, sm: 0 } // Extra padding at bottom for FAB on mobile
};

// ===== RESPONSIVE TYPOGRAPHY =====
const responsiveHeadingStyle = {
  fontWeight: 700,
  fontSize: { xs: '1.5rem', sm: '2rem' }
};

// ===== EMPTY STATE =====
const emptyStateCardStyle = {
  p: 4, 
  textAlign: 'center', 
  borderRadius: 3
};

/* 
 * USAGE EXAMPLE:
 * 
 * <Card sx={mobileCardStyle}>
 *   <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
 *     <Avatar sx={mobileAvatarStyle}>A</Avatar>
 *     <Box sx={infoBoxStyle}>
 *       <Typography variant="caption" sx={sectionLabelStyle}>
 *         EVALUATOR
 *       </Typography>
 *     </Box>
 *     <Button sx={viewButtonStyle}>View</Button>
 *   </CardContent>
 * </Card>
 */

// ===== BEST PRACTICES =====
/*
 * 1. Minimum Touch Targets: 44x44px (iOS/Android guideline)
 * 2. Card Padding: 16-24px on mobile
 * 3. Gap Spacing: 8-16px between elements
 * 4. Border Radius: 12-16px for cards, 8px for buttons
 * 5. Transitions: 0.2s ease for smooth animations
 * 6. Shadows: Subtle elevation changes on interaction
 * 7. Color Contrast: Ensure WCAG AA compliance
 * 8. Font Sizes: Minimum 14px for body text on mobile
 * 9. Line Height: 1.5-1.6 for readability
 * 10. Safe Areas: Account for FAB and bottom navigation
 */

export {
  mobileCardStyle,
  mobileAvatarStyle,
  formChipStyle,
  infoBoxStyle,
  sectionLabelStyle,
  viewButtonStyle,
  iconButtonStyle,
  deleteIconButtonStyle,
  mobileFabStyle,
  pageContainerStyle,
  responsiveHeadingStyle,
  emptyStateCardStyle
};
