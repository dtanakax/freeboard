// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

// Jquery plugin to watch for attribute changes
(function($)
{
    function isDOMAttrModifiedSupported() {
        var p = document.createElement('p');
        var flag = false;

        if(p.addEventListener) {
            p.addEventListener('DOMAttrModified', function() {
                flag = true;
            }, false);
        } else if(p.attachEvent) {
            p.attachEvent('onDOMAttrModified', function() {
                flag = true;
            });
        } else {
            return false;
        }

        p.setAttribute('id', 'target');
        return flag;
    }

    function checkAttributes(chkAttr, e) {
        if (chkAttr) {
            var attributes = this.data('attr-old-value');

            if(e.attributeName.indexOf('style') >= 0) {
                if(!attributes['style'])
                    attributes['style'] = {};

                //initialize
                var keys = e.attributeName.split('.');
                e.attributeName = keys[0];
                e.oldValue = attributes['style'][keys[1]]; //old value
                e.newValue = keys[1] + ':' + this.prop('style')[$.camelCase(keys[1])]; //new value
                attributes['style'][keys[1]] = e.newValue;
            }
            else
            {
                e.oldValue = attributes[e.attributeName];
                e.newValue = this.attr(e.attributeName);
                attributes[e.attributeName] = e.newValue;
            }

            this.data('attr-old-value', attributes); //update the old value object
        }
    }

    //initialize Mutation Observer
    var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

    $.fn.attrchange = function(o) {

        var cfg = {
            trackValues: false,
            callback   : $.noop
        };

        // for backward compatibility
        if(typeof o === 'function')
            cfg.callback = o;
        else
            $.extend(cfg, o);

        // get attributes old value
        if(cfg.trackValues) {
            //get attributes old value
            $(this).each(function(j, el) {
                var attributes = {};
                for(var attr, i = 0, attrs = el.attributes, l = attrs.length; i < l; i++) {
                    attr = attrs.item(i);
                    attributes[attr.nodeName] = attr.value;
                }

                $(this).data('attr-old-value', attributes);
            });
        }

        // Modern Browsers supporting MutationObserver
        if (MutationObserver) {
            /*
             Mutation Observer is still new and not supported by all browsers.
             http://lists.w3.org/Archives/Public/public-webapps/2011JulSep/1622.html
             */
            var mOptions = {
                subtree          : false,
                attributes       : true,
                attributeOldValue: cfg.trackValues
            };

            var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(e) {
                    var _this = e.target;

                    //get new value if trackValues is true
                    if (cfg.trackValues) {
                        /**
                         * @KNOWN_ISSUE: The new value is buggy for STYLE attribute as we don't have
                         * any additional information on which style is getting updated.
                         * */
                        e.newValue = $(_this).attr(e.attributeName);
                    }

                    cfg.callback.call(_this, e);
                });
            });

            return this.each(function() {
                observer.observe(this, mOptions);
            });
        } else if(isDOMAttrModifiedSupported()) { //Opera
            //Good old Mutation Events but the performance is no good
            //http://hacks.mozilla.org/2012/05/dom-mutationobserver-reacting-to-dom-changes-without-killing-browser-performance/
            return this.on('DOMAttrModified', function(event) {
                if(event.originalEvent) {
                    event = event.originalEvent;
                } //jQuery normalization is not required for us
                event.attributeName = event.attrName; //property names to be consistent with MutationObserver
                event.oldValue = event.prevValue; //property names to be consistent with MutationObserver
                cfg.callback.call(this, event);
            });
        } else if('onpropertychange' in document.body) { //works only in IE
            return this.on('propertychange', function(e) {
                e.attributeName = window.event.propertyName;
                //to set the attr old value
                checkAttributes.call($(this), cfg.trackValues, e);
                cfg.callback.call(this, e);
            });
        }

        return this;
    };
})(jQuery);

(function(jQuery) {
    'use strict';

    jQuery.eventEmitter = {
        _JQInit: function() {
            this._JQ = jQuery(this);
        },
        emit: function(evt, data) {
            !this._JQ && this._JQInit();
            this._JQ.trigger(evt, data);
        },
        once: function(evt, handler) {
            !this._JQ && this._JQInit();
            this._JQ.one(evt, handler);
        },
        on: function(evt, handler) {
            !this._JQ && this._JQInit();
            this._JQ.bind(evt, handler);
        },
        off: function(evt, handler) {
            !this._JQ && this._JQInit();
            this._JQ.unbind(evt, handler);
        }
    };
}(jQuery));

var freeboard = (function() {
    'use strict';

    var datasourcePlugins = {};
    var widgetPlugins = {};

    var freeboardUI = new FreeboardUI();
    var theFreeboardModel = new FreeboardModel(datasourcePlugins, widgetPlugins, freeboardUI);

    var jsEditor = new JSEditor();
    var valueEditor = new ValueEditor(theFreeboardModel);
    var pluginEditor = new PluginEditor(jsEditor, valueEditor);

    var developerConsole = new DeveloperConsole(theFreeboardModel);

    ko.bindingHandlers.pluginEditor = {
        init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            var options = ko.unwrap(valueAccessor());

            var types = {};
            var settings;
            var title = '';

            if (options.type == 'datasource') {
                types = datasourcePlugins;
                title = $.i18n.t('PluginEditor.datasource.title');
            } else if (options.type == 'widget') {
                types = widgetPlugins;
                title = $.i18n.t('PluginEditor.widget.title');
            } else if (options.type == 'pane') {
                title = $.i18n.t('PluginEditor.pane.title');
            }

            $(element).click(function(event) {
                if (options.operation == 'delete') {
                    var _title = $.i18n.t('PluginEditor.delete.title'),
                        _yes = $.i18n.t('global.yes'),
                        _no = $.i18n.t('global.no'),
                        _ask = $.i18n.t('PluginEditor.delete.text');

                    var phraseElement = $('<p>' + title + ' ' + _ask + ' ？</p>');
                    var db = new DialogBox(phraseElement, _title, _yes, _no, function(okcancel) {
                        if (okcancel == 'ok') {
                            if (options.type == 'datasource') {
                                theFreeboardModel.deleteDatasource(viewModel);
                            } else if (options.type == 'widget') {
                                theFreeboardModel.deleteWidget(viewModel);
                            } else if (options.type == 'pane') {
                                theFreeboardModel.deletePane(viewModel);
                            }
                        }
                    });
                } else {
                    var instanceType;

                    if (options.type === 'datasource') {
                        if(options.operation === 'add') {
                            settings = {};
                        } else {
                            instanceType = viewModel.type();
                            settings = viewModel.settings();
                            settings.name = viewModel.name();
                            viewModel.isEditing(true);
                        }
                    } else if(options.type === 'widget') {
                        if (options.operation === 'add') {
                            settings = {};
                        } else {
                            instanceType = viewModel.type();
                            settings = viewModel.settings();
                            viewModel.isEditing(true);
                        }
                    } else if (options.type === 'pane') {
                        settings = {};

                        if (options.operation === 'edit') {
                            settings.title = viewModel.title();
                            settings.col_width = viewModel.col_width();
                        }

                        types = {
                            settings: {
                                settings: [{
                                    name: "title",
                                    display_name: $.i18n.t('PluginEditor.pane.edit.title'),
                                    validate: "optional,maxSize[100]",
                                    type: "text",
                                    description: $.i18n.t('PluginEditor.pane.edit.title_desc')
                                }, {
                                    name: "col_width",
                                    display_name: $.i18n.t('PluginEditor.pane.edit.colwidth'),
                                    validate: "required,custom[integer],min[1],max[10]",
                                    style: "width:100px",
                                    type: "number",
                                    default_value: 1,
                                    description: $.i18n.t('PluginEditor.pane.edit.colwidth_desc')
                                }]
                            }
                        };
                    }

                    var saveSettingCallback = function(newSettings) {
                        if (options.operation === 'add') {
                            var newViewModel;
                            if (options.type === 'datasource') {
                                newViewModel = new DatasourceModel(theFreeboardModel, datasourcePlugins);
                                theFreeboardModel.addDatasource(newViewModel);

                                newViewModel.name(newSettings.settings.name);
                                delete newSettings.settings.name;

                                newViewModel.settings(newSettings.settings);
                                newViewModel.type(newSettings.type);
                            } else if (options.type === 'widget') {
                                newViewModel = new WidgetModel(theFreeboardModel, widgetPlugins);
                                newViewModel.settings(newSettings.settings);
                                newViewModel.type(newSettings.type);

                                viewModel.widgets.push(newViewModel);

                                freeboardUI.attachWidgetEditIcons(element);
                            }
                        } else if (options.operation === 'edit') {
                            if(options.type === 'pane') {
                                viewModel.title(newSettings.settings.title);
                                viewModel.col_width(newSettings.settings.col_width);
                                freeboardUI.processResize(false);
                            } else {
                                if(options.type === 'datasource') {
                                    if (viewModel.name() != newSettings.settings.name)
                                        theFreeboardModel.updateDatasourceNameRef(newSettings.settings.name, viewModel.name());
                                    viewModel.name(newSettings.settings.name);
                                    delete newSettings.settings.name;
                                }
                                viewModel.isEditing(false);
                                viewModel.type(newSettings.type);
                                viewModel.settings(newSettings.settings);
                            }
                        }
                    };

                    var cancelCallback = function() {
                        if (options.operation === 'edit') {
                            if (options.type === 'widget' || options.type === 'datasource')
                                viewModel.isEditing(false);
                        }
                    };

                    pluginEditor.createPluginEditor(title, types, instanceType, settings, saveSettingCallback, cancelCallback);
                }
            });
        }
    };

    ko.virtualElements.allowedBindings.datasourceTypeSettings = true;
    ko.bindingHandlers.datasourceTypeSettings = {
        update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            processPluginSettings(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext);
        }
    };

    ko.bindingHandlers.pane = {
        init  : function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            if (theFreeboardModel.isEditing())
                $(element).css({cursor: 'pointer'});

            freeboardUI.addPane(element, viewModel, bindingContext.$root.isEditing());
        },

        update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            // If pane has been removed
            if (theFreeboardModel.panes.indexOf(viewModel) == -1)
                freeboardUI.removePane(element);
            freeboardUI.updatePane(element, viewModel);
        }
    };

    ko.bindingHandlers.widget = {
        init  : function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            if (theFreeboardModel.isEditing())
                freeboardUI.attachWidgetEditIcons($(element).parent());
        },

        update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            if (viewModel.shouldRender()) {
                $(element).empty();
                viewModel.render(element);
            }
        }
    };

    function getParameterByName(name) {
        name = name.replace(/[\[]/, '\\\[').replace(/[\]]/, '\\\]');
        var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'), results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    // DOM Ready
    $(function() {

        // browser check
        if (head.browser.ie && head.browser.version <= 9) {
            alert('This browser not supported');
            return;
        }

        // i18next initialize
        $('html').i18n();

        // Show the loading indicator when we first load
        freeboardUI.showLoadingIndicator(true);

        $(window).resize(_.debounce(function() {
            freeboardUI.processResize(true);
        }, 500));
    });

    // PUBLIC FUNCTIONS
    return {
        initialize          : function(allowEdit, finishedCallback) {

            // Check to see if we have a query param called load. If so, we should load that dashboard initially
            var freeboardLocation = getParameterByName('load');

            theFreeboardModel.allow_edit(allowEdit);

            ko.applyBindings(theFreeboardModel);

            theFreeboardModel.setEditing(allowEdit);

            if (freeboardLocation !== '') {
                $.ajax({
                    url    : freeboardLocation,
                    success: function(data) {
                        theFreeboardModel.loadDashboard(data);

                        if (_.isFunction(finishedCallback))
                            finishedCallback();
                    }
                });
            } else {
                freeboardUI.showLoadingIndicator(false);
                if (_.isFunction(finishedCallback))
                    finishedCallback();

                freeboard.emit('initialized');
            }
        },

        newDashboard        : function() {
            theFreeboardModel.loadDashboard({allow_edit: true});
        },

        loadDashboard       : function(configuration, callback) {
            theFreeboardModel.loadDashboard(configuration, callback);
        },

        serialize           : function() {
            return theFreeboardModel.serialize();
        },

        setEditing          : function(editing, animate) {
            theFreeboardModel.setEditing(editing, animate);
        },

        isEditing           : function() {
            return theFreeboardModel.isEditing();
        },

        loadDatasourcePlugin: function(plugin) {
            if (_.isUndefined(plugin.display_name) || plugin.display_name === '')
                plugin.display_name = plugin.type_name;

            // Datasource name must be unique
            window.freeboard.isUniqueDatasourceName = function(field, rules, i, options) {
                var res = _.find(theFreeboardModel.datasources(), function(datasource) {
                    // except itself
                    if (datasource.isEditing() === false)
                        return datasource.name() == field.val();
                });
                if (!_.isUndefined(res))
                    return options.allrules.alreadyusedname.alertText;
            };

            // Add a required setting called name to the beginning
            plugin.settings.unshift({
                name: 'name',
                display_name: $.i18n.t('PluginEditor.datasource.given_name'),
                validate: 'funcCall[freeboard.isUniqueDatasourceName],required,custom[illegalEscapeChar],maxSize[20]',
                type: 'text',
                description: $.i18n.t('PluginEditor.datasource.given_name_desc')
            });

            theFreeboardModel.addPluginSource(plugin.source);
            datasourcePlugins[plugin.type_name] = plugin;
            theFreeboardModel._datasourceTypes.valueHasMutated();
        },

        resize : function() {
            freeboardUI.processResize(true);
        },

        loadWidgetPlugin    : function(plugin) {
            if(_.isUndefined(plugin.display_name))
                plugin.display_name = plugin.type_name;

            theFreeboardModel.addPluginSource(plugin.source);
            widgetPlugins[plugin.type_name] = plugin;
            theFreeboardModel._widgetTypes.valueHasMutated();
        },

        // To be used if freeboard is going to load dynamic assets from a different root URL
        setAssetRoot        : function(assetRoot) {
            jsEditor.setAssetRoot(assetRoot);
        },

        addStyle            : function(selector, rules) {
            var styleString = selector + '{' + rules + '}';

            var styleElement = $('style#fb-styles');

            if(styleElement.length === 0) {
                styleElement = $('<style id="fb-styles" type="text/css"></style>');
                $('head').append(styleElement);
            }

            if(styleElement[0].styleSheet)
                styleElement[0].styleSheet.cssText += styleString;
            else
                styleElement.text(styleElement.text() + styleString);
        },

        showLoadingIndicator: function(show) {
            freeboardUI.showLoadingIndicator(show);
        },

        showDialog          : function(contentElement, title, okTitle, cancelTitle, okCallback) {
            var db = new DialogBox(contentElement, title, okTitle, cancelTitle, okCallback);
        },

        getDatasourceSettings : function(datasourceName) {
            var datasources = theFreeboardModel.datasources();

            // Find the datasource with the name specified
            var datasource = _.find(datasources, function(datasourceModel) {
                return (datasourceModel.name() === datasourceName);
            });

            if(datasource)
                return datasource.settings();
            else
                return null;
        },

        setDatasourceSettings : function(datasourceName, settings) {
            var datasources = theFreeboardModel.datasources();

            // Find the datasource with the name specified
            var datasource = _.find(datasources, function(datasourceModel){
                return (datasourceModel.name() === datasourceName);
            });

            if (!datasource) {
                console.log('Datasource not found');
                return;
            }

            var combinedSettings = _.defaults(settings, datasource.settings());
            datasource.settings(combinedSettings);
        },

        getStyleString      : function(name) {
            var returnString = '';

            _.each(currentStyle[name], function(value, name) {
                returnString = returnString + name + ':' + value + ';';
            });

            return returnString;
        },

        getStyleObject      : function(name) {
            return currentStyle[name];
        },

        showDeveloperConsole : function() {
            developerConsole.showDeveloperConsole();
        }
    };
}());

$.extend(freeboard, jQuery.eventEmitter);
