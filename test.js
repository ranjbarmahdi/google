const { URL } = require('url');

function isValidURL(url) {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}

function getHostNameFromUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname;
    } catch (error) {
        console.error("Invalid URL:", error);
        return '';
    }
}

console.log("a" > "2");