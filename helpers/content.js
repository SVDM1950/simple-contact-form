/*
 * Class used to help with operations on
 * the URLs and slugs
 */
const path = require('path');
const UtilsHelper = require('./utils');

/**
 * Class used to prepare content in data items
 */
class ContentHelper {

    /**
     * Returns srcset for featured image
     */
    static getFeaturedImageSrcset(baseUrl, themeConfig, useWebp, type = 'post') {
        if(!ContentHelper._isImage(baseUrl) || !UtilsHelper.responsiveImagesConfigExists(themeConfig)) {
            return false;
        }

        let dimensions = UtilsHelper.responsiveImagesDimensions(themeConfig, 'featuredImages');
        let dimensionsData = UtilsHelper.responsiveImagesData(themeConfig, 'featuredImages');
        let groups = UtilsHelper.responsiveImagesGroups(themeConfig, 'featuredImages');

        if (type === 'tag') {
            dimensions = UtilsHelper.responsiveImagesDimensions(themeConfig, 'tagImages');
            dimensionsData = UtilsHelper.responsiveImagesData(themeConfig, 'tagImages');
            groups = UtilsHelper.responsiveImagesGroups(themeConfig, 'tagImages');
        } else if (type === 'author') {
            dimensions = UtilsHelper.responsiveImagesDimensions(themeConfig, 'authorImages');
            dimensionsData = UtilsHelper.responsiveImagesData(themeConfig, 'authorImages');
            groups = UtilsHelper.responsiveImagesGroups(themeConfig, 'authorImages');
        }

        if(!dimensions) {
            dimensions = UtilsHelper.responsiveImagesDimensions(themeConfig, 'contentImages');
            dimensionsData = UtilsHelper.responsiveImagesData(themeConfig, 'contentImages');
            groups = false;
        }

        if(!dimensions) {
            return false;
        }

        let srcset = [];

        if(groups === false) {
            for(let dimension of dimensions) {
                let responsiveImage = ContentHelper._getSrcSet(baseUrl, dimension, useWebp);
                srcset.push(responsiveImage + ' ' + dimensionsData[dimension].width + 'w');
            }

            return srcset.join(' ,');
        } else {
            srcset = {};

            for(let dimension of dimensions) {
                let groupNames = dimensionsData[dimension].group.split(',');

                for(let groupName of groupNames) {
                    if (!srcset[groupName]) {
                        srcset[groupName] = [];
                    }

                    let responsiveImage = ContentHelper._getSrcSet(baseUrl, dimension, useWebp);
                    srcset[groupName].push(responsiveImage + ' ' + dimensionsData[dimension].width + 'w');
                }
            }

            let srcsetKeys = Object.keys(srcset);

            for(let key of srcsetKeys) {
                srcset[key] = srcset[key].join(' ,');
            }

            return srcset;
        }
    }

    /**
     * Returns content of the sizes attribute for featured image
     */
    static getFeaturedImageSizes(themeConfig, type = 'post') {
        if(!UtilsHelper.responsiveImagesConfigExists(themeConfig)) {
            return false;
        }

        if (type === 'tag' && UtilsHelper.responsiveImagesConfigExists(themeConfig, 'tagImages')) {
            return themeConfig.files.responsiveImages.tagImages.sizes;
        } else if (type === 'author' && UtilsHelper.responsiveImagesConfigExists(themeConfig, 'authorImages')) {
            return themeConfig.files.responsiveImages.authorImages.sizes;
        } else if (type === 'post' && UtilsHelper.responsiveImagesConfigExists(themeConfig, 'featuredImages')) {
            return themeConfig.files.responsiveImages.featuredImages.sizes;
        } else if (UtilsHelper.responsiveImagesConfigExists(themeConfig, 'contentImages')) {
            return themeConfig.files.responsiveImages.contentImages.sizes;
        }

        return false;
    }

    /**
     * Returns srcset attribute
     *
     * @param url
     * @param dimension
     * @returns {string}
     * @private
     */
    static _getSrcSet(url, dimension, useWebp) {
        let filename = url.split('/');
        filename = filename[filename.length-1];
        let filenameFile = path.parse(filename).name;
        let filenameExtension = path.parse(filename).ext;

        if (useWebp && ['.jpg', '.jpeg', '.png'].indexOf(filenameExtension.toLowerCase()) > -1) {
            filenameExtension = '.webp';
        }

        let baseUrlWithoutFilename = url.replace(filename, '');
        let responsiveImage = baseUrlWithoutFilename + 'responsive/' + filenameFile + '-' + dimension + filenameExtension;
        responsiveImage = responsiveImage.replace(/\s/g, '%20');

        return responsiveImage;
    }

    /**
     * Checks if specified URL is an image
     *
     * @param url
     * @returns {boolean}
     * @private
     */
    static _isImage(url) {
        if (
            url.toLowerCase().indexOf('.jpg') === -1 &&
            url.toLowerCase().indexOf('.jpeg') === -1 &&
            url.toLowerCase().indexOf('.png') === -1 &&
            url.toLowerCase().indexOf('.webp') === -1
        ) {
            return false;
        }

        return true;
    }
}

module.exports = ContentHelper;
