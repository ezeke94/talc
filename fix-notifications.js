const fs = require('fs');
const path = require('path');

// Function to fix notification icon placement
function fixNotificationIcons(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    // Pattern 1: Move icon from notification to webpush.notification (when webpush exists)
    const pattern1 = /notification:\s*{\s*([^}]*?)icon:\s*['"][^'"]*['"][,]?\s*([^}]*?)}\s*,\s*([^}]*?)webpush:\s*{\s*([^}]*?)}\s*,/gs;
    content = content.replace(pattern1, (match, beforeIcon, afterIcon, between, webpushContent) => {
        changed = true;
        // Remove icon from notification object
        let cleanedNotification = (beforeIcon + afterIcon).replace(/,\s*,/g, ',').replace(/,\s*$/, '');
        
        // Add icon to webpush.notification
        let updatedWebpush;
        if (webpushContent.includes('notification:')) {
            // webpush already has notification object, add icon to it
            updatedWebpush = webpushContent.replace(
                /notification:\s*{([^}]*?)}/,
                'notification: {$1icon: \'/favicon.ico\'}'
            );
        } else {
            // webpush doesn't have notification object, add it
            updatedWebpush = webpushContent + 'notification: { icon: \'/favicon.ico\' },';
        }
        
        return `notification: { ${cleanedNotification} }, ${between}webpush: { ${updatedWebpush} },`;
    });
    
    // Pattern 2: Add webpush.notification when webpush doesn't exist
    const pattern2 = /notification:\s*{\s*([^}]*?)icon:\s*['"][^'"]*['"][,]?\s*([^}]*?)}\s*,\s*data:\s*{/gs;
    content = content.replace(pattern2, (match, beforeIcon, afterIcon) => {
        changed = true;
        let cleanedNotification = (beforeIcon + afterIcon).replace(/,\s*,/g, ',').replace(/,\s*$/, '');
        return `notification: { ${cleanedNotification} }, data: {`;
    });
    
    // Write back if changed
    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed ${filePath}`);
        return true;
    }
    return false;
}

// Fix all JavaScript files in functions directory
const functionsDir = './functions';
const files = fs.readdirSync(functionsDir).filter(f => f.endsWith('.js'));

console.log('Fixing notification icon placement...');
let totalFixed = 0;

files.forEach(file => {
    const filePath = path.join(functionsDir, file);
    if (fixNotificationIcons(filePath)) {
        totalFixed++;
    }
});

console.log(`Fixed ${totalFixed} files.`);