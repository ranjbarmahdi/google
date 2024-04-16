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

// console.log(isValidURL('/asdwhtdp://schat.openai.coasdsm/'));

// console.log(getHostNameFromUrl('/asdwhtdp://schat.openai.coasdsm/'));