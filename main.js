class SimpleContactForm {
    constructor(API, name, config) {
        this.API = API;
        this.name = name;
        this.config = config;
    }

    addModifiers() {
        this.API.addModifier('menuStructure', this.modifyMenuStructure, 1, this);
        this.API.addModifier('htmlOutput', this.generateContactForm, 1, this);
    }

    modifyMenuStructure(rendererInstance, output, ...params) {
        let menuPosition = parseInt(this.config['menu']);

        const translations = rendererInstance.translations.user.contact ?? rendererInstance.translations.theme.contact;

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

        if(menuPosition < 0) {
            menuPosition = output[this.config['menu']].items.length + menuPosition
        }

        if(menuPosition > 0) {
            menuPosition -= 1;
        }

        output[this.config['menu']].items.splice(menuPosition, 0, menuItem);

        return output;
    }

    generateContactForm(rendererInstance, output, globalContext, context) {
        if (globalContext.context.length !== 1 || globalContext.context[0] !== 'index') {
            return output;
        }

        const translations = rendererInstance.translations.user.contact ?? rendererInstance.translations.theme.contact;

        // Load template
        let suffix = '.html';
        let pageSlug = translations.menu.slug;
        let inputFile = 'contact.hbs';
        let compiledTemplate = rendererInstance.compileTemplate(inputFile);

        if (globalContext.config.site.urls.cleanUrls) {
            suffix = '/index.html';
        }

        globalContext.context = ['contact'];
        globalContext.plugins.simpleContactForm.config.recaptcha = this.config.recaptchaSiteKey && !rendererInstance.previewMode;

        context.title = `${globalContext.website.name} - ${translations.menu.label}`;
        context.contact = {
            title: `${translations.menu.label}`
        }

        // let uuid = crypto.randomUUID()
        // this.API.createFile(`[ROOT-FILES]/${uuid}.generateContactForm.output.json`, JSON.stringify(output), this);
        // this.API.createFile(`[ROOT-FILES]/${uuid}.generateContactForm.globalContext.json`, JSON.stringify(globalContext), this);
        // this.API.createFile(`[ROOT-FILES]/${uuid}.generateContactForm.context.json`, JSON.stringify(context), this);

        let content = rendererInstance.renderTemplate(compiledTemplate, context, globalContext, inputFile);
        rendererInstance.templateHelper.saveOutputFile(pageSlug + suffix, content);

        return output;
    }
}

module.exports = SimpleContactForm;
