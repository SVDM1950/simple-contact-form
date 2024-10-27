/*
 * Class used to help with operations on
 * the URLs and slugs
 */
const normalizePath = require('normalize-path');

/**
 * Class used to load Theme files as a Handlebar templates
 */
class URLHelper {
    /**
     * Creates an image URL
     *
     * @param domain
     * @param itemID
     * @param imageURL
     * @param type
     * @returns {string}
     */
    static createImageURL(domain, itemID, imageURL, type = 'post') {
        let output = [domain, 'media', type + 's', itemID, imageURL];
        output = normalizePath(output.join('/'));
        output = URLHelper.fixProtocols(output);

        return output;
    }

    /**
     * Fixes known problems with protocols in a given URL
     *
     * @param input
     * @returns {*}
     */
    static fixProtocols(input) {
        if(input.substr(0,6) === 'http:/' && input.substr(0,7) !== 'http://') {
            input = input.replace('http:/', 'http://');
        }

        if(input.substr(0,8) === 'http:///') {
            input = input.replace('http:///', 'http://');
        }

        if(input.substr(0,7) === 'https:/' && input.substr(0,8) !== 'https://') {
            input = input.replace('https:/', 'https://');
        }

        if(input.substr(0,9) === 'https:///') {
            input = input.replace('https:///', 'https://');
        }

        if(input.substr(0,6) === 'file:/' && input.substr(0,7) !== 'file://') {
            input = input.replace('file:/', 'file:///');
        }

        if(input.substr(0,7) === 'file://' && input.substr(0,8) !== 'file:///') {
            input = input.replace('file://', 'file:///');
        }

        return input;
    }
}

module.exports = URLHelper;
