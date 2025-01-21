const fs = require('fs');
require('dotenv').config();

// Create dist if it doesn't exist
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
}

// Replace API key and copy to dist
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('YOUR_API_KEY', process.env.GOOGLE_MAPS_API_KEY);
fs.writeFileSync('dist/index.html', html);
