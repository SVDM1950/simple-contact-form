const fs = require('fs-extra');
const path = require('path');
const sizeOf = require('image-size');
const normalizePath = require('normalize-path');
const Utils = require('./utils.js');
const slug = require('./slug');
const Jimp = require('./jimp.custom.js');
// Default config
let sharp = require('sharp');

const defaultAstAppConfig = require('./AST.app.config');

class Image {
    constructor(rendererInstance, pluginInstance, imageData) {
        this.siteDir = path.join(rendererInstance.sitesDir, rendererInstance.siteConfig.name);
        this.siteConfig = rendererInstance.siteConfig

        this.themeConfig = rendererInstance.themeConfig

        this.appConfigPath = path.join(rendererInstance.appDir, 'config', 'app-config.json');
        this.appConfig = JSON.parse(fs.readFileSync(this.appConfigPath, 'utf8'));
        this.appConfig = Utils.mergeObjects(JSON.parse(JSON.stringify(defaultAstAppConfig)), this.appConfig);


        this.currentTheme = rendererInstance.siteConfig.theme;

        // Image Path
        this.path = imageData.url;

        // Plugin dir
        this.pluginDir = pluginInstance.name;
    }

    /*
     * Save responsive images
     */
    createResponsiveImages(originalPath) {
        let imagesQuality = 60;
        let alphaQuality = 100;
        let forceWebp = false;
        let webpLossless = false;
        let imageExtension = path.parse(originalPath).ext;
        let imageDimensions = {
            width: false,
            height: false
        };

        if (!this.allowedImageExtension(imageExtension)) {
            return [];
        }

        try {
            imageDimensions = sizeOf(this.path);
        } catch(e) {
            imageDimensions = {
                width: false,
                height: false
            };
        }

        if (
            this.siteConfig?.advanced?.imagesQuality &&
            !isNaN(parseInt(this.siteConfig.advanced.imagesQuality, 10))
        ) {
            imagesQuality = this.siteConfig.advanced.imagesQuality;
            imagesQuality = parseInt(imagesQuality);

            if (imagesQuality < 1 || imagesQuality > 100) {
                imagesQuality = 60;
            }
        }

        if (
            this.siteConfig?.advanced?.alphaQuality &&
            !isNaN(parseInt(this.siteConfig.advanced.alphaQuality, 10))
        ) {
            alphaQuality = this.siteConfig.advanced.alphaQuality;
            alphaQuality = parseInt(alphaQuality);

            if (alphaQuality < 1 || alphaQuality > 100) {
                alphaQuality = 100;
            }
        }

        if (this.siteConfig?.advanced?.webpLossless) {
            webpLossless = !!this.siteConfig.advanced.webpLossless;
        }

        if (this.siteConfig?.advanced?.forceWebp && !this.shouldUseJimp()) {
            forceWebp = !!this.siteConfig.advanced.forceWebp;
        }

        // If there is no selected theme
        if (this.currentTheme === 'not selected') {
            return false;
        }

        // Load theme config
        let dimensions = false;
        let dimensionsConfig = false;

        dimensions = Utils.responsiveImagesDimensions(this.themeConfig, 'featuredImages');
        dimensionsConfig = Utils.responsiveImagesData(this.themeConfig, 'featuredImages');

        if (!dimensions) {
            return false;
        }

        let targetImagesDir = path.join(path.parse(originalPath).dir, 'responsive');

        // If responsive directory not exist - create it
        if (targetImagesDir !== '' && !Utils.dirExists(targetImagesDir)) {
            fs.mkdirSync(targetImagesDir);
        }

        let promises = [];

        // create responsive images for each size
        for (let name of dimensions) {
            let finalHeight = dimensionsConfig[name].height;
            let finalWidth = dimensionsConfig[name].width;
            let cropImage = dimensionsConfig[name].crop;
            let filename = path.parse(originalPath).name;
            let extension = path.parse(originalPath).ext;
            let destinationPath = path.join(targetImagesDir, filename + '-' + name + extension);
            let result;
            let shouldBeChangedToWebp = false;

            if (!this.shouldUseJimp() && ['.png', '.jpg', '.jpeg'].indexOf(extension.toLowerCase()) > -1) {
                shouldBeChangedToWebp = true;
            }

            if (forceWebp && shouldBeChangedToWebp) {
                destinationPath = path.join(targetImagesDir, filename + '-' + name + '.webp');
            }

            if (!this.allowedImageExtension(extension)) {
                continue;
            }

            if (imageDimensions.width !== false && finalWidth !== 'auto' && finalWidth > imageDimensions.width) {
                finalWidth = imageDimensions.width;
            }

            if (imageDimensions.height !== false && finalHeight !== 'auto' && finalHeight > imageDimensions.height) {
                finalHeight = imageDimensions.height;
            }

            if (finalHeight === 'auto') {
                finalHeight = null;

                if (this.shouldUseJimp()) {
                    finalHeight = Jimp.AUTO;
                }
            }

            if (finalWidth === 'auto') {
                finalWidth = null;

                if (this.shouldUseJimp()) {
                    finalWidth = Jimp.AUTO;
                }
            }

            if (cropImage) {
                if (this.shouldUseJimp()) {
                    result = new Promise ((resolve, reject) => {
                        Jimp.read(originalPath, function (err, image) {
                            if (err) {
                                reject(err);
                            }

                            console.log('JIMP COVER', finalWidth, ' x ', finalHeight);

                            if (finalWidth === Jimp.AUTO || finalHeight === Jimp.AUTO) {
                                image.resize(finalWidth, finalHeight)
                                    .quality(imagesQuality)
                                    .write(destinationPath, function() {
                                        resolve(destinationPath);
                                    });
                            } else {
                                image.cover(finalWidth, finalHeight)
                                    .quality(imagesQuality)
                                    .write(destinationPath, function() {
                                        resolve(destinationPath);
                                    });
                            }
                        }).catch(err => {
                            console.log(err);
                            reject(err);
                        });
                    });
                } else {
                    result = new Promise ((resolve, reject) => {
                        if (extension.toLowerCase() === '.png' && !forceWebp) {
                            sharp(originalPath)
                                .withMetadata()
                                .resize(finalWidth, finalHeight, { withoutEnlargement: true, fastShrinkOnLoad: false })
                                .toBuffer()
                                .then(function (outputBuffer) {
                                    let wstream = fs.createWriteStream(destinationPath);
                                    wstream.write(outputBuffer);
                                    wstream.end();

                                    resolve(destinationPath);
                                }).catch(err => reject(err))
                        } else if (extension.toLowerCase() === '.webp' || (forceWebp && shouldBeChangedToWebp)) {
                            let webpConfig = {
                                quality: imagesQuality,
                                alphaQuality: alphaQuality,
                            };

                            if (webpLossless) {
                                webpConfig = {
                                    lossless: true
                                };
                            }

                            sharp(originalPath)
                                .withMetadata()
                                .resize(finalWidth, finalHeight, { withoutEnlargement: true, fastShrinkOnLoad: false })
                                .webp(webpConfig)
                                .toBuffer()
                                .then(function (outputBuffer) {
                                    let wstream = fs.createWriteStream(destinationPath);
                                    wstream.write(outputBuffer);
                                    wstream.end();

                                    resolve(destinationPath);
                                }).catch(err => reject(err))
                        } else {
                            sharp(originalPath)
                                .withMetadata()
                                .resize(finalWidth, finalHeight, { withoutEnlargement: true, fastShrinkOnLoad: false })
                                .jpeg({
                                    quality: imagesQuality
                                })
                                .toBuffer()
                                .then(function (outputBuffer) {
                                    let wstream = fs.createWriteStream(destinationPath);
                                    wstream.write(outputBuffer);
                                    wstream.end();

                                    resolve(destinationPath);
                                }).catch(err => reject(err))
                        }
                    }).catch(err => console.log(err));
                }
            } else {
                if (this.shouldUseJimp()) {
                    result = new Promise ((resolve, reject) => {
                        Jimp.read(originalPath, function (err, image) {
                            if (err) {
                                reject(err);
                            }

                            console.log('JIMP SCALE TO FIT', finalWidth, ' x ', finalHeight);
                            image.scaleToFit(finalWidth, finalHeight)
                                .quality(imagesQuality)
                                .write(destinationPath, function() {
                                    resolve(destinationPath)
                                });
                        });
                    }).catch(err => {
                        console.log(err);
                        reject(err);
                    });
                } else {
                    result = new Promise ((resolve, reject) => {
                        if (extension.toLowerCase() === '.png' && !forceWebp) {
                            sharp(originalPath)
                                .withMetadata()
                                .resize(finalWidth, finalHeight, { fit: 'inside', withoutEnlargement: true, fastShrinkOnLoad: false })
                                .toBuffer()
                                .then(function (outputBuffer) {
                                    let wstream = fs.createWriteStream(destinationPath);
                                    wstream.write(outputBuffer);
                                    wstream.end();
                                    resolve(destinationPath);
                                }).catch(err => reject(err));
                        } else if (extension.toLowerCase() === '.webp' || (forceWebp && shouldBeChangedToWebp)) {
                            let webpConfig = {
                                quality: imagesQuality,
                                alphaQuality: alphaQuality,
                            };

                            if (webpLossless) {
                                webpConfig = {
                                    lossless: true
                                };
                            }

                            sharp(originalPath)
                                .withMetadata()
                                .resize(finalWidth, finalHeight, { fit: 'inside', withoutEnlargement: true, fastShrinkOnLoad: false })
                                .webp(webpConfig)
                                .toBuffer()
                                .then(function (outputBuffer) {
                                    let wstream = fs.createWriteStream(destinationPath);
                                    wstream.write(outputBuffer);
                                    wstream.end();
                                    resolve(destinationPath);
                                }).catch(err => reject(err));
                        } else {
                            sharp(originalPath)
                                .withMetadata()
                                .resize(finalWidth, finalHeight, { fit: 'inside', withoutEnlargement: true, fastShrinkOnLoad: false })
                                .jpeg({
                                    quality: imagesQuality
                                })
                                .toBuffer()
                                .then(function (outputBuffer) {
                                    let wstream = fs.createWriteStream(destinationPath);
                                    wstream.write(outputBuffer);
                                    wstream.end();
                                    resolve(destinationPath);
                                }).catch(err => reject(err));
                        }
                    }).catch(err => {
                        console.log(err);
                    });
                }
            }

            promises.push(result);
        }

        return promises;
    }

    /*
     * Check if the image has supported image extension
     */
    allowedImageExtension(extension) {
        let allowedExtensions = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG', '.webp', '.WEBP'];

        if (this.shouldUseJimp()) {
            allowedExtensions = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'];
        }

        return allowedExtensions.indexOf(extension) > -1;
    }

    /*
     * Detect if Jimp should be used
     */
    shouldUseJimp() {
        return this.appConfig.resizeEngine && this.appConfig.resizeEngine === 'jimp';
    }
}

module.exports = Image;
