// Test script to verify mentor evaluator assignment and form status features
// Run this in browser console on the Mentors page

console.log('🧪 Testing TALC Mentor Features...\n');

// Test 1: Check if form status colors are working
const checkFormColors = () => {
  const formChips = document.querySelectorAll('[data-testid="form-chip"], .MuiChip-root');
  let greenChips = 0;
  let greyChips = 0;
  
  formChips.forEach(chip => {
    const styles = window.getComputedStyle(chip);
    const bgColor = styles.backgroundColor;
    
    if (bgColor.includes('76, 175, 80') || bgColor.includes('success')) {
      greenChips++;
    } else if (bgColor.includes('224, 224, 224') || bgColor.includes('grey')) {
      greyChips++;
    }
  });
  
  console.log(`✅ Form Status Colors:`);
  console.log(`   - Green (submitted): ${greenChips} chips`);
  console.log(`   - Grey (pending): ${greyChips} chips\n`);
};

// Test 2: Check if evaluator assignment is visible
const checkEvaluatorAssignment = () => {
  const mentorCards = document.querySelectorAll('[role="button"]');
  let mentorsWithEvaluators = 0;
  let mentorsWithoutEvaluators = 0;
  
  mentorCards.forEach(card => {
    const evaluatorText = card.textContent.toLowerCase();
    if (evaluatorText.includes('evaluator:')) {
      mentorsWithEvaluators++;
    } else {
      mentorsWithoutEvaluators++;
    }
  });
  
  console.log(`✅ Evaluator Assignment:`);
  console.log(`   - Mentors with evaluators: ${mentorsWithEvaluators}`);
  console.log(`   - Mentors without evaluators: ${mentorsWithoutEvaluators}\n`);
};

// Test 3: Check if legend is present and functional
const checkLegend = () => {
  const legend = document.querySelector('[aria-label*="legend"], [data-testid="form-legend"]');
  const infoIcon = document.querySelector('[data-testid="InfoIcon"]');
  
  if (legend || infoIcon) {
    console.log(`✅ Form Status Legend: Present and accessible\n`);
  } else {
    console.log(`⚠️  Form Status Legend: Not found\n`);
  }
};

// Test 4: Mobile responsiveness check
const checkMobileResponsiveness = () => {
  const isMobile = window.innerWidth < 960; // Material-UI md breakpoint
  const mobileCards = document.querySelectorAll('.MuiCard-root');
  const desktopTable = document.querySelector('.MuiTable-root');
  
  console.log(`✅ Mobile Responsiveness:`);
  console.log(`   - Screen width: ${window.innerWidth}px`);
  console.log(`   - Mobile mode: ${isMobile}`);
  console.log(`   - Mobile cards visible: ${mobileCards.length > 0 && isMobile}`);
  console.log(`   - Desktop table visible: ${desktopTable !== null && !isMobile}\n`);
};

// Run all tests
try {
  checkFormColors();
  checkEvaluatorAssignment();
  checkLegend();
  checkMobileResponsiveness();
  
  console.log('🎉 All tests completed! Check the results above.');
  console.log('\n💡 To test notifications:');
  console.log('   1. Assign an evaluator to a mentor');
  console.log('   2. Ensure the mentor has assigned forms');
  console.log('   3. Check that forms show correct status (green if submitted this month)');
  console.log('   4. Deploy Cloud Functions and wait for Friday 2 PM IST for KPI reminders');
  
} catch (error) {
  console.error('❌ Test failed:', error);
}