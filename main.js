const fs = require('fs-extra');
const path = require('path');
const sizeOf = require('image-size');
const URLHelper = require('./helpers/url');
const ContentHelper = require('./helpers/content');
const Image = require('./helpers/image');

class SimpleContactForm {
    constructor(API, name, config) {
        this.API = API;
        this.name = name;
        this.config = config;
    }

    addModifiers() {
        this.API.addModifier('menuStructure', this.modifyMenuStructure, 1, this);
        this.API.addModifier('htmlOutput', this.generateContactForm, 1, this);
        this.API.addModifier('htmlOutput', this.replaceInternalLink, 1, this);
    }

    modifyMenuStructure(rendererInstance, output) {
        this.rendererInstance = rendererInstance;

        const translations = this.rendererInstance.translations.user.contact ?? this.rendererInstance.translations.theme.contact;

        const menuItem = {
            "id": 1,
            "label": translations.menu.label,
            "title": translations.menu.title,
            "type": "page",
            "target": "_self",
            "rel": "",
            "link": translations.menu.slug,
            "cssClass": "",
            "isHidden": false,
            "items": [],
            "level": 2,
            "linkID": "empty"
        }

        let menuPosition = parseInt(this.config['menuPosition']);

        if(menuPosition < 0) {
            menuPosition = output[this.config['menu']].items.length + menuPosition
        } else if(menuPosition > 0) {
            menuPosition -= 1;
        }

        output[this.config['menu']].items.splice(menuPosition, 0, menuItem);

        return output;
    }

    generateContactForm(rendererInstance, output, globalContext, context) {
        this.rendererInstance = rendererInstance;

        if (rendererInstance.menuContext.length !== 1 || (rendererInstance.menuContext[0] !== 'frontpage' && rendererInstance.menuContext[0] !== 'blogpage')) {
            return output;
        }

        const translations = this.rendererInstance.translations.user.contact ?? this.rendererInstance.translations.theme.contact;

        // Load template
        let suffix = '.html';
        let pageSlug = translations.menu.slug;
        let inputFile = 'contact.hbs';
        let compiledTemplate = this.rendererInstance.compileTemplate(inputFile);

        if (globalContext.config.site.urls.cleanUrls) {
            suffix = '/index.html';
        }

        const oldMenuContext = this.rendererInstance.menuContext
        this.rendererInstance.menuContext = ['contact'];

        globalContext.context = ['contact'];
        globalContext.plugins[this.name].config.recaptcha = this.config.recaptchaEnabled && this.config.recaptchaSiteKey && !this.rendererInstance.previewMode;

        context.title = `${globalContext.website.name} - ${translations.menu.label}`;
        context.contact = {
            title: `${translations.menu.label}`,
            featuredImage: false,
            text: globalContext.plugins[this.name].config.contactContent,
        }

        if(globalContext.plugins[this.name].config['contactFeaturedImage'] !== undefined && globalContext.plugins[this.name].config.contactFeaturedImage !== '') {
            let imageUrl = globalContext.plugins[this.name].config.contactFeaturedImage;
            let imageData = {
                id: path.parse(imageUrl).base,
                url: imageUrl,
                alt: `${translations.menu.label}`,
            };

            context.contact.featuredImage = this.getFeaturedImages(imageUrl, imageData);
        }

        let content = this.rendererInstance.renderTemplate(compiledTemplate, context, globalContext, inputFile);
        this.saveOutputFile(pageSlug + suffix, content);

        this.rendererInstance.menuContext = oldMenuContext

        return output;
    }

    replaceInternalLink(rendererInstance, output, globalContext, context) {
        this.rendererInstance = rendererInstance;

        const translations = this.rendererInstance.translations.user.contact ?? this.rendererInstance.translations.theme.contact;

        let contactSlug = translations.menu.slug;

        let url = '#INTERNAL_LINK#/contact';
        let link = this.rendererInstance.siteConfig.domain + '/' + contactSlug;

        if (this.rendererInstance.previewMode || this.rendererInstance.siteConfig.advanced.urls.addIndex) {
            link = link + '/index.html';
        }

        output = output.split(url).join(link);

        return output;
    }

    saveOutputFile(fileName, content) {
        let filePath = path.join(this.rendererInstance.outputDir, fileName);

        fs.ensureDirSync(path.parse(filePath).dir);
        fs.outputFileSync(filePath, content, 'utf-8');
    }

    getFeaturedImages(imageFilename, featuredImageData) {
        let contactImage = {
            id: path.parse(imageFilename).base,
            url: imageFilename,
            additional_data: JSON.stringify(featuredImageData)
        };

        if (contactImage && contactImage.url) {
            let imagePath = '';
            let url = '';
            let alt = '';
            let caption = '';
            let credits = '';
            let imageDimensions = false;

            if (contactImage.additional_data) {
                let data = JSON.parse(contactImage.additional_data);

                imagePath = URLHelper.createImageURL(this.rendererInstance.inputDir, this.name, contactImage.url, 'plugin');
                let domain = this.rendererInstance.siteConfig.domain;

                url = URLHelper.createImageURL(domain, this.name, contactImage.url, 'plugin');
                alt = data.alt;
                caption = data.caption;
                credits = data.credits;

                try {
                    imageDimensions = sizeOf(imagePath);
                } catch(e) {
                    console.log('simple-contact-form.js: wrong image path - missing dimensions');
                    imageDimensions = false;
                }
            } else {
                return false;
            }

            let featuredImageSrcSet = false;
            let featuredImageSizes = false;

            if(!this.isGifOrSvg(url)) {
                let useWebp = false;

                if (this.rendererInstance.siteConfig?.advanced?.forceWebp) {
                    useWebp = true;
                }

                featuredImageSrcSet = ContentHelper.getFeaturedImageSrcset(url, this.rendererInstance.themeConfig, useWebp);
                featuredImageSizes = ContentHelper.getFeaturedImageSizes(this.rendererInstance.themeConfig);
            } else {
                featuredImageSrcSet = '';
                featuredImageSizes = '';
            }

            let featuredImageData = {
                id: contactImage.id,
                url: url,
                alt: alt,
                caption: caption,
                credits: credits,
                height: imageDimensions.height,
                width: imageDimensions.width,
                srcset: featuredImageSrcSet,
                sizes: featuredImageSizes
            };

            // Create responsive images
            let featuredImage = new Image(this.rendererInstance, this, featuredImageData);
            const proms = featuredImage.createResponsiveImages(imagePath);
            if (proms) {
                Promise.allSettled(proms)
                    .catch(() => {
                    });
            }

            // Create alternative names for dimensions
            let dimensions = false;

            if (
                this.rendererInstance.themeConfig.files &&
                this.rendererInstance.themeConfig.files.responsiveImages
            ) {
                if (
                    this.rendererInstance.themeConfig.files.responsiveImages.featuredImages &&
                    this.rendererInstance.themeConfig.files.responsiveImages.featuredImages.dimensions
                ) {
                    dimensions = this.rendererInstance.themeConfig.files.responsiveImages.featuredImages.dimensions;
                } else if (
                    this.rendererInstance.themeConfig.files.responsiveImages.contentImages &&
                    this.rendererInstance.themeConfig.files.responsiveImages.contentImages.dimensions
                ) {
                    dimensions = this.rendererInstance.themeConfig.files.responsiveImages.featuredImages.dimensions;
                }

                if (dimensions) {
                    let dimensionNames = Object.keys(dimensions);

                    for (let dimensionName of dimensionNames) {
                        let base = path.parse(url).base;
                        let filename = path.parse(url).name;
                        let extension = path.parse(url).ext;
                        let newFilename = filename + '-' + dimensionName + extension;
                        let capitalizedDimensionName = dimensionName.charAt(0).toUpperCase() + dimensionName.slice(1);

                        if(!this.isGifOrSvg(url)) {
                            featuredImageData['url' + capitalizedDimensionName] = url.replace(base, newFilename);
                        } else {
                            featuredImageData['url' + capitalizedDimensionName] = url;
                        }
                    }
                }
            }

            return featuredImageData;
        }

        return false;
    }

    /**
     * Detects if image is a GIF or SVG
     */
    isGifOrSvg(url) {
        return url.slice(-4) === '.gif' || url.slice(-4) === '.svg';
    }
}

module.exports = SimpleContactForm;
