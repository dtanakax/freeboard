// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

DatasourceModel = function(theFreeboardModel, datasourcePlugins) {
    'use strict';

    var self = this;

    function disposeDatasourceInstance()
    {
        if(!_.isUndefined(self.datasourceInstance))
        {
            if(_.isFunction(self.datasourceInstance.onDispose))
            {
                self.datasourceInstance.onDispose();
            }

            self.datasourceInstance = undefined;
        }
    }

    this.isEditing = ko.observable(false); // editing by PluginEditor
    this.name = ko.observable();
    this.latestData = ko.observable();
    this.settings = ko.observable({});
    this.settings.subscribe(function(newValue) {
        if(!_.isUndefined(self.datasourceInstance) && _.isFunction(self.datasourceInstance.onSettingsChanged))
        {
            self.datasourceInstance.onSettingsChanged(newValue);
        }
    });

    this.updateCallback = function(newData) {
        theFreeboardModel.processDatasourceUpdate(self, newData);

        self.latestData(newData);

        self.last_updated(moment().format('HH:mm:ss'));
    };

    this.type = ko.observable();
    this.type.subscribe(function(newValue)
    {
        disposeDatasourceInstance();

        if((newValue in datasourcePlugins) && _.isFunction(datasourcePlugins[newValue].newInstance))
        {
            var datasourceType = datasourcePlugins[newValue];

            var finishLoad = function() {
                datasourceType.newInstance(self.settings(), function(datasourceInstance)
                {

                    self.datasourceInstance = datasourceInstance;
                    datasourceInstance.updateNow();

                }, self.updateCallback);
            };

            // Do we need to load any external scripts?
            if(datasourceType.external_scripts)
                head.js(datasourceType.external_scripts.slice(0), finishLoad); // Need to clone the array because head.js adds some weird functions to it
            else
                finishLoad();
        }
    });

    this.last_updated = ko.observable('never');
    this.last_error = ko.observable();

    this.serialize = function()
    {
        return {
            name    : self.name(),
            type    : self.type(),
            settings: self.settings()
        };
    };

    this.deserialize = function(object)
    {
        self.settings(object.settings);
        self.name(object.name);
        self.type(object.type);
    };

    this.getDataRepresentation = function(dataPath)
    {
        var valueFunction = new Function('data', 'return ' + dataPath + ';');
        return valueFunction.call(undefined, self.latestData());
    };

    this.updateNow = function()
    {
        if(!_.isUndefined(self.datasourceInstance) && _.isFunction(self.datasourceInstance.updateNow))
        {
            self.datasourceInstance.updateNow();
        }
    };

    this.dispose = function()
    {
        disposeDatasourceInstance();
    };
};

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

DeveloperConsole = function(theFreeboardModel) {
    'use strict';

    function showDeveloperConsole()
    {
        var pluginScriptsInputs = [];
        var container = $('<div></div>');
        var addScript = $('<div class="table-operation text-button">ADD</div>');
        var table = $('<table class="table table-condensed sub-table"></table>');

        table.append($('<thead style=""><tr><th>Plugin Script URL</th></tr></thead>'));

        var tableBody = $("<tbody></tbody>");

        table.append(tableBody);

        container.append($("<p>Here you can add references to other scripts to load datasource or widget plugins.</p>"))
            .append(table)
            .append(addScript)
            .append('<p>To learn how to build plugins for freeboard, please visit <a target="_blank" href="http://freeboard.github.io/freeboard/docs/plugin_example.html">http://freeboard.github.io/freeboard/docs/plugin_example.html</a></p>');

        function refreshScript(scriptURL)
        {
            $('script[src="' + scriptURL + '"]').remove();
        }

        function addNewScriptRow(scriptURL)
        {
            var tableRow = $('<tr></tr>');
            var tableOperations = $('<ul class="board-toolbar"></ul>');
            var scriptInput = $('<input class="table-row-value" style="width:100%;" type="text">');
            var deleteOperation = $('<li><i class="fa-w fa-trash"></i></li>').click(function(e){
                pluginScriptsInputs = _.without(pluginScriptsInputs, scriptInput);
                tableRow.remove();
            });

            pluginScriptsInputs.push(scriptInput);

            if(scriptURL)
            {
                scriptInput.val(scriptURL);
            }

            tableOperations.append(deleteOperation);
            tableBody
                .append(tableRow
                .append($('<td></td>').append(scriptInput))
                .append($('<td class="table-row-operation">').append(tableOperations)));
        }

        _.each(theFreeboardModel.plugins(), function(pluginSource){

            addNewScriptRow(pluginSource);

        });

        addScript.click(function(e)
        {
            addNewScriptRow();
        });

        var db = new DialogBox(container, 'Developer Console', 'OK', null, function(okcancel){
            if (okcancel === 'ok') {
                // Unload our previous scripts
                _.each(theFreeboardModel.plugins(), function(pluginSource){

                    $('script[src^="' + pluginSource + '"]').remove();

                });

                theFreeboardModel.plugins.removeAll();

                _.each(pluginScriptsInputs, function(scriptInput){

                    var scriptURL = scriptInput.val();

                    if(scriptURL && scriptURL.length > 0)
                    {
                        theFreeboardModel.addPluginSource(scriptURL);

                        // Load the script with a cache buster
                        head.js(scriptURL + '?' + Date.now());
                    }
                });
            }
        });
    }

    // Public API
    return {
        showDeveloperConsole : function()
        {
            showDeveloperConsole();
        }
    };
};

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

function DialogBox(contentElement, title, okTitle, cancelTitle, closeCallback) {
    'use strict';

    var modal_width = 900;

    // Initialize our modal overlay
    var overlay = $('<div id="modal_overlay"></div>');

    var modalDialog = $('<div class="modal"></div>');

    function closeModal()
    {
        if (head.browser.ie) {
            overlay.remove();
        } else {
            overlay.removeClass('show').addClass('hide');
            _.delay(function() {
                overlay.remove();
            }, 300);
        }
    }

    // Create our header
    modalDialog.append('<header><h2 class="title">' + title + "</h2></header>");

    $('<section></section>').appendTo(modalDialog).append(contentElement);

    // Create our footer
    var footer = $('<footer></footer>').appendTo(modalDialog);

    if(okTitle)
    {
        $('<span id="dialog-ok" class="text-button">' + okTitle + '</span>').appendTo(footer).click(function()
        {
            var hold = false;

            if (!$('#plugin-editor').validationEngine('validate'))
                return false;

            if(_.isFunction(closeCallback))
                hold = closeCallback('ok');

            if(!hold)
                closeModal();
        });
    }

    if(cancelTitle)
    {
        $('<span id="dialog-cancel" class="text-button">' + cancelTitle + '</span>').appendTo(footer).click(function()
        {
            closeCallback('cancel');
            closeModal();
        });
    }

    overlay.append(modalDialog);
    $('body').append(overlay);
    if (!head.browser.ie)
        overlay.removeClass('hide').addClass('show');

    // ValidationEngine initialize
    $.validationEngine.defaults.autoPositionUpdate = true;
    // media query max-width : 960px
    $.validationEngine.defaults.promptPosition = ($('#hamburger').css('display') == 'none') ? 'topRight' : 'topLeft';
    $('#plugin-editor').validationEngine();
}

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

function FreeboardModel(datasourcePlugins, widgetPlugins, freeboardUI)
{
    var self = this;

    var SERIALIZATION_VERSION = 1;

    this.version = 0;
    this.isEditing = ko.observable(false);
    this.allow_edit = ko.observable(false);
    this.allow_edit.subscribe(function(newValue) {
        if (newValue) {
            $('#main-header').show();
        } else {
            $('#main-header').hide();
            $('#datasources').hide();
        }
    });

    this.isVisibleDatasources = ko.observable(false);
    this.isVisibleBoardTools = ko.observable(false);

    this.header_image = ko.observable();
    this.plugins = ko.observableArray();
    this.datasources = ko.observableArray();
    this.panes = ko.observableArray();
    this.datasourceData = {};
    this.processDatasourceUpdate = function(datasourceModel, newData) {
        var datasourceName = datasourceModel.name();

        self.datasourceData[datasourceName] = newData;

        _.each(self.panes(), function(pane) {
            _.each(pane.widgets(), function(widget) {
                widget.processDatasourceUpdate(datasourceName);
            });
        });
    };

    this._datasourceTypes = ko.observable();
    this.datasourceTypes = ko.computed({
        read: function() {
            self._datasourceTypes();

            var returnTypes = [];

            _.each(datasourcePlugins, function(datasourcePluginType) {
                var typeName = datasourcePluginType.type_name;
                var displayName = typeName;

                if (!_.isUndefined(datasourcePluginType.display_name))
                    displayName = datasourcePluginType.display_name;

                returnTypes.push({
                    name        : typeName,
                    display_name: displayName
                });
            });

            return returnTypes;
        }
    });

    this._widgetTypes = ko.observable();
    this.widgetTypes = ko.computed({
        read: function() {
            self._widgetTypes();

            var returnTypes = [];

            _.each(widgetPlugins, function(widgetPluginType) {
                var typeName = widgetPluginType.type_name;
                var displayName = typeName;

                if(!_.isUndefined(widgetPluginType.display_name))
                    displayName = widgetPluginType.display_name;

                returnTypes.push({
                    name        : typeName,
                    display_name: displayName
                });
            });

            return returnTypes;
        }
    });

    this.addPluginSource = function(pluginSource) {
        if (pluginSource && self.plugins.indexOf(pluginSource) === -1)
            self.plugins.push(pluginSource);
    };

    this.serialize = function() {
        var panes = [];

        _.each(self.panes(), function(pane) {
            panes.push(pane.serialize());
        });

        var datasources = [];

        _.each(self.datasources(), function(datasource) {
            datasources.push(datasource.serialize());
        });

        return {
            version     : SERIALIZATION_VERSION,
            header_image: self.header_image(),
            allow_edit  : self.allow_edit(),
            plugins     : self.plugins(),
            panes       : panes,
            datasources : datasources,
            columns     : freeboardUI.getUserColumns()
        };
    };

    this.deserialize = function(object, finishedCallback) {
        self.clearDashboard();

        function finishLoad() {
            freeboardUI.setUserColumns(object.columns);

            if (!_.isUndefined(object.allow_edit))
                self.allow_edit(object.allow_edit);
            else
                self.allow_edit(true);

            self.version = object.version || 0;
            self.header_image(object.header_image);

            _.each(object.datasources, function(datasourceConfig) {
                var datasource = new DatasourceModel(self, datasourcePlugins);
                datasource.deserialize(datasourceConfig);
                self.addDatasource(datasource);
            });

            var sortedPanes = _.sortBy(object.panes, function(pane) {
                return freeboardUI.getPositionForScreenSize(pane).row;
            });

            _.each(sortedPanes, function(paneConfig) {
                var pane = new PaneModel(self, widgetPlugins);
                pane.deserialize(paneConfig);
                self.panes.push(pane);
            });

            if (self.allow_edit() && self.panes().length === 0 && self.datasources().length === 0)
                self.setEditing(true);

            if (_.isFunction(finishedCallback))
                finishedCallback();

            freeboardUI.processResize(true, true);
        }

        // This could have been self.plugins(object.plugins), but for some weird reason head.js was causing a function to be added to the list of plugins.
        _.each(object.plugins, function(plugin) {
            self.addPluginSource(plugin);
        });

        // Load any plugins referenced in this definition
        if (_.isArray(object.plugins) && object.plugins.length > 0) {
            head.js(object.plugins, function() {
                finishLoad();
            });
        } else {
            finishLoad();
        }
    };

    this.clearDashboard = function() {
        freeboardUI.removeAllPanes();

        _.each(self.datasources(), function(datasource) {
            datasource.dispose();
        });

        _.each(self.panes(), function(pane) {
            pane.dispose();
        });

        self.plugins.removeAll();
        self.datasources.removeAll();
        self.panes.removeAll();
    };

    this.loadDashboard = function(dashboardData, callback) {
        freeboardUI.showLoadingIndicator(true);
        _.delay(function() {
            self.deserialize(dashboardData, function() {
                if(_.isFunction(callback))
                    callback();

                freeboardUI.showLoadingIndicator(false);

                freeboard.emit('dashboard_loaded');
            });
        }, 50);
    };

    this.loadDashboardFromLocalFile = function() {
        // Check for the various File API support.
        if(window.File && window.FileReader && window.FileList && window.Blob) {
            var input = document.createElement('input');
            input.id = 'myfile';
            input.type = 'file';
            $(input).css({
                'visibility':'hidden'
            });

            $(input).on('change', function(event) {
                var files = event.target.files;

                if(files && files.length > 0) {
                    var file = files[0];
                    var reader = new FileReader();

                    reader.addEventListener('load', function(fileReaderEvent) {

                        var textFile = fileReaderEvent.target;
                        var jsonObject = JSON.parse(textFile.result);


                        self.loadDashboard(jsonObject);
                        self.setEditing(false);
                    });

                    reader.readAsText(file);
                }
                if (head.browser.ie)
                    $('#myfile').remove();
            });

            if (head.browser.ie) {
                document.body.appendChild(input);
                var evt = document.createEvent('MouseEvents');
                evt.initEvent('click',true,true,window,0,0,0,0,0,false,false,false,false,0,null);
                input.dispatchEvent(evt);
            } else {
                $(input).trigger('click');
            }
        } else {
            alert('Unable to load a file in this browser.');
        }
    };

    this.saveDashboard = function() {
        var contentType = 'application/octet-stream';
        var blob = new Blob([JSON.stringify(self.serialize())], {'type': contentType});
        var file = 'dashboard.json';

        if (head.browser.ie) {
            window.navigator.msSaveBlob(blob, file);
        } else {
            var url = (window.URL || window.webkitURL);
            var data = url.createObjectURL(blob);
            var e = document.createEvent('MouseEvents');
            e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            var a = document.createElementNS('http://www.w3.org/1999/xhtml', 'a');
            a.href = data;
            a.download = file;
            a.dispatchEvent(e);
        }
    };

    this.addDatasource = function(datasource) {
        self.datasources.push(datasource);
    };

    this.deleteDatasource = function(datasource) {
        delete self.datasourceData[datasource.name()];
        datasource.dispose();
        self.datasources.remove(datasource);
    };

    this.createPane = function() {
        var newPane = new PaneModel(self, widgetPlugins);
        self.addPane(newPane);
    };

    this.addGridColumnLeft = function() {
        freeboardUI.addGridColumnLeft();
    };

    this.addGridColumnRight = function() {
        freeboardUI.addGridColumnRight();
    };

    this.subGridColumnLeft = function() {
        freeboardUI.subGridColumnLeft();
    };

    this.subGridColumnRight = function() {
        freeboardUI.subGridColumnRight();
    };

    this.addPane = function(pane) {
        self.panes.push(pane);
    };

    this.deletePane = function(pane) {
        pane.dispose();
        self.panes.remove(pane);
    };

    this.deleteWidget = function(widget) {
        ko.utils.arrayForEach(self.panes(), function(pane) {
            pane.widgets.remove(widget);
        });

        widget.dispose();
    };

    this.updateDatasourceNameRef = function(newDatasourceName, oldDatasourceName) {
        _.each(self.panes(), function(pane) {
            _.each(pane.widgets(), function(widget) {
                widget.updateDatasourceNameRef(newDatasourceName, oldDatasourceName);
            });
        });
    };

    $.fn.transform = function(axis) {
        var ret = 0;
        var elem = this;
        var matrix = elem.css('transform').replace(/[^0-9\-.,]/g, '').split(',');
        if (axis == 'y')
            ret = matrix[13] || matrix[5];
        else if (axis == 'x')
            ret = matrix[12] || matrix[4];
        if (_.isUndefined(ret))
            ret = 0;
        return ret;
    };

    this.setEditing = function(editing, animate) {
        // Don't allow editing if it's not allowed
        if (!self.allow_edit() && editing)
            return;

        self.isEditing(editing);

        if (editing === false) {
            if (self.isVisibleDatasources())
                self.setVisibilityDatasources(false);
            if (self.isVisibleBoardTools())
                self.setVisibilityBoardTools(false);
        }

        var barHeight = $('#admin-bar').outerHeight();
        var headerHeight = $('#main-header').outerHeight();

        if (!editing) {
            freeboardUI.disableGrid();
            $('#toggle-header-icon').addClass('fa-wrench').removeClass('fa-chevron-up');
            $('.gridster .gs_w').css({cursor: 'default'});

            if (head.browser.ie) {
                $('#main-header').css('top', '-' + barHeight + 'px');
                $('#board-content').css('top', '20px');
            } else {
                $('#main-header').css('transform', 'translateY(-' + barHeight + 'px)');
                $('#board-content').css('transform', 'translateY(20px)');
                _.delay(function() {
                    $('#admin-menu').css('display', 'none');
                }, 200);
            }
            $('.sub-section').unbind();
        } else {
            $('#admin-menu').css('display', 'block');
            $('#toggle-header-icon').addClass('fa-chevron-up').removeClass('fa-wrench');
            $('.gridster .gs_w').css({cursor: 'pointer'});

            if (head.browser.ie) {
                $('#main-header').css('top', '0px');
                $('#board-content').css('top', headerHeight + 'px');
            } else {
                $('#main-header').css('transform', 'translateY(0px)');
                $('#board-content').css('transform', 'translateY(' + headerHeight + 'px)');
            }
            freeboardUI.attachWidgetEditIcons($('.sub-section'));
            freeboardUI.enableGrid();
        }

        freeboardUI.showPaneEditIcons(editing, true);
    };

    this.setVisibilityDatasources = function(visibility, animate) {
        // Don't allow editing if it's not allowed
        if(!self.allow_edit())
            return;

        self.isVisibleDatasources(visibility);

        var ds = $('#datasources');
        var width = ds.outerWidth();

        if (visibility === true) {
            ds.css('display', 'block');
            ds.css('transform', 'translateX(-' + width + 'px)');
        } else {
            ds.css('transform', 'translateX(' + width + 'px)');
            _.delay(function() {
                ds.css('display', 'none');
            }, 300);
        }
    };

    this.setVisibilityBoardTools = function(visibility, animate) {
        // Don't allow editing if it's not allowed
        if (!self.allow_edit())
            return;

        self.isVisibleBoardTools(visibility);

        var mh = $('#main-header');
        var bc = $('#board-content');
        var bt = $('#board-tools');

        var mhHeight = mh.outerHeight();
        var width = bt.outerWidth();

        var debounce = _.debounce(function() {
            // media query max-width : 960px
            if ($('#hamburger').css('display') == 'none') {
                self.setVisibilityBoardTools(false);
                $(window).off('resize', debounce);
            }
        }, 500);

        if (visibility === true) {
            $('html').addClass('boardtools-opening');
            $('#board-actions > ul').removeClass('collapse');

            if (head.browser.ie) {
                mh.offset({ top: 0, left: width });
                bc.offset({ top: mhHeight, left: width });
            } else {
                mh.css('transform', 'translate(' + width + 'px, ' + mh.transform('y') + 'px)');
                bc.css('transform', 'translate(' + width + 'px, ' + bc.transform('y') + 'px)');
            }

            $(window).resize(debounce);
        } else {
            $('html').removeClass('boardtools-opening');
            $('#board-actions > ul').addClass('collapse');

            if (head.browser.ie) {
                mh.offset({ top: 0, left: 0 });
                bc.offset({ top: mhHeight, left: 0 });
            } else {
                mh.css('transform', 'translate(0px, ' + mh.transform('y') + 'px)');
                bc.css('transform', 'translate(0px, ' + bc.transform('y') + 'px)');
            }

            $(window).off('resize', debounce);
        }
    };

    this.toggleEditing = function() {
        self.setEditing(!self.isEditing());
    };

    this.toggleDatasources = function() {
        self.setVisibilityDatasources(!self.isVisibleDatasources());
    };

    this.toggleBoardTools = function() {
        self.setVisibilityBoardTools(!self.isVisibleBoardTools());
    };
}

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

function FreeboardUI() {

    var PANE_MARGIN = 10;
    var PANE_WIDTH = 300;
    var MIN_COLUMNS = 3;
    var COLUMN_WIDTH = PANE_MARGIN + PANE_WIDTH + PANE_MARGIN;

    var userColumns = MIN_COLUMNS;

    var loadingIndicator = $('<div class="wrapperloading"><div class="loading up" ></div><div class="loading down"></div></div>');
    var grid;

    function processResize(layoutWidgets, loading) {
        var maxDisplayableColumns = getMaxDisplayableColumnCount();
        var repositionFunction = function(){};

        if (layoutWidgets) {
            repositionFunction = function(index) {
                var paneElement = this;
                var paneModel = ko.dataFor(paneElement);

                var newPosition = getPositionForScreenSize(paneModel);
                $(paneElement).attr('data-sizex', Math.min(paneModel.col_width(),
                    maxDisplayableColumns, grid.cols))
                    .attr('data-row', newPosition.row)
                    .attr('data-col', newPosition.col);

                if (loading === true) {
                    // Give the animation a moment to complete. Really hacky.
                    var resize = _.debounce(function() {
                        paneModel.processSizeChange();
                    }, 500);
                    resize();
                } else {
                    paneModel.processSizeChange();
                }
            };
        }

        updateGridWidth(Math.min(maxDisplayableColumns, userColumns));

        repositionGrid(repositionFunction);
        updateGridColumnControls();
    }

    function addGridColumn(shift) {
        var num_cols = grid.cols + 1;
        if (updateGridWidth(num_cols)) {
            repositionGrid(function() {
                var paneElement = this;
                var paneModel = ko.dataFor(paneElement);

                var prevColumnIndex = grid.cols > 1 ? grid.cols - 1 : 1;
                var prevCol = paneModel.col[prevColumnIndex];
                var prevRow = paneModel.row[prevColumnIndex];
                var newPosition;
                if (shift) {
                    leftPreviewCol = true;
                    var newCol = prevCol < grid.cols ? prevCol + 1 : grid.cols;
                    newPosition = {row: prevRow, col: newCol};
                } else {
                    rightPreviewCol = true;
                    newPosition = {row: prevRow, col: prevCol};
                }
                $(paneElement).attr('data-sizex', Math.min(paneModel.col_width(), grid.cols))
                    .attr('data-row', newPosition.row)
                    .attr('data-col', newPosition.col);
            });
        }
        updateGridColumnControls();
        userColumns = grid.cols;
    }

    function subtractGridColumn(shift) {
        var num_cols = grid.cols - 1;
        if (updateGridWidth(num_cols)) {
            repositionGrid(function() {
                var paneElement = this;
                var paneModel = ko.dataFor(paneElement);

                var prevColumnIndex = grid.cols + 1;
                var prevCol = paneModel.col[prevColumnIndex];
                var prevRow = paneModel.row[prevColumnIndex];
                var newPosition, newCol;
                if (shift) {
                    newCol = prevCol > 1 ? prevCol - 1 : 1;
                    newPosition = {row: prevRow, col: newCol};
                } else {
                    newCol = prevCol <= grid.cols ? prevCol : grid.cols;
                    newPosition = {row: prevRow, col: newCol};
                }
                $(paneElement).attr('data-sizex', Math.min(paneModel.col_width(), grid.cols))
                    .attr('data-row', newPosition.row)
                    .attr('data-col', newPosition.col);
            });
        }
        updateGridColumnControls();
        userColumns = grid.cols;
    }

    function updateGridColumnControls() {
        var col_controls = $('.column-tool');
        var available_width = $('#board-content').width();
        var max_columns = Math.floor(available_width / COLUMN_WIDTH);

        if (grid.cols <= MIN_COLUMNS)
            col_controls.addClass('min');
        else
            col_controls.removeClass('min');

        if (grid.cols >= max_columns)
            col_controls.addClass('max');
        else
            col_controls.removeClass('max');
    }

    function getMaxDisplayableColumnCount() {
        var available_width = $('#board-content').width();
        return Math.floor(available_width / COLUMN_WIDTH);
    }

    function updateGridWidth(newCols) {
        if (newCols === undefined || newCols < MIN_COLUMNS)
            newCols = MIN_COLUMNS;

        var max_columns = getMaxDisplayableColumnCount();
        if (newCols > max_columns)
            newCols = max_columns;

        // +newCols to account for scaling on zoomed browsers
        var new_width = (COLUMN_WIDTH * newCols) + newCols;
        $('.responsive-column-width').css('max-width', new_width);

        return (newCols !== grid.cols);
    }

    function repositionGrid(repositionFunction) {
        var rootElement = grid.$el;

        rootElement.find('> li').unbind().removeData();
        $('.responsive-column-width').css('width', '');
        grid.generate_grid_and_stylesheet();

        rootElement.find('> li').each(repositionFunction);

        grid.init();
        $('.responsive-column-width').css('width', grid.cols * PANE_WIDTH + (grid.cols * PANE_MARGIN * 2));
    }

    function getUserColumns() {
        return userColumns;
    }

    function setUserColumns(numCols) {
        userColumns = Math.max(MIN_COLUMNS, numCols);
    }

    ko.bindingHandlers.grid = {
        init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            // Initialize our grid
            grid = $(element).gridster({
                widget_margins        : [PANE_MARGIN, PANE_MARGIN],
                widget_base_dimensions: [PANE_WIDTH, 10],
                resize: {
                    enabled : false,
                    axes : 'x'
                }
            }).data('gridster');

            processResize(false);

            grid.disable();
        }
    };

    function addPane(element, viewModel, isEditing) {
        var position = getPositionForScreenSize(viewModel);
        var col = position.col;
        var row = position.row;
        var width = Number(viewModel.width());
        var height = Number(viewModel.getCalculatedHeight());

        grid.add_widget(element, width, height, col, row);

        if (isEditing)
            showPaneEditIcons(true);

        updatePositionForScreenSize(viewModel, row, col);

        $(element).attrchange({
            trackValues: true,
            callback   : function(event) {
                if (event.attributeName === 'data-row')
                    updatePositionForScreenSize(viewModel, Number(event.newValue), undefined);
                else if (event.attributeName ===  'data-col')
                    updatePositionForScreenSize(viewModel, undefined, Number(event.newValue));
            }
        });
    }

    function updatePane(element, viewModel) {
        // If widget has been added or removed
        var calculatedHeight = viewModel.getCalculatedHeight();

        var elementHeight = Number($(element).attr('data-sizey'));
        var elementWidth = Number($(element).attr('data-sizex'));

        if (calculatedHeight != elementHeight || viewModel.col_width() !=  elementWidth) {
            grid.resize_widget($(element), viewModel.col_width(), calculatedHeight, function(){
                grid.set_dom_grid_height();
            });
        }
    }

    function updatePositionForScreenSize(paneModel, row, col) {
        var displayCols = grid.cols;

        if (!_.isUndefined(row)) paneModel.row[displayCols] = row;
        if (!_.isUndefined(col)) paneModel.col[displayCols] = col;
    }

    function showLoadingIndicator(show) {
        if (show === true)
            loadingIndicator.removeClass('hide').appendTo('body').addClass('show');
        else {
            _.delay(function() {
                loadingIndicator.removeClass('show').addClass('hide');
                _.delay(function() {
                    loadingIndicator.remove();
                }, 500);
            }, 500);
        }
    }

    function showPaneEditIcons(show, animate) {
        if (_.isUndefined(animate))
            animate = true;

        if (show) {
            if (animate) {
                $('.pane-tools').css('display', 'block').removeClass('hide').addClass('show');
                $('#column-tools').css('display', 'block').removeClass('hide').addClass('show');
            } else {
                $('.pane-tools').css('display', 'block');
                $('#column-tools').css('display', 'block');
            }
        } else {
            if (animate) {
                $('.pane-tools').removeClass('show').addClass('hide');
                $('#column-tools').removeClass('show').addClass('hide');
                _.delay(function() {
                    $('.pane-tools').css('display', 'none');
                    $('#column-tools').css('display', 'none');
                }, 200);
            } else {
                $('.pane-tools').css('display', 'none');
                $('#column-tools').css('display', 'none');
            }
        }
    }

    function attachWidgetEditIcons(element) {
        $(element).hover(function() {
            showWidgetEditIcons(this, true);
        }, function(){
            showWidgetEditIcons(this, false);
        });
    }

    function showWidgetEditIcons(element, show) {
        var tool = $(element).find('.sub-section-tools');
        if (show)
            tool.css('display', 'block').removeClass('hide').addClass('show');
        else {
            tool.removeClass('show').addClass('hide');
        }
    }

    function getPositionForScreenSize(paneModel) {
        var cols = Number(grid.cols);

        if (_.isNumber(paneModel.row) && _.isNumber(paneModel.col)) { // Support for legacy format
            var obj = {};
            obj[cols] = paneModel.row;
            paneModel.row = obj;

            obj = {};
            obj[cols] = paneModel.col;
            paneModel.col = obj;
        }

        var newColumnIndex = 1;
        var columnDiff = 1000;

        for(var columnIndex in paneModel.col) {
            if (Number(columnIndex) === cols) // If we already have a position defined for this number of columns, return that position
                return {row: paneModel.row[columnIndex], col: paneModel.col[columnIndex]};
            else if (paneModel.col[columnIndex] > cols) // If it's greater than our display columns, put it in the last column
                newColumnIndex = cols;
            else { // If it's less than, pick whichever one is closest
                var delta = cols - columnIndex;

                if(delta < columnDiff) {
                    newColumnIndex = columnIndex;
                    columnDiff = delta;
                }
            }
        }

        if (newColumnIndex in paneModel.col && newColumnIndex in paneModel.row)
            return {row: paneModel.row[newColumnIndex], col: paneModel.col[newColumnIndex]};

        return {row:1,col:newColumnIndex};
    }


    // Public Functions
    return {
        showLoadingIndicator : function(show) {
            showLoadingIndicator(show);
        },

        showPaneEditIcons : function(show, animate) {
            showPaneEditIcons(show, animate);
        },

        attachWidgetEditIcons : function(element) {
            attachWidgetEditIcons(element);
        },

        getPositionForScreenSize : function(paneModel) {
            return getPositionForScreenSize(paneModel);
        },

        processResize : function(layoutWidgets, loading) {
            processResize(layoutWidgets, loading);
        },

        disableGrid : function() {
            grid.disable();
        },

        enableGrid : function() {
            grid.enable();
        },

        addPane : function(element, viewModel, isEditing) {
            addPane(element, viewModel, isEditing);
        },

        updatePane : function(element, viewModel) {
            updatePane(element, viewModel);
        },

        removePane : function(element) {
            grid.remove_widget(element);
        },

        removeAllPanes : function() {
            grid.remove_all_widgets();
        },

        addGridColumnLeft : function() {
            addGridColumn(true);
        },

        addGridColumnRight : function() {
            addGridColumn(false);
        },

        subGridColumnLeft : function() {
            subtractGridColumn(true);
        },

        subGridColumnRight : function() {
            subtractGridColumn(false);
        },

        getUserColumns : function() {
            return getUserColumns();
        },

        setUserColumns : function(numCols) {
            setUserColumns(numCols);
        }
    };
}

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

JSEditor = function() {
    'use strict';

    var assetRoot = '';

    function setAssetRoot(_assetRoot) {
        assetRoot = _assetRoot;
    }

    function displayJSEditor(value, mode, callback) {

        var exampleText;
        var codeWindow = $('<div class="code-window"></div>');
        var codeMirrorWrapper = $('<div class="code-mirror-wrapper"></div>');
        var codeWindowFooter = $('<div class="code-window-footer"></div>');
        var codeWindowHeader = $('<div class="code-window-header cm-s-ambiance"></div>');
        var config = {};

        switch (mode) {
            case 'javascript':
                exampleText = $.i18n.t('JSEditor.javascript.exampleText');
                codeWindowHeader = $('<div class="code-window-header cm-s-ambiance">' + $.i18n.t('JSEditor.javascript.codeWindowHeader') + '</div>');

                // If value is empty, go ahead and suggest something
                if (!value)
                    value = exampleText;

                config = {
                    value: value,
                    mode: 'javascript',
                    theme: 'ambiance',
                    indentUnit: 4,
                    lineNumbers: true,
                    matchBrackets: true,
                    autoCloseBrackets: true,
                    gutters: ['CodeMirror-lint-markers'],
                    lint: true
                };
                break;
            case 'json':
                exampleText = $.i18n.t('JSEditor.json.exampleText');
                codeWindowHeader = $('<div class="code-window-header cm-s-ambiance">' + $.i18n.t('JSEditor.json.codeWindowHeader') + '</div>');

                config = {
                    value: value,
                    mode: 'application/json',
                    theme: 'ambiance',
                    indentUnit: 4,
                    lineNumbers: true,
                    matchBrackets: true,
                    autoCloseBrackets: true,
                    gutters: ['CodeMirror-lint-markers'],
                    lint: true
                };
                break;
            case 'htmlmixed':
                exampleText = '';
                codeWindowHeader = $('<div class="code-window-header cm-s-ambiance">' + $.i18n.t('JSEditor.htmlmixed.codeWindowHeader') + '</div>');

                config = {
                    value: value,
                    mode: 'htmlmixed',
                    theme: 'ambiance',
                    indentUnit: 4,
                    lineNumbers: true,
                    matchBrackets: true,
                    autoCloseBrackets: true
                };
                break;
        }

        codeWindow.append([codeWindowHeader, codeMirrorWrapper, codeWindowFooter]);

        $('body').append(codeWindow);

        var codeMirrorEditor = CodeMirror(codeMirrorWrapper.get(0), config);

        var closeButton = $('<span id="dialog-cancel" class="text-button">' + $.i18n.t('JSEditor.cancel') + '</span>').click(function () {
            if (callback) {
                var newValue = codeMirrorEditor.getValue();

                if (newValue === exampleText)
                    newValue = '';

                var error = null;
                switch (mode) {
                    case 'json':
                        if (JSHINT.errors.length > 0) {
                            alert($.i18n.t('JSEditor.json.error'));
                            return;
                        }
                        break;
                }
                callback(newValue);
                codeWindow.remove();
            }
        });

        codeWindowFooter.append(closeButton);
    }

    // Public API
    return {
        displayJSEditor: function (value, mode, callback) {
            displayJSEditor(value, mode, callback);
        },
        setAssetRoot: function (assetRoot) {
            setAssetRoot(assetRoot);
        }
    };
};
// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

function PaneModel(theFreeboardModel, widgetPlugins) {
    'use strict';

    var self = this;

    this.title = ko.observable();
    this.width = ko.observable(1);
    this.row = {};
    this.col = {};

    this.col_width = ko.observable(1);
    this.col_width.subscribe(function(newValue) {
        self.processSizeChange();
    });

    this.widgets = ko.observableArray();

    this.addWidget = function (widget) {
        this.widgets.push(widget);
    };

    this.widgetCanMoveUp = function (widget) {
        return (self.widgets.indexOf(widget) >= 1);
    };

    this.widgetCanMoveDown = function (widget) {
        var i = self.widgets.indexOf(widget);
        return (i < self.widgets().length - 1);
    };

    this.moveWidgetUp = function (widget) {
        if (self.widgetCanMoveUp(widget)) {
            var i = self.widgets.indexOf(widget);
            var array = self.widgets();
            self.widgets.splice(i - 1, 2, array[i], array[i - 1]);
        }
    };

    this.moveWidgetDown = function (widget) {
        if (self.widgetCanMoveDown(widget)) {
            var i = self.widgets.indexOf(widget);
            var array = self.widgets();
            self.widgets.splice(i, 2, array[i + 1], array[i]);
        }
    };

    this.processSizeChange = function() {
        // Give the animation a moment to complete. Really hacky.
        // TODO: Make less hacky. Also, doesn't work when screen resizes.
        var resize = _.debounce(function() {
                _.each(self.widgets(), function (widget) {
                    widget.processSizeChange();
                });
            }, 500);
        resize();
    };

    this.getCalculatedHeight = function () {
        var memo = 0;
        var sumHeights = _.reduce(self.widgets(), function (memo, widget) {
            return memo + widget.height();
        }, 0);

        sumHeights *= 6;
        sumHeights += 3;

        sumHeights *= 10;

        var rows = Math.ceil((sumHeights + 20) / 30);

        return Math.max(4, rows);
    };

    this.serialize = function () {
        var widgets = [];

        _.each(self.widgets(), function (widget) {
            widgets.push(widget.serialize());
        });

        return {
            title: self.title(),
            width: self.width(),
            row: self.row,
            col: self.col,
            col_width: self.col_width(),
            widgets: widgets
        };
    };

    this.deserialize = function (object) {
        self.title(object.title);
        self.width(object.width);

        self.row = object.row;
        self.col = object.col;
        self.col_width(object.col_width || 1);

        _.each(object.widgets, function (widgetConfig) {
            var widget = new WidgetModel(theFreeboardModel, widgetPlugins);
            widget.deserialize(widgetConfig);
            self.widgets.push(widget);
        });
    };

    this.dispose = function () {
        _.each(self.widgets(), function (widget) {
            widget.dispose();
        });
    };
}

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

PluginEditor = function(jsEditor, valueEditor) {
    'use strict';

    function _removeSettingsRows() {
        if ($('#setting-row-instance-name').length)
            $('#setting-row-instance-name').nextAll().remove();
        else
            $('#setting-row-plugin-types').nextAll().remove();
    }

    function _toValidateClassString(validate, type) {
        var ret = '';
        if (!_.isUndefined(validate)) {
            var types = '';
            if (!_.isUndefined(type))
                types = ' ' + type;
            ret = 'validate[' + validate + ']' + types;
        }
        return ret;
    }

    function _isNumerical(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }

    function _appendCalculatedSettingRow(valueCell, newSettings, settingDef, currentValue, includeRemove) {
        var input = $('<textarea></textarea>').addClass(_toValidateClassString(settingDef.validate, 'text-input')).attr('style', settingDef.style);

        if(settingDef.multi_input) {
            input.change(function() {
                var arrayInput = [];
                $(valueCell).find('textarea').each(function() {
                    var thisVal = $(this).val();
                    if(thisVal)
                        arrayInput = arrayInput.concat(thisVal);
                });
                newSettings.settings[settingDef.name] = arrayInput;
            });
        } else {
            input.change(function() {
                newSettings.settings[settingDef.name] = $(this).val();
            });
        }

        if(currentValue)
            input.val(currentValue);

        valueEditor.createValueEditor(input);

        var datasourceToolbox = $('<ul class="board-toolbar datasource-input-suffix"></ul>');
        var wrapperDiv = $('<div class="calculated-setting-row"></div>');

        wrapperDiv.append(input).append(datasourceToolbox);

        var datasourceTool = $('<li><i class="fa-w fa-plus"></i><label>' + $.i18n.t('PluginEditor.datasource_tool') + '</label></li>')
            .mousedown(function(e) {
                e.preventDefault();
                $(input).val('').focus().insertAtCaret('datasources[\"').trigger('freeboard-eval');
            });
        datasourceToolbox.append(datasourceTool);

        var jsEditorTool = $('<li><i class="fa-w fa-edit"></i><label>.JS EDITOR</label></li>')
            .mousedown(function(e) {
                e.preventDefault();
                jsEditor.displayJSEditor(input.val(), 'javascript', function(result) {
                    input.val(result);
                    input.change();
                });
            });
        datasourceToolbox.append(jsEditorTool);

        if(includeRemove) {
            var removeButton = $('<li class="remove-setting-row"><i class="fa-w fa-minus"></i><label></label></li>')
                .mousedown(function(e) {
                    e.preventDefault();
                    wrapperDiv.remove();
                    $(valueCell).find('textarea:first').change();
            });
            datasourceToolbox.prepend(removeButton);
        }

        $(valueCell).append(wrapperDiv);
    }

    function createSettingRow(form, name, displayName) {
        var tr = $('<div id="setting-row-' + name + '" class="form-row"></div>').appendTo(form);

        tr.append('<div class="form-label"><label class="control-label">' + displayName + '</label></div>');
        return $('<div id="setting-value-container-' + name + '" class="form-value"></div>').appendTo(tr);
    }

    function appendArrayCell(form, valueCell, settingDef, currentSettingsValues, newSettings) {
        var subTableDiv = $('<div class="form-table-value-subtable"></div>').appendTo(valueCell);

        var subTable = $('<table class="table table-condensed sub-table"></table>').appendTo(subTableDiv);
        var subTableHead = $('<thead></thead>').hide().appendTo(subTable);
        var subTableHeadRow = $('<tr></tr>').appendTo(subTableHead);
        var subTableBody = $('<tbody></tbody>').appendTo(subTable);

        var currentSubSettingValues = [];

        // Create our headers
        _.each(settingDef.settings, function(subSettingDef) {
            var subsettingDisplayName = subSettingDef.name;

            if(!_.isUndefined(subSettingDef.display_name))
                subsettingDisplayName = subSettingDef.display_name;

            $('<th>' + subsettingDisplayName + '</th>').appendTo(subTableHeadRow);
        });

        if(settingDef.name in currentSettingsValues)
            currentSubSettingValues = currentSettingsValues[settingDef.name];

        var processHeaderVisibility = function() {
            (newSettings.settings[settingDef.name].length > 0) ? subTableHead.show() : subTableHead.hide();
        };

        var createSubsettingRow = function(subsettingValue) {
            var subsettingRow = $('<tr></tr>').appendTo(subTableBody);

            var newSetting = {};

            if(!_.isArray(newSettings.settings[settingDef.name]))
                newSettings.settings[settingDef.name] = [];

            newSettings.settings[settingDef.name].push(newSetting);

            _.each(settingDef.settings, function(subSettingDef) {
                var subsettingCol = $('<td></td>').appendTo(subsettingRow);
                var subsettingValueString = '';

                if(!_.isUndefined(subsettingValue[subSettingDef.name]))
                    subsettingValueString = subsettingValue[subSettingDef.name];

                newSetting[subSettingDef.name] = subsettingValueString;

                $('<input class="table-row-value" type="text">')
                        .addClass(_toValidateClassString(subSettingDef.validate, 'text-input'))
                        .attr('style', settingDef.style)
                        .appendTo(subsettingCol).val(subsettingValueString).change(function() {
                    newSetting[subSettingDef.name] = $(this).val();
                });
            });

            subsettingRow.append($('<td class="table-row-operation"></td>').append($('<ul class="board-toolbar"></ul>').append($('<li></li>').append($('<i class="fa-w fa-trash"></i>').click(function() {
                                    var subSettingIndex = newSettings.settings[settingDef.name].indexOf(newSetting);

                                    if(subSettingIndex !== -1) {
                                        newSettings.settings[settingDef.name].splice(subSettingIndex, 1);
                                        subsettingRow.remove();
                                        processHeaderVisibility();
                                    }
                                })))));

            subTableDiv.scrollTop(subTableDiv[0].scrollHeight);

            processHeaderVisibility();
        };

        $('<div class="table-operation text-button">' + $.i18n.t('PluginEditor.table_operation') + '</div>').appendTo(valueCell).click(function() {
            var newSubsettingValue = {};

            _.each(settingDef.settings, function(subSettingDef) {
                newSubsettingValue[subSettingDef.name] = '';
            });

            createSubsettingRow(newSubsettingValue);
        });

        // Create our rows
        _.each(currentSubSettingValues, function(currentSubSettingValue, subSettingIndex) {
            createSubsettingRow(currentSubSettingValue);
        });
    }

    function appendBooleanCell(form, valueCell, settingDef, currentSettingsValues, newSettings) {
        newSettings.settings[settingDef.name] = currentSettingsValues[settingDef.name];

        var onOffSwitch = $('<div class="onoffswitch"><label class="onoffswitch-label" for="' + settingDef.name + '-onoff"><div class="onoffswitch-inner"><span class="on">' + $.i18n.t('global.yes') + '</span><span class="off">' + $.i18n.t('global.no') + '</span></div><div class="onoffswitch-switch"></div></label></div>').appendTo(valueCell);

        var input = $('<input type="checkbox" name="onoffswitch" class="onoffswitch-checkbox" id="' + settingDef.name + '-onoff">').prependTo(onOffSwitch).change(function() {
            newSettings.settings[settingDef.name] = this.checked;
        });

        if(settingDef.name in currentSettingsValues)
            input.prop('checked', currentSettingsValues[settingDef.name]);
    }

    function appendOptionCell(form, valueCell, settingDef, currentSettingsValues, newSettings) {
        var defaultValue = currentSettingsValues[settingDef.name];

        var input = $('<select></select>')
                            .addClass(_toValidateClassString(settingDef.validate))
                            .attr('style', settingDef.style)
                            .appendTo($('<div class="styled-select"></div>')
                            .appendTo(valueCell)).change(function() {
            newSettings.settings[settingDef.name] = $(this).val();
        });

        _.each(settingDef.options, function(option) {
            var optionName;
            var optionValue;

            if (_.isObject(option)) {
                optionName = option.name;
                optionValue = option.value;
            } else {
                optionName = option;
            }

            if (_.isUndefined(optionValue))
                optionValue = optionName;

            if (_.isUndefined(defaultValue))
                defaultValue = optionValue;

            $('<option></option>').text(optionName).attr('value', optionValue).appendTo(input);
        });

        newSettings.settings[settingDef.name] = defaultValue;

        if(settingDef.name in currentSettingsValues)
            input.val(currentSettingsValues[settingDef.name]);
    }

    function appendColorCell(form, valueCell, settingDef, currentSettingsValues, newSettings) {
        var curColorPickerID = _.uniqueId('picker-');
        var thisColorPickerID = '#' + curColorPickerID;
        var defaultValue = currentSettingsValues[settingDef.name];
        var input = $('<input id="' + curColorPickerID + '" type="text">').addClass(_toValidateClassString(settingDef.validate, 'text-input')).appendTo(valueCell);

        newSettings.settings[settingDef.name] = defaultValue;

        $(thisColorPickerID).css({
            'border-right':'30px solid green',
            'width':'80px'
        });

        $(thisColorPickerID).css('border-color', defaultValue);

        var defhex = defaultValue;
        defhex.replace('#', '');

        $(thisColorPickerID).colpick({
            layout:'hex',
            colorScheme:'dark',
            color: defhex,
            submit:0,
            onChange:function(hsb,hex,rgb,el,bySetColor) {
                $(el).css('border-color','#'+hex);
                newSettings.settings[settingDef.name] = '#'+hex;
                if(!bySetColor) {
                    $(el).val('#'+hex);
                }
            }
        }).keyup(function(){
            $(this).colpickSetColor(this.value);
        });

        if(settingDef.name in currentSettingsValues) {
            input.val(currentSettingsValues[settingDef.name]);
        }
    }

    function appendJsonCell(form, valueCell, settingDef, currentSettingsValues, newSettings) {
        newSettings.settings[settingDef.name] = currentSettingsValues[settingDef.name];

        var input = $('<textarea class="calculated-value-input" style="z-index: 3000"></textarea>')
                .addClass(_toValidateClassString(settingDef.validate, 'text-input'))
                .attr('style', settingDef.style)
                .appendTo(valueCell).change(function() {
            newSettings.settings[settingDef.name] = $(this).val();
        });

        if(settingDef.name in currentSettingsValues)
            input.val(currentSettingsValues[settingDef.name]);

        valueEditor.createValueEditor(input);

        var datasourceToolbox = $('<ul class="board-toolbar datasource-input-suffix"></ul>');

        var jsEditorTool = $('<li><i class="fa-w fa-edit"></i><label>.JSON EDITOR</label></li>').mousedown(function(e) {
            e.preventDefault();

            jsEditor.displayJSEditor(input.val(), 'json', function(result){
                input.val(result);
                input.change();
            });
        });

        $(valueCell).append(datasourceToolbox.append(jsEditorTool));
    }

    function appendHtmlMixedCell(form, valueCell, settingDef, currentSettingsValues, newSettings) {
        newSettings.settings[settingDef.name] = currentSettingsValues[settingDef.name];

        var input = $('<textarea class="calculated-value-input" style="z-index: 3000"></textarea>')
                .addClass(_toValidateClassString(settingDef.validate, 'text-input'))
                .attr('style', settingDef.style)
                .appendTo(valueCell).change(function() {
            newSettings.settings[settingDef.name] = $(this).val();
        });

        if(settingDef.name in currentSettingsValues)
            input.val(currentSettingsValues[settingDef.name]);

        valueEditor.createValueEditor(input);

        var datasourceToolbox = $('<ul class="board-toolbar datasource-input-suffix"></ul>');

        var jsEditorTool = $('<li><i class="fa-w fa-edit"></i><label>.HTML EDITOR</label></li>').mousedown(function(e) {
            e.preventDefault();

            jsEditor.displayJSEditor(input.val(), 'htmlmixed', function(result){
                input.val(result);
                input.change();
            });
        });

        $(valueCell).append(datasourceToolbox.append(jsEditorTool));
    }

    function appendTextCell(form, valueCell, settingDef, currentSettingsValues, newSettings) {
        newSettings.settings[settingDef.name] = currentSettingsValues[settingDef.name];

        var input = $('<input type="text">')
                            .addClass(_toValidateClassString(settingDef.validate, 'text-input'))
                            .attr('style', settingDef.style)
                            .appendTo(valueCell).change(function() {
            if (settingDef.type == 'number')
                newSettings.settings[settingDef.name] = Number($(this).val());
            else
                newSettings.settings[settingDef.name] = $(this).val();
        });

        if (settingDef.name in currentSettingsValues)
            input.val(currentSettingsValues[settingDef.name]);
    }

    function appendCalculatedCell(form, valueCell, settingDef, currentSettingsValues, newSettings) {
        newSettings.settings[settingDef.name] = currentSettingsValues[settingDef.name];

        if (settingDef.name in currentSettingsValues) {
            var currentValue = currentSettingsValues[settingDef.name];
            if(settingDef.multi_input && _.isArray(currentValue)) {
                var includeRemove = false;
                for(var i = 0; i < currentValue.length; i++) {
                    _appendCalculatedSettingRow(valueCell, newSettings, settingDef, currentValue[i], includeRemove);
                    includeRemove = true;
                }
            } else {
                _appendCalculatedSettingRow(valueCell, newSettings, settingDef, currentValue, false);
            }
        } else {
            _appendCalculatedSettingRow(valueCell, newSettings, settingDef, null, false);
        }

        if (settingDef.multi_input) {
            var inputAdder = $('<ul class="board-toolbar"><li class="add-setting-row"><i class="fa-w fa-plus"></i><label>' + $.i18n.t('PluginEditor.tableOperation') + '</label></li></ul>')

                .mousedown(function(e) {
                    e.preventDefault();
                    _appendCalculatedSettingRow(valueCell, newSettings, settingDef, null, true);
                });
            $(valueCell).siblings('.form-label').append(inputAdder);
        }
    }

    function createPluginEditor(title, pluginTypes, currentTypeName, currentSettingsValues, settingsSavedCallback, cancelCallback) {
        var newSettings = {
            type    : currentTypeName,
            settings: {}
        };

        var selectedType;
        var form = $('<form id="plugin-editor"></form>');

        var pluginDescriptionElement = $('<div id="plugin-description"></div>').hide();
        form.append(pluginDescriptionElement);

        function createSettingsFromDefinition(settingsDefs) {

            _.each(settingsDefs, function(settingDef) {
                // Set a default value if one doesn't exist
                if(!_.isUndefined(settingDef.default_value) && _.isUndefined(currentSettingsValues[settingDef.name]))
                    currentSettingsValues[settingDef.name] = settingDef.default_value;

                var displayName = settingDef.name;

                if(!_.isUndefined(settingDef.display_name))
                    displayName = settingDef.display_name;

                settingDef.style = _.isUndefined(settingDef.style) ? '' : settingDef.style;

                // modify required field name
                if(!_.isUndefined(settingDef.validate)) {
                    if (settingDef.validate.indexOf('required') != -1) {
                        displayName = '* ' + displayName;
                    }
                }

                // unescape text value
                if (settingDef.type === 'text')
                    currentSettingsValues[settingDef.name] = _.unescape(currentSettingsValues[settingDef.name]);

                var valueCell = createSettingRow(form, settingDef.name, displayName);
                var input, defaultValue;

                switch (settingDef.type) {
                    case 'array':
                        appendArrayCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                    case 'boolean':
                        appendBooleanCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                    case 'option':
                        appendOptionCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                    case 'color':
                        appendColorCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                    case 'htmlmixed':
                        appendHtmlMixedCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                    case 'json':
                        appendJsonCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                    case 'text':
                        appendTextCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                    case 'calculated':
                        appendCalculatedCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                    default:
                        appendTextCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                }

                if (!_.isUndefined(settingDef.suffix))
                    valueCell.append($('<div class="input-suffix">' + settingDef.suffix + '</div>'));

                if (!_.isUndefined(settingDef.description))
                    valueCell.append($('<div class="setting-description">' + settingDef.description + '</div>'));
            });
        }

        var db = new DialogBox(form, title, $.i18n.t('PluginEditor.dialog.yes'), $.i18n.t('PluginEditor.dialog.no'), function(okcancel) {
            if (okcancel === 'ok') {
                // escape text value
                _.each(selectedType.settings, function(def) {
                    if (def.type === 'text')
                        newSettings.settings[def.name] = _.escape(newSettings.settings[def.name]);
                });

                if (_.isFunction(settingsSavedCallback))
                    settingsSavedCallback(newSettings);
            } else if (okcancel === 'cancel') {
                if (_.isFunction(cancelCallback))
                    cancelCallback();
            }
            // Remove colorpick dom objects
            $('[id^=collorpicker]').remove();
        });

        // Create our body
        var pluginTypeNames = _.keys(pluginTypes);
        var typeSelect;

        if (pluginTypeNames.length > 1) {
            var typeRow = createSettingRow(form, 'plugin-types', $.i18n.t('PluginEditor.type'));
            typeSelect = $('<select></select>').appendTo($('<div class="styled-select"></div>').appendTo(typeRow));

            typeSelect.append($('<option>'+$.i18n.t('PluginEditor.first_option')+'</option>').attr('value', 'undefined'));

            _.each(pluginTypes, function(pluginType) {
                typeSelect.append($('<option></option>').text(pluginType.display_name).attr('value', pluginType.type_name));
            });

            typeSelect.change(function() {
                newSettings.type = $(this).val();
                newSettings.settings = {};

                // Remove all the previous settings
                _removeSettingsRows();

                selectedType = pluginTypes[typeSelect.val()];

                if (_.isUndefined(selectedType)) {
                    $('#setting-row-instance-name').hide();
                    $('#dialog-ok').hide();
                } else {
                    $('#setting-row-instance-name').show();

                    if(selectedType.description && selectedType.description.length > 0)
                        pluginDescriptionElement.html(selectedType.description).show();
                    else
                        pluginDescriptionElement.hide();

                    $('#dialog-ok').show();
                    createSettingsFromDefinition(selectedType.settings);
                }
            });
        } else if (pluginTypeNames.length === 1) {
            selectedType = pluginTypes[pluginTypeNames[0]];
            newSettings.type = selectedType.type_name;
            newSettings.settings = {};
            createSettingsFromDefinition(selectedType.settings);
        }

        if (typeSelect) {
            if (_.isUndefined(currentTypeName)) {
                $('#setting-row-instance-name').hide();
                $('#dialog-ok').hide();
            } else {
                $('#dialog-ok').show();
                typeSelect.val(currentTypeName).trigger('change');
            }
        }
    }

    // Public API
    return {
        createPluginEditor : function(
                    title,
                    pluginTypes,
                    currentInstanceName,
                    currentTypeName,
                    currentSettingsValues,
                    settingsSavedCallback) {
            createPluginEditor(title, pluginTypes, currentInstanceName, currentTypeName, currentSettingsValues, settingsSavedCallback);
        }
    };
};
// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

ValueEditor = function(theFreeboardModel) {
    'use strict';

    var _veDatasourceRegex = new RegExp('.*datasources\\[\"([^\"]*)(\"\\])?(.*)$');

    var dropdown = null;
    var selectedOptionIndex = 0;
    var _autocompleteOptions = [];
    var currentValue = null;

    var EXPECTED_TYPE = {
        ANY : 'any',
        ARRAY : 'array',
        OBJECT : 'object',
        STRING : 'string',
        NUMBER : 'number',
        BOOLEAN : 'boolean'
    };

    function _isPotentialTypeMatch(value, expectsType) {
        if(_.isArray(value) || _.isObject(value))
            return true;
        return _isTypeMatch(value, expectsType);
    }

    function _isTypeMatch(value, expectsType) {
        switch(expectsType) {
        case EXPECTED_TYPE.ANY: return true;
        case EXPECTED_TYPE.ARRAY: return _.isArray(value);
        case EXPECTED_TYPE.OBJECT: return _.isObject(value);
        case EXPECTED_TYPE.STRING: return _.isString(value);
        case EXPECTED_TYPE.NUMBER: return _.isNumber(value);
        case EXPECTED_TYPE.BOOLEAN: return _.isBoolean(value);
        }
    }

    function _checkCurrentValueType(element, expectsType) {
        $(element).parent().find('.validation-error').remove();
        if(!_isTypeMatch(currentValue, expectsType)) {
            $(element).parent().append('<div class="validation-error">' +
                'This field expects an expression that evaluates to type ' +
                expectsType + '.</div>');
        }
    }

    function _resizeValueEditor(element) {
        var lineBreakCount = ($(element).val().match(/\n/g) || []).length;

        var newHeight = Math.min(200, 20 * (lineBreakCount + 1));

        $(element).css({height: newHeight + 'px'});
    }

    function _autocompleteFromDatasource(inputString, datasources, expectsType) {
        var match = _veDatasourceRegex.exec(inputString);

        var options = [];

        if (match) {
            if (match[1] === '') {
                // Editor value is: datasources["; List all datasources
                _.each(datasources, function(datasource) {
                    options.push({value: datasource.name(), entity: undefined,
                        precede_char: '', follow_char: '\"]'});
                });
            } else if (match[1] !== '' && _.isUndefined(match[2])) {
                // Editor value is a partial match for a datasource; list matching datasources
                var replacementString = match[1];

                _.each(datasources, function(datasource) {
                    var dsName = datasource.name();

                    if(dsName != replacementString && dsName.indexOf(replacementString) === 0) {
                        options.push({value: dsName, entity: undefined,
                            precede_char: '', follow_char: '\"]'});
                    }
                });
            } else {
                // Editor value matches a datasources; parse JSON in order to populate list
                // We already have a datasource selected; find it
                var datasource = _.find(datasources, function(datasource) {
                    return (datasource.name() === match[1]);
                });

                if (!_.isUndefined(datasource)) {
                    var dataPath = 'data';
                    var remainder = '';

                    // Parse the partial JSON selectors
                    if (!_.isUndefined(match[2])) {
                        // Strip any incomplete field values, and store the remainder
                        var remainderIndex = match[3].lastIndexOf(']') + 1;
                        dataPath = dataPath + match[3].substring(0, remainderIndex);
                        remainder = match[3].substring(remainderIndex, match[3].length);
                        remainder = remainder.replace(/^[\[\"]*/, '');
                        remainder = remainder.replace(/[\"\]]*$/, '');
                    }

                    // Get the data for the last complete JSON field
                    var dataValue = datasource.getDataRepresentation(dataPath);
                    currentValue = dataValue;

                    // For arrays, list out the indices
                    if (_.isArray(dataValue)) {
                        for(var index = 0; index < dataValue.length; index++) {
                            if (index.toString().indexOf(remainder) === 0) {
                                var value = dataValue[index];
                                if (_isPotentialTypeMatch(value, expectsType)) {
                                    options.push({value: index, entity: value,
                                        precede_char: '[', follow_char: ']',
                                        preview: value.toString()});
                                }
                            }
                        }
                    } else if(_.isObject(dataValue)) {
                        // For objects, list out the keys
                        _.each(dataValue, function(value, name) {
                            if (name.indexOf(remainder) === 0) {
                                if (_isPotentialTypeMatch(value, expectsType)) {
                                    options.push({value: name, entity: value,
                                        precede_char: '[\"', follow_char: '\"]'});
                                }
                            }
                        });
                    } else {
                        // For everything else, do nothing (no further selection possible)
                        // no-op
                    }
                }
            }
        }
        _autocompleteOptions = options;
    }

    function _renderAutocompleteDropdown(element, expectsType) {
        var inputString = $(element).val().substring(0, $(element).getCaretPosition());

        // Weird issue where the textarea box was putting in ASCII (nbsp) for spaces.
        inputString = inputString.replace(String.fromCharCode(160), ' ');

        _autocompleteFromDatasource(inputString, theFreeboardModel.datasources(), expectsType);

        if (_autocompleteOptions.length > 0) {
            if (!dropdown) {
                dropdown = $('<ul id="value-selector" class="value-dropdown"></ul>')
                    .insertAfter(element)
                    .width($(element).outerWidth() - 2)
                    .css('left', $(element).position().left)
                    .css('top', $(element).position().top + $(element).outerHeight() - 1);
            }

            dropdown.empty();
            dropdown.scrollTop(0);

            var selected = true;
            selectedOptionIndex = 0;

            _.each(_autocompleteOptions, function(option, index) {
                var li = _renderAutocompleteDropdownOption(element, inputString, option, index);
                if (selected) {
                    $(li).addClass('selected');
                    selected = false;
                }
            });
        } else {
            _checkCurrentValueType(element, expectsType);
            $(element).next('ul#value-selector').remove();
            dropdown = null;
            selectedOptionIndex = -1;
        }
    }

    function _renderAutocompleteDropdownOption(element, inputString, option, currentIndex) {
        var optionLabel = option.value;
        if(option.preview)
            optionLabel = optionLabel + '<span class="preview">' + option.preview + '</span>';

        var li = $('<li>' + optionLabel + '</li>').appendTo(dropdown)
            .mouseenter(function() {
                $(this).trigger('freeboard-select');
            })
            .mousedown(function(event) {
                $(this).trigger('freeboard-insertValue');
                event.preventDefault();
            })
            .data('freeboard-optionIndex', currentIndex)
            .data('freeboard-optionValue', option.value)
            .bind('freeboard-insertValue', function() {
                var optionValue = option.value;
                optionValue = option.precede_char + optionValue + option.follow_char;

                var replacementIndex = inputString.lastIndexOf(']');
                if(replacementIndex != -1)
                    $(element).replaceTextAt(replacementIndex+1, $(element).val().length, optionValue);
                else
                    $(element).insertAtCaret(optionValue);

                currentValue = option.entity;
                $(element).triggerHandler('mouseup');
            })
            .bind('freeboard-select', function() {
                $(this).parent().find('li.selected').removeClass('selected');
                $(this).addClass('selected');
                selectedOptionIndex = $(this).data('freeboard-optionIndex');
            });
        return li;
    }

    function createValueEditor(element, expectsType) {
        $(element).addClass('calculated-value-input')
            .bind('keyup mouseup freeboard-eval', function(event) {
                // Ignore arrow keys and enter keys
                if(dropdown && event.type === 'keyup' && (event.keyCode === 38 || event.keyCode === 40 || event.keyCode === 13)) {
                    event.preventDefault();
                    return;
                }
                _renderAutocompleteDropdown(element, expectsType);
            })
            .focus(function() {
                $(element).css({'z-index' : 3001});
                _resizeValueEditor(element);
            })
            .focusout(function() {
                _checkCurrentValueType(element, expectsType);
                $(element).css({
                    'height': '',
                    'z-index' : 3000
                });
                $(element).next('ul#value-selector').remove();
                dropdown = null;
                selectedOptionIndex = -1;
            })
            .bind('keydown', function(event) {
                if (dropdown) {
                    if (event.keyCode === 38 || event.keyCode === 40) {
                        // Handle Arrow keys
                        event.preventDefault();

                        var optionItems = $(dropdown).find('li');

                        if (event.keyCode === 38) // Up Arrow
                            selectedOptionIndex--;
                        else if(event.keyCode === 40) // Down Arrow
                            selectedOptionIndex++;

                        if (selectedOptionIndex < 0)
                            selectedOptionIndex = optionItems.size() - 1;
                        else if (selectedOptionIndex >= optionItems.size())
                            selectedOptionIndex = 0;

                        var optionElement = $(optionItems).eq(selectedOptionIndex);

                        optionElement.trigger('freeboard-select');
                        $(dropdown).scrollTop($(optionElement).position().top);

                    } else if (event.keyCode === 13) {
                        event.preventDefault();

                        if (selectedOptionIndex != -1) {
                            $(dropdown).find('li').eq(selectedOptionIndex)
                                .trigger('freeboard-insertValue');
                        }
                    }
                }
            });
    }

    // Public API
    return {
        createValueEditor : function(element, expectsType) {
            if(expectsType)
                createValueEditor(element, expectsType);
            else
                createValueEditor(element, EXPECTED_TYPE.ANY);
        },
        EXPECTED_TYPE : EXPECTED_TYPE
    };
};

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

function WidgetModel(theFreeboardModel, widgetPlugins) {
    'use strict';

    function disposeWidgetInstance() {
        if (!_.isUndefined(self.widgetInstance)) {
            if (_.isFunction(self.widgetInstance.onDispose)) {
                self.widgetInstance.onDispose();
            }
            self.widgetInstance = undefined;
        }
    }

    var self = this;

    this.datasourceRefreshNotifications = {};
    this.calculatedSettingScripts = {};
    this.scriptGlobalVariables = {};

    this.isEditing = ko.observable(false); // editing by PluginEditor
    this.title = ko.observable();
    this.fillSize = ko.observable(false);

    this.type = ko.observable();
    this.type.subscribe(function(newValue) {
        disposeWidgetInstance();

        if ((newValue in widgetPlugins) && _.isFunction(widgetPlugins[newValue].newInstance)) {
            var widgetType = widgetPlugins[newValue];

            var finishLoad = function() {
                widgetType.newInstance(self.settings(), function (widgetInstance) {
                    self.fillSize((widgetType.fill_size === true));
                    self.widgetInstance = widgetInstance;
                    self.shouldRender(true);
                    self._heightUpdate.valueHasMutated();
                });
            };

            // Do we need to load any external scripts?
            if (widgetType.external_scripts)
                head.js(widgetType.external_scripts.slice(0), finishLoad); // Need to clone the array because head.js adds some weird functions to it
            else
                finishLoad();
        }
    });

    this.settings = ko.observable({});
    this.settings.subscribe(function(newValue) {
        var updateCalculate = true;
        if (!_.isUndefined(self.widgetInstance) && _.isFunction(self.widgetInstance.onSettingsChanged))
            updateCalculate = self.widgetInstance.onSettingsChanged(newValue);

        if (_.isUndefined(updateCalculate) || updateCalculate === true)
            self.updateCalculatedSettings();
        self._heightUpdate.valueHasMutated();
    });

    this.processDatasourceUpdate = function(datasourceName) {
        var refreshSettingNames = self.datasourceRefreshNotifications[datasourceName];

        if (_.isArray(refreshSettingNames)) {
            _.each(refreshSettingNames, function(settingName) {
                self.processCalculatedSetting(settingName);
            });
        }
    };

    this.callValueFunction = function(theFunction, globalVariables) {
        return theFunction.call(undefined, theFreeboardModel.datasourceData, globalVariables);
    };

    this.processSizeChange = function() {
        if (!_.isUndefined(self.widgetInstance) && _.isFunction(self.widgetInstance.onSizeChanged))
            self.widgetInstance.onSizeChanged();
    };

    this.processCalculatedSetting = function(settingName) {
        if (_.isFunction(self.calculatedSettingScripts[settingName])) {
            var returnValue;

            try {
                returnValue = self.callValueFunction(self.calculatedSettingScripts[settingName], self.scriptGlobalVariables[settingName]);
            } catch (e) {
                var rawValue = self.settings()[settingName];

                // If there is a reference error and the value just contains letters and numbers, then
                if (e instanceof ReferenceError && (/^.*/).test(rawValue))
                    returnValue = rawValue;
                else if (e instanceof TypeError && e.message.indexOf('Cannot read property') != -1)
                    ;
            }

            if (!_.isUndefined(self.widgetInstance) && _.isFunction(self.widgetInstance.onCalculatedValueChanged) && !_.isUndefined(returnValue)) {
                try {
                    self.widgetInstance.onCalculatedValueChanged(settingName, returnValue);
                } catch (e) {
                    console.log(e.toString());
                }
            }
        }
    };

    this.updateDatasourceNameRef = function (newDatasourceName, oldDatasourceName) {
        if (_.isUndefined(self.type()))
            return;

        var settingsDefs = widgetPlugins[self.type()].settings;
        var oldRegex = new RegExp('datasources\\[[\'\"]' + _.escapeRegExp(oldDatasourceName) + '[\'\"]\\]', 'g');
        var rep = 'datasources[\"' + newDatasourceName + '\"]';
        var currentSettings = self.settings();

        _.each(settingsDefs, function (settingDef) {
            if (settingDef.type === 'calculated') {
                var script = currentSettings[settingDef.name];

                if (!_.isUndefined(script)) {
                    script = script.replace(oldRegex, rep);
                    currentSettings[settingDef.name] = script;
                    self.settings(currentSettings);
                }
            }
        });
    };

    this.updateCalculatedSettings = function () {
        self.datasourceRefreshNotifications = {};
        self.calculatedSettingScripts = {};

        if (_.isUndefined(self.type())) {
            return;
        }

        // Check for any calculated settings
        var settingsDefs = widgetPlugins[self.type()].settings;
        var datasourceRegex = new RegExp('datasources.([\\w_-]+)|datasources\\[[\'\"]([^\'\"]+)', 'g');
        var currentSettings = self.settings();

        _.each(settingsDefs, function (settingDef) {
            if (settingDef.type === 'calculated') {
                var script = currentSettings[settingDef.name];

                if (!_.isUndefined(script)) {

                    // clear global variable
                    self.scriptGlobalVariables[settingDef.name] = {};

                    if(_.isArray(script))
                        script = '[' + script.join(',') + ']';

                    // If there is no return, add one
                    if ((script.match(/;/g) || []).length <= 1 && script.indexOf('return') == -1)
                        script = 'return ' + script;

                    var valueFunction;

                    try {
                        valueFunction = new Function('datasources', '_global', script);
                    } catch (e) {
                        var literalText = currentSettings[settingDef.name].replace(/"/g, '\\"').replace(/[\r\n]/g, ' \\\n');

                        // If the value function cannot be created, then go ahead and treat it as literal text
                        valueFunction = new Function('datasources', '_global', 'return \"' + literalText + '\";');
                    }

                    self.calculatedSettingScripts[settingDef.name] = valueFunction;
                    self.processCalculatedSetting(settingDef.name);

                    // Are there any datasources we need to be subscribed to?
                    var matches;

                    while (matches = datasourceRegex.exec(script)) {
                        var dsName = (matches[1] || matches[2]);
                        var refreshSettingNames = self.datasourceRefreshNotifications[dsName];

                        if (_.isUndefined(refreshSettingNames)) {
                            refreshSettingNames = [];
                            self.datasourceRefreshNotifications[dsName] = refreshSettingNames;
                        }

                        // Only subscribe to this notification once.
                        if(_.indexOf(refreshSettingNames, settingDef.name) === -1)
                            refreshSettingNames.push(settingDef.name);
                    }
                }
            }
        });
    };

    this._heightUpdate = ko.observable();
    this.height = ko.computed({
        read: function () {
            self._heightUpdate();
            if (!_.isUndefined(self.widgetInstance) && _.isFunction(self.widgetInstance.getHeight)) {
                return self.widgetInstance.getHeight();
            }
            return 1;
        }
    });

    this.shouldRender = ko.observable(false);
    this.render = function (element) {
        self.shouldRender(false);
        if (!_.isUndefined(self.widgetInstance) && _.isFunction(self.widgetInstance.render)) {
            self.widgetInstance.render(element);
            self.updateCalculatedSettings();
        }
    };

    this.dispose = function () {
        if (!_.isUndefined(self.widgetInstance) && _.isFunction(self.widgetInstance.onDispose))
            self.widgetInstance.onDispose();
    };

    this.serialize = function () {
        return {
            title: self.title(),
            type: self.type(),
            settings: self.settings()
        };
    };

    this.deserialize = function (object) {
        self.title(object.title);
        self.settings(object.settings);
        self.type(object.type);
    };
}

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

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

(function() {
    'use strict';

    var clockDatasource = function (settings, updateCallback) {
        var self = this;
        var currentSettings = settings;
        var timer;

        function stopTimer() {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        }

        function updateTimer() {
            stopTimer();
            timer = setInterval(self.updateNow, currentSettings.refresh * 1000);
        }

        this.updateNow = function () {
            var now = moment().tz(currentSettings.timezone);

            var data = {
                numeric_value: now.unix(),
                full_string_value: now.format('YYYY/MM/DD HH:mm:ss'),
                date_string_value: now.format('YYYY/MM/DD'),
                time_string_value: now.format('HH:mm:ss'),
                date_object: now.toDate()
            };

            updateCallback(data);
        };

        this.onDispose = function () {
            stopTimer();
        };

        this.onSettingsChanged = function (newSettings) {
            currentSettings = newSettings;
            if (_.isUndefined(currentSettings.timezone))
                currentSettings.timezone = 'Asia/Tokyo';
            updateTimer();
        };

        updateTimer();
    };

    freeboard.loadDatasourcePlugin({
        type_name: 'clock',
        display_name: $.i18n.t('plugins_ds.clock.display_name'),
        description: $.i18n.t('plugins_ds.clock.description'),
        settings: [
            {
                name: 'timezone',
                display_name: $.i18n.t('plugins_ds.clock.timezone'),
                type: 'option',
                default_value: 'Asia/Tokyo',
                options: [
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Etc/GMT+12'),
                        value: 'Etc/GMT+12'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Etc/GMT+11'),
                        value: 'Etc/GMT+11'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Pacific/Honolulu'),
                        value: 'Pacific/Honolulu'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Anchorage'),
                        value: 'America/Anchorage'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Santa_Isabel'),
                        value: 'America/Santa_Isabel'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Los_Angeles'),
                        value: 'America/Los_Angeles'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Chihuahua'),
                        value: 'America/Chihuahua'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Phoenix'),
                        value: 'America/Phoenix'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Denver'),
                        value: 'America/Denver'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Guatemala'),
                        value: 'America/Guatemala'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Chicago'),
                        value: 'America/Chicago'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Regina'),
                        value: 'America/Regina'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Mexico_City'),
                        value: 'America/Mexico_City'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Bogota'),
                        value: 'America/Bogota'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Indiana/Indianapolis'),
                        value: 'America/Indiana/Indianapolis'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/New_York'),
                        value: 'America/New_York'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Caracas'),
                        value: 'America/Caracas'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Halifax'),
                        value: 'America/Halifax'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Asuncion'),
                        value: 'America/Asuncion'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/La_Paz'),
                        value: 'America/La_Paz'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Cuiaba'),
                        value: 'America/Cuiaba'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Santiago'),
                        value: 'America/Santiago'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/St_Johns'),
                        value: 'America/St_Johns'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Sao_Paulo'),
                        value: 'America/Sao_Paulo'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Godthab'),
                        value: 'America/Godthab'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Cayenne'),
                        value: 'America/Cayenne'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Argentina/Buenos_Aires'),
                        value: 'America/Argentina/Buenos_Aires'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Montevideo'),
                        value: 'America/Montevideo'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Etc/GMT+2'),
                        value: 'Etc/GMT+2'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Cape_Verde'),
                        value: 'America/Cape_Verde'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Atlantic/Azores'),
                        value: 'Atlantic/Azores'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.America/Casablanca'),
                        value: 'America/Casablanca'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Atlantic/Reykjavik'),
                        value: 'Atlantic/Reykjavik'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Europe/London'),
                        value: 'Europe/London'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Etc/GMT'),
                        value: 'Etc/GMT'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Europe/Berlin'),
                        value: 'Europe/Berlin'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Europe/Paris'),
                        value: 'Europe/Paris'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Africa/Lagos'),
                        value: 'Africa/Lagos'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Europe/Budapest'),
                        value: 'Europe/Budapest'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Europe/Warsaw'),
                        value: 'Europe/Warsaw'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Africa/Windhoek'),
                        value: 'Africa/Windhoek'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Europe/Istanbul'),
                        value: 'Europe/Istanbul'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Europe/Kiev'),
                        value: 'Europe/Kiev'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Africa/Cairo'),
                        value: 'Africa/Cairo'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Damascus'),
                        value: 'Asia/Damascus'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Amman'),
                        value: 'Asia/Amman'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Africa/Johannesburg'),
                        value: 'Africa/Johannesburg'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Jerusalem'),
                        value: 'Asia/Jerusalem'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Beirut'),
                        value: 'Asia/Beirut'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Baghdad'),
                        value: 'Asia/Baghdad'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Europe/Minsk'),
                        value: 'Europe/Minsk'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Riyadh'),
                        value: 'Asia/Riyadh'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Africa/Nairobi'),
                        value: 'Africa/Nairobi'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Tehran'),
                        value: 'Asia/Tehran'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Europe/Moscow'),
                        value: 'Europe/Moscow'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Tbilisi'),
                        value: 'Asia/Tbilisi'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Yerevan'),
                        value: 'Asia/Yerevan'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Dubai'),
                        value: 'Asia/Dubai'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Baku'),
                        value: 'Asia/Baku'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Indian/Mauritius'),
                        value: 'Indian/Mauritius'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Kabul'),
                        value: 'Asia/Kabul'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Tashkent'),
                        value: 'Asia/Tashkent'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Karachi'),
                        value: 'Asia/Karachi'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Colombo'),
                        value: 'Asia/Colombo'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Indian/Kolkata'),
                        value: 'Indian/Kolkata'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Kathmandu'),
                        value: 'Asia/Kathmandu'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Almaty'),
                        value: 'Asia/Almaty'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Dhaka'),
                        value: 'Asia/Dhaka'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Yekaterinburg'),
                        value: 'Asia/Yekaterinburg'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Rangoon'),
                        value: 'Asia/Rangoon'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Bangkok'),
                        value: 'Asia/Bangkok'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Novosibirsk'),
                        value: 'Asia/Novosibirsk'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Krasnoyarsk'),
                        value: 'Asia/Krasnoyarsk'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Ulaanbaatar'),
                        value: 'Asia/Ulaanbaatar'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Shanghai'),
                        value: 'Asia/Shanghai'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Australia/Perth'),
                        value: 'Australia/Perth'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Singapore'),
                        value: 'Asia/Singapore'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Taipei'),
                        value: 'Asia/Taipei'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Irkutsk'),
                        value: 'Asia/Irkutsk'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Seoul'),
                        value: 'Asia/Seoul'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Tokyo'),
                        value: 'Asia/Tokyo'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Australia/Darwin'),
                        value: 'Australia/Darwin'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Australia/Adelaide'),
                        value: 'Australia/Adelaide'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Australia/Hobart'),
                        value: 'Australia/Hobart'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Yakutsk'),
                        value: 'Asia/Yakutsk'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Australia/Brisbane'),
                        value: 'Australia/Brisbane'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Pacific/Port_Moresby'),
                        value: 'Pacific/Port_Moresby'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Australia/Sydney'),
                        value: 'Australia/Sydney'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Vladivostok'),
                        value: 'Asia/Vladivostok'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Pacific/Guadalcanal'),
                        value: 'Pacific/Guadalcanal'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Etc/GMT-12'),
                        value: 'Etc/GMT-12'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Pacific/Fiji'),
                        value: 'Pacific/Fiji'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Asia/Magadan'),
                        value: 'Asia/Magadan'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Pacific/Auckland'),
                        value: 'Pacific/Auckland'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Pacific/Tongatapu'),
                        value: 'Pacific/Tongatapu'
                    },
                    {
                        name: $.i18n.t('plugins_ds.clock.timezone_options.Pacific/Apia'),
                        value: 'Pacific/Apia'
                    }
                ]
            },
            {
                name: 'refresh',
                display_name: $.i18n.t('plugins_ds.clock.refresh'),
                validate: 'required,custom[integer],min[1]',
                style: 'width:100px',
                type: 'number',
                suffix: $.i18n.t('plugins_ds.clock.refresh_suffix'),
                default_value: 1
            }
        ],
        newInstance: function (settings, newInstanceCallback, updateCallback) {
            newInstanceCallback(new clockDatasource(settings, updateCallback));
        }
    });
}());

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

(function() {
    'use strict';

    var jsonDatasource = function (settings, updateCallback) {
        var self = this;
        var PROXY_URL = 'thingproxy.freeboard.io/fetch/';

        var updateTimer = null;
        var currentSettings = settings;
        var errorStage = 0;     // 0 = try standard request
        // 1 = try JSONP
        // 2 = try thingproxy.freeboard.io
        var lockErrorStage = false;

        function updateRefresh(refreshTime) {
            if (updateTimer) {
                clearInterval(updateTimer);
            }

            updateTimer = setInterval(function () {
                self.updateNow();
            }, refreshTime);
        }

        updateRefresh(currentSettings.refresh * 1000);

        this.updateNow = function () {
            if ((errorStage > 1 && !currentSettings.use_thingproxy) || errorStage > 2) // We've tried everything, let's quit
            {
                return; // TODO: Report an error
            }

            var requestURL = currentSettings.url;

            if (errorStage === 2 && currentSettings.use_thingproxy) {
                requestURL = (location.protocol == 'https:' ? 'https:' : 'http:') + '//' + PROXY_URL + encodeURI(currentSettings.url);
            }

            var body = currentSettings.body;

            // Can the body be converted to JSON?
            if (body) {
                try {
                    body = JSON.parse(body);
                }
                catch (e) {
                }
            }

            $.ajax({
                url: requestURL,
                dataType: (errorStage === 1) ? 'JSONP' : 'JSON',
                type: currentSettings.method || 'GET',
                data: body,
                beforeSend: function (xhr) {
                    try {
                        _.each(currentSettings.headers, function (header) {
                            var name = header.name;
                            var value = header.value;

                            if (!_.isUndefined(name) && !_.isUndefined(value)) {
                                xhr.setRequestHeader(name, value);
                            }
                        });
                    }
                    catch (e) {
                    }
                },
                success: function (data) {
                    lockErrorStage = true;
                    updateCallback(data);
                },
                error: function (xhr, status, error) {
                    if (!lockErrorStage) {
                        // TODO: Figure out a way to intercept CORS errors only. The error message for CORS errors seems to be a standard 404.
                        errorStage++;
                        self.updateNow();
                    }
                }
            });
        };

        this.onDispose = function () {
            clearInterval(updateTimer);
            updateTimer = null;
        };

        this.onSettingsChanged = function (newSettings) {
            lockErrorStage = false;
            errorStage = 0;

            currentSettings = newSettings;
            updateRefresh(currentSettings.refresh * 1000);
            self.updateNow();
        };
    };

    freeboard.loadDatasourcePlugin({
        type_name: 'JSON',
        display_name: $.i18n.t('plugins_ds.json.display_name'),
        description: $.i18n.t('plugins_ds.json.description'),
        settings: [
            {
                name: 'url',
                display_name: $.i18n.t('plugins_ds.json.url'),
                validate: 'required,custom[url]',
                type: 'text'
            },
            {
                name: 'use_thingproxy',
                display_name: $.i18n.t('plugins_ds.json.use_thingproxy'),
                description: $.i18n.t('plugins_ds.json.use_thingproxy_desc'),
                type: 'boolean',
                default_value: true
            },
            {
                name: 'refresh',
                display_name: $.i18n.t('plugins_ds.json.refresh'),
                validate: 'required,custom[integer],min[1]',
                style: 'width:100px',
                type: 'number',
                suffix: $.i18n.t('plugins_ds.json.refresh_suffix'),
                default_value: 5
            },
            {
                name: 'method',
                display_name: $.i18n.t('plugins_ds.json.method'),
                type: 'option',
                style: 'width:200px',
                options: [
                    {
                        name: 'GET',
                        value: 'GET'
                    },
                    {
                        name: 'POST',
                        value: 'POST'
                    },
                    {
                        name: 'PUT',
                        value: 'PUT'
                    },
                    {
                        name: 'DELETE',
                        value: 'DELETE'
                    }
                ]
            },
            {
                name: 'body',
                display_name: $.i18n.t('plugins_ds.json.body'),
                type: 'json',
                validate: 'optional,maxSize[2000]',
                description: $.i18n.t('plugins_ds.json.body_desc')
            },
            {
                name: 'headers',
                display_name: $.i18n.t('plugins_ds.json.headers'),
                type: 'array',
                settings: [
                    {
                        name: 'name',
                        display_name: $.i18n.t('plugins_ds.json.headers_name'),
                        type: 'text',
                        validate: 'optional,maxSize[500]'
                    },
                    {
                        name: 'value',
                        display_name: $.i18n.t('plugins_ds.json.headers_value'),
                        type: 'text',
                        validate: 'optional,maxSize[500]'
                    }
                ]
            }
        ],
        newInstance: function (settings, newInstanceCallback, updateCallback) {
            newInstanceCallback(new jsonDatasource(settings, updateCallback));
        }
    });
}());

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

(function () {
    'use strict';

    var yahooWeatherDatasource = function (settings, updateCallback) {
        var self = this;
        var updateTimer = null;
        var currentSettings = settings;

        // condition code
        var conditionMap = [
            $.i18n.t('plugins_ds.yahooweather.cond_0'),     // 0   tornado
            $.i18n.t('plugins_ds.yahooweather.cond_1'),     // 1   tropical storm
            $.i18n.t('plugins_ds.yahooweather.cond_2'),     // 2   hurricane
            $.i18n.t('plugins_ds.yahooweather.cond_3'),     // 3   severe thunderstorms
            $.i18n.t('plugins_ds.yahooweather.cond_4'),     // 4   thunderstorms
            $.i18n.t('plugins_ds.yahooweather.cond_5'),     // 5   mixed rain and snow
            $.i18n.t('plugins_ds.yahooweather.cond_6'),     // 6   mixed rain and sleet
            $.i18n.t('plugins_ds.yahooweather.cond_7'),     // 7   mixed snow and sleet
            $.i18n.t('plugins_ds.yahooweather.cond_8'),     // 8   freezing drizzle
            $.i18n.t('plugins_ds.yahooweather.cond_9'),     // 9   drizzle
            $.i18n.t('plugins_ds.yahooweather.cond_10'),    // 10  freezing rain
            $.i18n.t('plugins_ds.yahooweather.cond_11'),    // 11  showers
            $.i18n.t('plugins_ds.yahooweather.cond_12'),    // 12  showers
            $.i18n.t('plugins_ds.yahooweather.cond_13'),    // 13  snow flurries
            $.i18n.t('plugins_ds.yahooweather.cond_14'),    // 14  light snow showers
            $.i18n.t('plugins_ds.yahooweather.cond_15'),    // 15  blowing snow
            $.i18n.t('plugins_ds.yahooweather.cond_16'),    // 16  snow
            $.i18n.t('plugins_ds.yahooweather.cond_17'),    // 17  hail
            $.i18n.t('plugins_ds.yahooweather.cond_18'),    // 18  sleet
            $.i18n.t('plugins_ds.yahooweather.cond_19'),    // 19  dust
            $.i18n.t('plugins_ds.yahooweather.cond_20'),    // 20  foggy
            $.i18n.t('plugins_ds.yahooweather.cond_21'),    // 21  haze
            $.i18n.t('plugins_ds.yahooweather.cond_22'),    // 22  smoky
            $.i18n.t('plugins_ds.yahooweather.cond_23'),    // 23  blustery
            $.i18n.t('plugins_ds.yahooweather.cond_24'),    // 24  windy
            $.i18n.t('plugins_ds.yahooweather.cond_25'),    // 25  cold
            $.i18n.t('plugins_ds.yahooweather.cond_26'),    // 26  cloudy
            $.i18n.t('plugins_ds.yahooweather.cond_27'),    // 27  mostly cloudy (night)
            $.i18n.t('plugins_ds.yahooweather.cond_28'),    // 28  mostly cloudy (day)
            $.i18n.t('plugins_ds.yahooweather.cond_29'),    // 29  partly cloudy (night)
            $.i18n.t('plugins_ds.yahooweather.cond_30'),    // 30  partly cloudy (day)
            $.i18n.t('plugins_ds.yahooweather.cond_31'),    // 31  clear (night)
            $.i18n.t('plugins_ds.yahooweather.cond_32'),    // 32  sunny
            $.i18n.t('plugins_ds.yahooweather.cond_33'),    // 33  fair (night)
            $.i18n.t('plugins_ds.yahooweather.cond_34'),    // 34  fair (day)
            $.i18n.t('plugins_ds.yahooweather.cond_35'),    // 35  mixed rain and hail
            $.i18n.t('plugins_ds.yahooweather.cond_36'),    // 36  hot
            $.i18n.t('plugins_ds.yahooweather.cond_37'),    // 37  isolated thunderstorms
            $.i18n.t('plugins_ds.yahooweather.cond_38'),    // 38  scattered thunderstorms
            $.i18n.t('plugins_ds.yahooweather.cond_39'),    // 39  scattered thunderstorms
            $.i18n.t('plugins_ds.yahooweather.cond_40'),    // 40  scattered showers
            $.i18n.t('plugins_ds.yahooweather.cond_41'),    // 41  heavy snow
            $.i18n.t('plugins_ds.yahooweather.cond_42'),    // 42  scattered snow showers
            $.i18n.t('plugins_ds.yahooweather.cond_43'),    // 43  heavy snow
            $.i18n.t('plugins_ds.yahooweather.cond_44'),    // 44  partly cloudy
            $.i18n.t('plugins_ds.yahooweather.cond_45'),    // 45  thundershowers
            $.i18n.t('plugins_ds.yahooweather.cond_46'),    // 46  snow showers
            $.i18n.t('plugins_ds.yahooweather.cond_47')     // 47  isolated thundershowers
        ];

        function updateRefresh(refreshTime) {
            if (updateTimer) {
                clearInterval(updateTimer);
            }

            updateTimer = setInterval(function () {
                self.updateNow();
            }, refreshTime);
        }

        this.updateNow = function () {
            var units = (currentSettings.units === 'metric') ? 'c' : 'f';
            var query = "select * from weather.bylocation where location='" + currentSettings.location + "' and unit='" + units + "'";
            var uri = 'https://query.yahooapis.com/v1/public/yql?q=' +
                    encodeURIComponent(query) +
                    '&format=json&env=' +
                    encodeURIComponent('store://datatables.org/alltableswithkeys');
            $.ajax({
                url: uri,
                dataType: 'JSONP'
            })
            .done(function (data) {
                if (!_.isObject(data))
                    return;
                if (_.has(data, 'error')) {
                    console.error('Yahoo Weather API error: ' + data.error.description);
                    return;
                }
                if (!_.has(data, 'query') && _.has(data, 'query.results'))
                    return;
                data = data.query.results.weather.rss.channel;
                var easy = {
                    place_name: _.isUndefined(data.location.city) ? '' : data.location.city,
                    latitude: Number(data.item.lat),
                    longitude: Number(data.item.long),
                    sunrise: data.astronomy.sunrise,
                    sunset: data.astronomy.sunset,
                    conditions: conditionMap[data.item.condition.code],
                    current_temp: Number(data.item.condition.temp),
                    high_temp: Number(data.item.forecast[0].high),
                    low_temp: Number(data.item.forecast[0].low),
                    pressure: Number(data.atmosphere.pressure),
                    humidity: Number(data.atmosphere.humidity),
                    wind_speed: Number(data.wind.speed),
                    wind_direction: Number(data.wind.direction)
                };
                updateCallback(_.merge(data, easy));
            })
            .fail(function (xhr, status) {
                console.error('Yahoo Weather API error: ' + status);
            });
        };

        this.onDispose = function () {
            clearInterval(updateTimer);
            updateTimer = null;
        };

        this.onSettingsChanged = function (newSettings) {
            currentSettings = newSettings;
            self.updateNow();
            updateRefresh(currentSettings.refresh * 1000);
        };

        updateRefresh(currentSettings.refresh * 1000);
    };

    freeboard.loadDatasourcePlugin({
        type_name: 'yahooweather',
        display_name: $.i18n.t('plugins_ds.yahooweather.display_name'),
        description: $.i18n.t('plugins_ds.yahooweather.description'),
        settings: [
            {
                name: 'location',
                display_name: $.i18n.t('plugins_ds.yahooweather.location'),
                validate: 'required,maxSize[100]',
                type: 'text',
                description: $.i18n.t('plugins_ds.yahooweather.location_desc')
            },
            {
                name: 'units',
                display_name: $.i18n.t('plugins_ds.yahooweather.units'),
                style: 'width:200px',
                type: 'option',
                default_value: 'metric',
                options: [
                    {
                        name: $.i18n.t('plugins_ds.yahooweather.units_metric'),
                        value: 'metric'
                    },
                    {
                        name: $.i18n.t('plugins_ds.yahooweather.units_imperial'),
                        value: 'imperial'
                    }
                ]
            },
            {
                name: 'refresh',
                display_name: $.i18n.t('plugins_ds.yahooweather.refresh'),
                validate: 'required,custom[integer],min[30]',
                style: 'width:100px',
                type: 'number',
                suffix: $.i18n.t('plugins_ds.yahooweather.refresh_suffix'),
                default_value: 30
            }
        ],
        newInstance: function (settings, newInstanceCallback, updateCallback) {
            newInstanceCallback(new yahooWeatherDatasource(settings, updateCallback));
        }
    });
}());
// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

(function () {
    'use strict';

    var openWeatherMapDatasource = function (settings, updateCallback) {
        var self = this;
        var updateTimer = null;
        var currentSettings = settings;

        function updateRefresh(refreshTime) {
            if (updateTimer) {
                clearInterval(updateTimer);
            }

            updateTimer = setInterval(function () {
                self.updateNow();
            }, refreshTime);
        }

        function toTitleCase(str) {
            return str.replace(/\w\S*/g, function (txt) {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            });
        }

        updateRefresh(currentSettings.refresh * 1000);

        this.updateNow = function () {
            $.ajax({
                url: "http://api.openweathermap.org/data/2.5/weather?q=" + encodeURIComponent(currentSettings.location) + "&units=" + currentSettings.units,
                dataType: "JSONP",
            })
            .done(function (data) {
                // Rejigger our data into something easier to understand
                var easy = {
                    place_name: data.name,
                    latitude: data.coord.lat,
                    longitude: data.coord.lon,
                    sunset: moment.unix(data.sys.sunset * 1000).format('HH:mm:ss'), // Bug value the opposite
                    sunrise: moment.unix(data.sys.sunrise * 1000).format('HH:mm:ss'),
                    conditions: toTitleCase(data.weather[0].description),
                    current_temp: data.main.temp,
                    high_temp: data.main.temp_max,
                    low_temp: data.main.temp_min,
                    pressure: data.main.pressure,
                    humidity: data.main.humidity,
                    wind_speed: data.wind.speed,
                    wind_direction: data.wind.deg
                };
                updateCallback(_.merge(data, easy));
            })
            .fail(function (xhr, status) {
                console.error('Open Weather Map API error: ' + status);
            });
        };

        this.onDispose = function () {
            clearInterval(updateTimer);
            updateTimer = null;
        };

        this.onSettingsChanged = function (newSettings) {
            currentSettings = newSettings;
            self.updateNow();
            updateRefresh(currentSettings.refresh * 1000);
        };
    };

    freeboard.loadDatasourcePlugin({
        type_name: "openweathermap",
        display_name: $.i18n.t('plugins_ds.owm.display_name'),
        description: $.i18n.t('plugins_ds.owm.description'),
        settings: [
            {
                name: "location",
                display_name: $.i18n.t('plugins_ds.owm.location'),
                validate: "required,maxSize[200]",
                type: "text",
                description: $.i18n.t('plugins_ds.owm.location_desc')
            },
            {
                name: "units",
                display_name: $.i18n.t('plugins_ds.owm.units'),
                style: "width:200px",
                type: "option",
                default_value: "metric",
                options: [
                    {
                        name: $.i18n.t('plugins_ds.owm.units_metric'),
                        value: "metric"
                    },
                    {
                        name: $.i18n.t('plugins_ds.owm.units_imperial'),
                        value: "imperial"
                    }
                ]
            },
            {
                name: "refresh",
                display_name: $.i18n.t('plugins_ds.owm.refresh'),
                validate: "required,custom[integer],min[5]",
                style: "width:100px",
                type: "number",
                suffix: $.i18n.t('plugins_ds.owm.refresh_suffix'),
                default_value: 5
            }
        ],
        newInstance: function (settings, newInstanceCallback, updateCallback) {
            newInstanceCallback(new openWeatherMapDatasource(settings, updateCallback));
        }
    });
}());
// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

(function () {
    'use strict';

    var playbackDatasource = function (settings, updateCallback) {
        var self = this;
        var currentSettings = settings;
        var currentDataset = [];
        var currentIndex = 0;
        var currentTimeout;

        function moveNext() {
            if (currentDataset.length > 0) {
                if (currentIndex < currentDataset.length) {
                    updateCallback(currentDataset[currentIndex]);
                    currentIndex++;
                }

                if (currentIndex >= currentDataset.length && currentSettings.loop) {
                    currentIndex = 0;
                }

                if (currentIndex < currentDataset.length) {
                    currentTimeout = setTimeout(moveNext, currentSettings.refresh * 1000);
                }
            }
            else {
                updateCallback({});
            }
        }

        function stopTimeout() {
            currentDataset = [];
            currentIndex = 0;

            if (currentTimeout) {
                clearTimeout(currentTimeout);
                currentTimeout = null;
            }
        }

        this.updateNow = function () {
            stopTimeout();

            $.ajax({
                url: currentSettings.datafile,
                dataType: (currentSettings.is_jsonp) ? 'JSONP' : 'JSON',
                success: function (data) {
                    if (_.isArray(data))
                        currentDataset = data;
                    else
                        currentDataset = [];

                    currentIndex = 0;

                    moveNext();
                },
                error: function (xhr, status, error) {
                }
            });
        };

        this.onDispose = function () {
            stopTimeout();
        };

        this.onSettingsChanged = function (newSettings) {
            currentSettings = newSettings;
            self.updateNow();
        };
    };

    freeboard.loadDatasourcePlugin({
        type_name: 'playback',
        display_name: $.i18n.t('plugins_ds.playback.display_name'),
        description: $.i18n.t('plugins_ds.playback.description'),
        settings: [
            {
                name: 'datafile',
                display_name: $.i18n.t('plugins_ds.playback.datafile'),
                validate: 'required,custom[url]',
                type: 'text',
                description: $.i18n.t('plugins_ds.playback.datafile_desc')
            },
            {
                name: 'is_jsonp',
                display_name: $.i18n.t('plugins_ds.playback.is_jsonp'),
                type: 'boolean'
            },
            {
                name: 'loop',
                display_name: $.i18n.t('plugins_ds.playback.loop'),
                type: 'boolean',
                description: $.i18n.t('plugins_ds.playback.loop_desc'),
            },
            {
                name: 'refresh',
                display_name: $.i18n.t('plugins_ds.playback.refresh'),
                validate: 'required,custom[integer],min[1]',
                style: 'width:100px',
                type: 'number',
                suffix: $.i18n.t('plugins_ds.playback.refresh_suffix'),
                default_value: 5
            }
        ],
        newInstance: function (settings, newInstanceCallback, updateCallback) {
            newInstanceCallback(new playbackDatasource(settings, updateCallback));
        }
    });
}());
// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

(function() {
    'use strict';

    var wsDatasource = function(settings, updateCallback) {
        var self = this;

        var currentSettings = settings;
        var ws;
        var dispose = false;
        var CONNECTION_DELAY = 3000;

        function wsOpen() {
            ws = new WebSocket(currentSettings.uri);

            ws.onopen = function(evt) {
                console.info('WebSocket Connected to %s', ws.url);
            };

            ws.onclose = function(evt) {
                console.info('WebSocket Disconnected from %s', evt.srcElement.url);
                if (dispose === false && currentSettings.reconnect === true) {
                    _.delay(function() {
                        wsOpen();
                    }, CONNECTION_DELAY);
                }
            };

            ws.onmessage = function(evt) {
                try {
                    var obj = JSON.parse(evt.data);
                    updateCallback(obj);
                } catch (e) {
                    console.error('WebSocket Bad parse', evt.data);
                }
            };

            ws.onerror = function(evt) {
                console.error('WebSocket Error', evt);
            };
        }

        function wsClose() {
            if (ws) {
                ws.close();
                ws = null;
            }
        }

        this.updateNow = function() {
        };

        this.onDispose = function() {
            dispose = true;
            wsClose();
        };

        this.onSettingsChanged = function(newSettings) {
            var reconnect = newSettings.reconnect;

            // Set to not reconnect
            currentSettings.reconnect = false;
            wsClose();
            _.delay(function() {
                currentSettings = newSettings;
                currentSettings.reconnect = reconnect;
                wsOpen();
            }, CONNECTION_DELAY);
        };

        wsOpen();
    };

    freeboard.loadDatasourcePlugin({
        type_name: 'websocket',
        display_name: $.i18n.t('plugins_ds.websocket.display_name'),
        description: $.i18n.t('plugins_ds.websocket.description'),
        settings: [
            {
                name: 'uri',
                display_name: $.i18n.t('plugins_ds.websocket.uri'),
                validate: 'required,maxSize[1000]',
                type: 'text',
                description: $.i18n.t('plugins_ds.websocket.uri_desc'),
            },
            {
                name: 'reconnect',
                display_name: $.i18n.t('plugins_ds.websocket.reconnect'),
                type: 'boolean',
                default_value: true
            }
        ],
        newInstance: function(settings, newInstanceCallback, updateCallback) {
            newInstanceCallback(new wsDatasource(settings, updateCallback));
        }
    });
}());

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2014 Hugo Sequeira (https://github.com/hugocore)                                   │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

(function() {
    'use strict';

    var nodeJSDatasource = function(settings, updateCallback) {

        var self = this,
            currentSettings = settings,
            url,
            socket,
            newMessageCallback;

        function onNewMessageHandler(message) {
            var objdata = JSON.parse(message);
            if (_.isObject('object'))
                updateCallback(objdata);
            else
                updateCallback(message);
        }

        function joinRoom(roomName, roomEvent) {
            // Sends request to join the new room
            // (handle event on server-side)
            self.socket.emit(roomEvent, roomName);
            console.info('Joining room "%s" with event "%s"', roomName, roomEvent);
        }

        function discardSocket() {
            // Disconnect datasource websocket
            if (self.socket)
                self.socket.disconnect();
        }

        function connectToServer(url, rooms) {
            // Establish connection with server
            self.url = url;
            self.socket = io.connect(self.url,{'forceNew':true});

            // Join the rooms
            self.socket.on('connect', function() {
                console.info('Connecting to Node.js at: %s', self.url);
            });

            // Join the rooms
            _.each(rooms, function(roomConfig) {
                var roomName = roomConfig.roomName;
                var roomEvent = roomConfig.roomEvent;

                if (!_.isUndefined(roomName) && !_.isUndefined(roomEvent)) {
                    joinRoom(roomName, roomEvent);
                }

            });

            self.socket.on('connect_error', function(object) {
                console.error('It was not possible to connect to Node.js at: %s', self.url);
            });

            self.socket.on('reconnect_error', function(object) {
                console.error('Still was not possible to re-connect to Node.js at: %s', self.url);
            });

            self.socket.on('reconnect_failed', function(object) {
                console.error('Re-connection to Node.js failed at: %s', self.url);
                discardSocket();
            });

        }


        function initializeDataSource() {
            // Reset connection to server
            discardSocket();
            connectToServer(currentSettings.url, currentSettings.rooms);

            // Subscribe to the events
            var newEventName = currentSettings.eventName;
            self.newMessageCallback = onNewMessageHandler;
            _.each(currentSettings.events, function(eventConfig) {
                var event = eventConfig.eventName;
                console.info('Subscribing to event: %s', event);
                self.socket.on(event, function(message) {
                    self.newMessageCallback(message);
                });
            });
        }

        this.updateNow = function() {
            // Just seat back, relax and wait for incoming events
            return;
        };

        this.onDispose = function() {
            // Stop responding to messages
            self.newMessageCallback = function(message) {
                return;
            };
            discardSocket();
        };

        this.onSettingsChanged = function(newSettings) {
            currentSettings = newSettings;
            initializeDataSource();
        };

        initializeDataSource();
    };

    freeboard.loadDatasourcePlugin({
        type_name : 'node_js',
        display_name : $.i18n.t('plugins_ds.node_js.display_name'),
        description : $.i18n.t('plugins_ds.node_js.description'),
        external_scripts : [ 'https://cdn.socket.io/socket.io-1.2.1.js' ],
        settings : [
            {
                name: 'url',
                display_name: $.i18n.t('plugins_ds.node_js.url'),
                validate: 'required,maxSize[1000]',
                type: 'text',
                description: $.i18n.t('plugins_ds.node_js.url_desc')
            },
            {
                name : 'events',
                display_name : $.i18n.t('plugins_ds.node_js.events'),
                description : $.i18n.t('plugins_ds.node_js.events_desc'),
                type : 'array',
                settings : [ {
                    name : 'eventName',
                    display_name : $.i18n.t('plugins_ds.node_js.event_name'),
                    validate: 'optional,maxSize[100]',
                    type: 'text'
                } ]
            },
            {
                name : 'rooms',
                display_name : $.i18n.t('plugins_ds.node_js.rooms'),
                description : $.i18n.t('plugins_ds.node_js.rooms_desc'),
                type : 'array',
                settings : [ {
                    name : 'roomName',
                    display_name : $.i18n.t('plugins_ds.node_js.room_name'),
                    validate: 'optional,maxSize[100]',
                    type: 'text'
                }, {
                    name : 'roomEvent',
                    display_name : $.i18n.t('plugins_ds.node_js.room_event'),
                    validate: 'optional,maxSize[100]',
                    type: 'text'
                } ]
            }
        ],
        newInstance : function(settings, newInstanceCallback, updateCallback) {
            newInstanceCallback(new nodeJSDatasource(settings, updateCallback));
        }
    });
}());

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

(function() {
    'use strict';

    var mqttDatasource = function(settings, updateCallback) {

        var self = this;
        var currentSettings = settings;
        var client;
        var dispose = false;
        var CONNECTION_DELAY = 3000;

        function onConnect(frame) {
            console.info('MQTT Connected to %s', currentSettings.hostname);
            client.subscribe(_.isUndefined(currentSettings.topic) ? '' : currentSettings.topic);
        }

        function onConnectionLost(responseObject) {
            console.info('MQTT ConnectionLost %s %s', currentSettings.hostname, responseObject.errorMessage);
            if (dispose === false) {
                if (dispose === false && currentSettings.reconnect === true) {
                    _.delay(function() {
                        connect();
                    }, CONNECTION_DELAY);
                }
            }
        }

        function onConnectFailure(error) {
            client = null;
            console.error('MQTT Failed Connect to %s', currentSettings.hostname);
        }

        function onMessageArrived(message) {
            console.info('MQTT Received %s from %s', message,  currentSettings.hostname);

            var objdata = JSON.parse(message.payloadString);
            if (_.isObject('object')) {
                updateCallback(objdata);
            } else {
                updateCallback(message.payloadString);
            }
        }

        function disconnect() {
            if (client) {
                client.disconnect();
                client = null;
            }
        }

        function connect() {
            try {
                client = new Paho.MQTT.Client(
                    _.isUndefined(currentSettings.hostname) ? '' : currentSettings.hostname,
                    _.isUndefined(currentSettings.port) ? '' : currentSettings.port,
                    _.isUndefined(currentSettings.clientID) ? '' : currentSettings.clientID);
                client.onConnect = onConnect;
                client.onMessageArrived = onMessageArrived;
                client.onConnectionLost = onConnectionLost;
                client.connect({
                    userName: _.isUndefined(currentSettings.username) ? '' : currentSettings.username,
                    password: _.isUndefined(currentSettings.password) ? '' : currentSettings.password,
                    onSuccess: onConnect,
                    onFailure: onConnectFailure
                });
            } catch (e) {
                console.error(e);
            }
        }

        this.updateNow = function() {
        };

        this.onDispose = function() {
            dispose = true;
            disconnect();
        };

        this.onSettingsChanged = function(newSettings) {
            var reconnect = newSettings.reconnect;

            // Set to not reconnect
            currentSettings.reconnect = false;
            disconnect();
            _.delay(function() {
                currentSettings = newSettings;
                currentSettings.reconnect = reconnect;
                connect();
            }, CONNECTION_DELAY);
        };

        connect();
    };

    freeboard.loadDatasourcePlugin({
        type_name : 'mqtt',
        display_name : $.i18n.t('plugins_ds.mqtt.display_name'),
        description : $.i18n.t('plugins_ds.mqtt.description'),
        external_scripts : [ 'plugins/thirdparty/mqttws31.min.js' ],
        settings : [
            {
                name : 'hostname',
                display_name : $.i18n.t('plugins_ds.mqtt.hostname'),
                validate: 'required,maxSize[1000]',
                type: 'text',
                description: $.i18n.t('plugins_ds.mqtt.hostname_desc'),
            },
            {
                name : 'port',
                display_name : $.i18n.t('plugins_ds.mqtt.port'),
                validate: 'required,custom[integer],min[1]',
                type: 'number',
                style: 'width:100px',
                default_value: 8080
            },
            {
                name : 'clientID',
                display_name : $.i18n.t('plugins_ds.mqtt.clientID'),
                validate: 'required,maxSize[23]',
                type: 'text',
                description: $.i18n.t('plugins_ds.mqtt.clientID_desc'),
                default_value: 'SensorCorpus'
            },
            {
                name : 'topic',
                display_name : $.i18n.t('plugins_ds.mqtt.topic'),
                validate: 'required,maxSize[500]',
                type: 'text',
                description: $.i18n.t('plugins_ds.mqtt.topic_desc'),
                default_value: ''
            },
            {
                name : 'username',
                display_name : $.i18n.t('plugins_ds.mqtt.username'),
                validate: 'optional,maxSize[100]',
                type: 'text',
                description: $.i18n.t('plugins_ds.mqtt.username_desc')
            },
            {
                name : 'password',
                display_name : $.i18n.t('plugins_ds.mqtt.password'),
                validate: 'optional,maxSize[100]',
                type: 'text',
                description: $.i18n.t('plugins_ds.mqtt.password_desc'),
            },
            {
                name: 'reconnect',
                display_name: $.i18n.t('plugins_ds.mqtt.reconnect'),
                type: 'boolean',
                default_value: true
            }
        ],
        newInstance : function(settings, newInstanceCallback, updateCallback) {
            newInstanceCallback(new mqttDatasource(settings, updateCallback));
        }
    });
}());

// ┌─────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                │ \\
// ├─────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                       │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                             │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                  │ \\
// ├─────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                  │ \\
// └─────────────────────────────────────────┘ \\

(function() {
    'use strict';

    freeboard.addStyle('.tw-tooltip',
            'position: absolute;' +
            'font-size: 0.7em;' +
            'color: black;' +
            'text-align: center;' +
            'height: 20px;' +
            'padding: 2px 8px 2px 8px;' +
            'background: white;' +
            'opacity: 0.8;' +
            'pointer-events: none;' +
            '-webkit-box-shadow: 0 0 5px #000;' +
            '-moz-box-shadow: 0 0 5px #000;' +
            'box-shadow: 0 0 5px #000;'
            );

    var textWidget = function (settings) {
        var self = this;
        var BLOCK_HEIGHT = 60;
        var PADDING = 10;

        var currentSettings = settings;

        var currentID = _.uniqueId('textwidget_');
        var titleElement = $('<h2 class="section-title"></h2>');
        var widgetElement = $('<div class="text-widget" id="' + currentID + '"></div>');

        var option = {
            class: 'ultralight-text',
            fontColor: '#d3d4d4',
            decimal: 0,
            comma: 0,
            metricPrefix: false,
            transition: {
                enable: true,
                type: 'circle-out',
                duration: 500
            },
            chart: {
                type: 'line',
                margin: { left: 3, right: 3, bottom: 5 },
                xTickcount: 100,
                transition: {
                    type: 'circle-out',
                    duration: 500
                },
                lineWidth: 2,
                spotsize: 3.3,
                color: '#ff9900',
                spotcolor: {
                    def: '#FF0000',
                    max: '#0496ff',
                    min: '#0496ff'
                }
            }
        };

        var d3var = {
            svg: null,
            gText: null,
            gChart: null,
            textValue: null,
            textUnits: null,
            chart: {
                minValIndex: -1,
                maxValIndex: -1,
                highlightIndex: -1,
                height: 0,
                width: 0,
                xScale: null,
                xRevScale: null,
                xBarScale: null,
                yScale: null,
                line: null,
                area: null,
                data: null,
                gTooltip: null,
            }
        };

        function getFontSize() {
            return (currentSettings.size === 'big') ? '4.3em' : '1.95em';
        }

        function getUnitDy() {
            return (currentSettings.size === 'big') ? '1.4em' : '.6em';
        }

        function getTextY(height) {
            if (currentSettings.size === 'big')
                return (currentSettings.chart === true) ? (height/2.5) : height/2;
            else
                return (currentSettings.chart === true) ? (height/4) : height/2;
        }

        function getText(value) {
            var text;
            if (_.isNumber(value)) {
                if (option.metricPrefix) {
                    var prefix = d3.formatPrefix(value);
                    text = prefix.scale(value).toFixed(option.decimal) + prefix.symbol;
                } else {
                    var f;
                    if (option.comma === true)
                        f = d3.format(',.' + option.decimal + 'f');
                    else
                        f = d3.format('.' + option.decimal + 'f');
                    text = f(value);
                }
            } else {
                text = value;
            }
            return text;
        }

        function getChartHeight(rc) {
            return (currentSettings.size === 'big') ? rc.height/3.2 : rc.height/1.8;
        }

        function getChartWidth(rc) {
            return rc.width - (option.chart.margin.left + option.chart.margin.right);
        }

        function getChartTranslateText(rc) {
            var transX = option.chart.margin.left;
            var transY = rc.height - d3var.chart.height - option.chart.margin.bottom;
            return 'translate(' + transX + ', ' + transY + ')';
        }

        function getChartForPath() {
            var chart = null;
            switch (option.chart.type) {
            case 'line':
                chart = d3var.chart.line;
                break;
            case 'area':
                chart = d3var.chart.area;
                break;
            }
            return chart;
        }

        function resize() {
            if (_.isNull(d3var.svg))
                return;

            var rc = widgetElement[0].getBoundingClientRect();

            d3var.svg.attr('height', rc.height);
            d3var.svg.attr('width', rc.width);

            d3var.gText.attr('transform', 'translate(0,' + getTextY(rc.height) + ')');

            if (currentSettings.chart) {
                d3var.chart.height = getChartHeight(rc);
                d3var.chart.width = getChartWidth(rc);

                d3var.chart.xScale.range([0, d3var.chart.width]);
                d3var.chart.yScale.range([d3var.chart.height, 0]);

                d3var.chart.xRevScale.domain(d3var.chart.xScale.range());

                d3var.gChart.attr('transform', getChartTranslateText(rc));

                switch (option.chart.type) {
                case 'line':
                case 'area':
                    d3var.gChart.select('path')
                            .attr('d', getChartForPath())
                            .attr('transform', null);

                    d3var.gChart.select('.overlay')
                            .attr('width', d3var.chart.width)
                            .attr('height', d3var.chart.height);

                    d3var.gChart.selectAll('.spot')
                            .attr('cx', function(d, i) { return d3var.chart.xScale(i); })
                            .attr('cy', function(d, i) { return d3var.chart.yScale(d); });
                    break;
                case 'bar':
                    d3var.chart.xBarScale.rangeRoundBands([0, d3var.chart.width], 0.1);
                    d3var.gChart.selectAll('.bar')
                            .attr('x', function(d, i) { return d3var.chart.xScale(i); })
                            .attr('width', d3var.chart.xBarScale.rangeBand())
                            .attr('y', function(d, i) { return d < 0 ? d3var.chart.yScale(0) : d3var.chart.yScale(d); })
                            .attr('height', function(d, i) { return Math.abs(d3var.chart.yScale(d) - d3var.chart.yScale(0)); });
                    break;
                }
            }
        }

        function showTooltip(x) {
            updateTooltip(x);
            d3var.gChart.gTooltip.style('display', 'inline');

        }

        function hideTooltip() {
            d3var.gChart.gTooltip.style('display', 'none');
        }

        function updateTooltip(x) {
            d3var.chart.highlightIndex = Math.round(d3var.chart.xRevScale(x));
            var val = d3var.chart.data[d3var.chart.highlightIndex];
            d3var.gChart.gTooltip.html(getText(val) + ' ' + currentSettings.units)
                        .style('left', (d3.event.pageX + 10) + 'px')
                        .style('top', (d3.event.pageY - 28) + 'px');
        }

        function highlightSpot(x, show) {
            var _hide = function(idx) {
                if (idx === -1)
                    return;
                if (idx === d3var.chart.minValIndex || idx === d3var.chart.maxValIndex) {
                    var clr = (idx === d3var.chart.minValIndex) ? option.chart.spotcolor.min : option.chart.spotcolor.max;
                    d3.select(d3var.gChart.selectAll('.spot')[0][idx])
                                .attr('fill', clr);
                    return;
                }
                d3.select(d3var.gChart.selectAll('.spot')[0][idx]).style('display', 'none');
            };

            if (show) {
                _hide(d3var.chart.highlightIndex);
                d3var.chart.highlightIndex = Math.round(d3var.chart.xRevScale(x));
                d3.select(d3var.gChart.selectAll('.spot')[0][d3var.chart.highlightIndex])
                            .style('display', 'block')
                            .attr('fill', option.chart.spotcolor.def);
            } else {
                _hide(d3var.chart.highlightIndex);
                d3var.chart.highlightIndex = -1;
            }
        }

        function createChart(rc) {
            destroyChart();

            d3var.chart.height = getChartHeight(rc);
            d3var.chart.width = getChartWidth(rc);

            d3var.chart.data = [];

            d3var.chart.xScale = d3.scale.linear()
                .range([0, d3var.chart.width]);

            d3var.chart.xRevScale = d3.scale.linear()
                .range(d3var.chart.xScale.domain());

            d3var.chart.yScale = d3.scale.linear()
                .range([d3var.chart.height, 0]);

            d3var.gChart = d3var.svg.insert('g', 'g')
                .attr('transform', getChartTranslateText(rc));

            switch (option.chart.type) {
            case 'line':
                d3var.chart.line = d3.svg.line()
                    .interpolate('linear')
                    .x(function(d, i) { return d3var.chart.xScale(i); })
                    .y(function(d, i) { return d3var.chart.yScale(d); });
                d3var.gChart.append('path')
                    .datum(d3var.chart.data)
                    .attr('d', d3var.chart.line)
                    .attr('fill', 'none')
                    .attr('stroke', option.chart.color)
                    .attr('stroke-width', option.chart.lineWidth + 'px');
                break;
            case 'area':
                d3var.chart.area = d3.svg.area()
                    .x(function(d, i) { return d3var.chart.xScale(i); })
                    .y0(function(d, i) { return d3var.chart.yScale(0); })
                    .y1(function(d, i) { return d3var.chart.yScale(d); });
                d3var.gChart.append('path')
                    .datum(d3var.chart.data)
                    .attr('d', d3var.chart.area)
                    .attr('fill', option.chart.color);
                break;
            case 'bar':
                d3var.chart.xBarScale = d3.scale.ordinal()
                    .rangeRoundBands([0, d3var.chart.width], 0.1);
                break;
            }

            switch (option.chart.type) {
            case 'line':
            case 'area':
                // overlay for tooltip
                d3var.gChart.append('rect')
                    .attr('class', 'overlay')
                    .attr('fill', 'none')
                    .attr('pointer-events', 'all')
                    .attr('width', d3var.chart.width)
                    .attr('height', d3var.chart.height)
                    .on('mousemove', function() {
                        var m = d3.mouse(this);
                        highlightSpot(m[0], true);
                        updateTooltip(m[0]);
                    })
                    .on('mouseover', function() {
                        var m = d3.mouse(this);
                        highlightSpot(m[0], true);
                        showTooltip(m[0]);
                    })
                    .on('mouseout', function() {
                        var m = d3.mouse(this);
                        highlightSpot(m[0], false);
                        hideTooltip();
                    });
                break;
            case 'bar':
                freeboard.addStyle('.bar:hover', 'fill: ' + option.chart.spotcolor.def);
                break;
            }

            d3var.gChart.gTooltip = d3.select('body').append('div')
                        .attr('class', 'tw-tooltip')
                        .style('display', 'none');
        }

        function destroyChart() {
            if (_.isNull(d3var.gChart))
                return;
            d3var.chart.data = d3var.chart.line = d3var.chart.area = null;
            d3var.chart.xScale = d3var.chart.xRevScale = d3var.chart.xBarScale = null;
            d3var.chart.minValIndex = d3var.chart.maxValIndex = -1;
            d3var.chart.highlightIndex = -1;
            d3var.gChart.gTooltip.remove();
            d3var.gChart.remove();
            d3var.gChart = null;
        }

        function createWidget() {
            var rc = widgetElement[0].getBoundingClientRect();

            d3var.svg = d3.select('#' + currentID)
                .append('svg')
                .attr('width', rc.width)
                .attr('height', rc.height);

            d3var.gText = d3var.svg.append('g')
                .attr('transform', 'translate(0,' + getTextY(rc.height) + ')');

            d3var.textValue = d3var.gText.append('text')
                .data([{ value: 0 }])
                .text('0')
                .attr('fill', option.fontColor)
                .attr('text-anchor', 'center')
                .attr('dy', '.3em')
                .attr('font-size', getFontSize())
                .attr('class', option.class);

            d3var.textUnits = d3var.gText.append('text')
                .text(currentSettings.units)
                .attr('fill', option.fontColor)
                .attr('text-anchor', 'central')
                .attr('dy', getUnitDy())
                .attr('font-size', '1em')
                .attr('class', option.class);

            moveTextUnits();

            if (currentSettings.chart)
                createChart(rc);
        }

        function moveTextUnits() {
            if (_.isNull(d3var.svg))
                return;
            d3var.textUnits.attr('x', d3var.textValue.node().getBBox().width + 10);
        }

        function valueTransition(val) {
            d3var.textValue.transition()
                .duration(option.transition.duration)
                .ease(option.transition.type)
                .tween('text', function(d) {
                    var i = d3.interpolate(d.value, val);
                    d.value = val;
                    return function(t) {
                        this.textContent = getText(i(t));
                        moveTextUnits();
                    };
                });
        }

        function lineAreaChartTransition(min, max) {
            var _getSpotColor = function(d, i) {
                if (d3var.chart.highlightIndex === i)
                    return option.chart.spotcolor.def;

                if (min === d) {
                    if (d3var.chart.minValIndex > -1) {
                        if (d3var.chart.minValIndex > i)
                            return 'none';
                    }
                    d3var.chart.minValIndex = i;
                    return option.chart.spotcolor.min;
                }

                if (max === d) {
                    if (d3var.chart.maxValIndex > -1) {
                        if (d3var.chart.maxValIndex > i)
                            return 'none';
                    }
                    d3var.chart.maxValIndex = i;
                    return option.chart.spotcolor.max;
                }
                return 'none';
            };

            var _getSpotDisplay = function(d, i) {
                if (d3var.chart.highlightIndex === i)
                    return 'block';
                if (min === max)
                    return 'none';
                if (min === d || max === d)
                    return 'block';
                return 'none';
            };

            d3var.gChart.selectAll('.spot')
                    .data(d3var.chart.data)
                .enter().insert('circle', '.overlay')
                    .attr('class', 'spot')
                    .style('display', 'none')
                    .attr({
                        cx: function(d, i) { return d3var.chart.xScale(i); },
                        cy: function(d, i) { return d3var.chart.yScale(d); },
                        r: option.chart.spotsize,
                        fill: 'none'
                    });

            if (d3var.chart.data.length > option.chart.xTickcount) {
                // remove first circle
                d3var.gChart.select('.spot').remove();
                d3var.chart.minValIndex--;
                d3var.chart.maxValIndex--;

                d3.transition()
                    .duration(option.chart.transition.duration)
                    .ease(option.chart.transition.type)
                    .each(function () {
                        d3var.gChart.select('path')
                                .attr('d', getChartForPath())
                                .attr('transform', null)
                            .transition()
                                .attr('transform', 'translate(' + d3var.chart.xScale(-1) + ')');

                        d3var.gChart.selectAll('.spot')
                                .style('display', function(d, i) { return _getSpotDisplay(d, i); })
                                .attr('fill', function(d, i) { return _getSpotColor(d, i); })
                                .attr('cy', function(d, i) { return d3var.chart.yScale(d); })
                            .transition()
                                .attr('cx', function(d, i) { return d3var.chart.xScale(i); });
                    });

                if (d3var.chart.data.length > option.chart.xTickcount)
                    d3var.chart.data.shift();
            } else {
                d3.transition()
                    .duration(option.chart.transition.duration)
                    .ease(option.chart.transition.type)
                    .each(function () {
                        d3var.gChart.selectAll('.spot')
                                .style('display', function(d, i) { return _getSpotDisplay(d, i); })
                                .attr('fill', function(d, i) { return _getSpotColor(d, i); })
                            .transition()
                                .attr('cx', function(d, i) { return d3var.chart.xScale(i); })
                                .attr('cy', function(d, i) { return d3var.chart.yScale(d); });

                        d3var.gChart.select('path').transition()
                                .attr('d', getChartForPath());
                    });
            }
        }

        function barChartTransition(min, max) {
            var _getBarColor = function(d, i) {
                if (min === max)
                    return option.chart.color;

                if (min === d) {
                    if (d3var.chart.minValIndex > -1) {
                        if (d3var.chart.minValIndex > i)
                            return option.chart.color;
                    }
                    d3var.chart.minValIndex = i;
                    return option.chart.spotcolor.min;
                }

                if (max === d) {
                    if (d3var.chart.maxValIndex > -1) {
                        if (d3var.chart.maxValIndex > i)
                            return option.chart.color;
                    }
                    d3var.chart.maxValIndex = i;
                    return option.chart.spotcolor.max;
                }
                return option.chart.color;
            };

            d3var.chart.xBarScale
                .domain(d3.range(d3var.chart.data.length-1));

            d3var.gChart.selectAll('.bar')
                    .data(d3var.chart.data)
                .enter().append('rect')
                    .attr('class', 'bar')
                    .attr('fill', function(d, i) { return _getBarColor(d, i); })
                    .attr('x', function(d, i) { return d3var.chart.xScale(i); })
                    .attr('width', d3var.chart.xBarScale.rangeBand())
                    .attr('y', function(d, i) { return d < 0 ? d3var.chart.yScale(0) : d3var.chart.yScale(d); })
                    .attr('height', function(d, i) { return Math.abs(d3var.chart.yScale(d) - d3var.chart.yScale(0)); })
                    .on('mousemove', function() { updateTooltip(d3.mouse(this)[0]); })
                    .on('mouseover', function() { showTooltip(d3.mouse(this)[0]); })
                    .on('mouseout', function() { hideTooltip(); });

            // remove first bar
            if (d3var.chart.data.length > option.chart.xTickcount) {
                d3var.gChart.select('.bar').remove();
                d3var.chart.minValIndex--;
                d3var.chart.maxValIndex--;
            }

            d3.transition()
                .duration(option.chart.transition.duration)
                .ease(option.chart.transition.type)
                .each(function () {
                    d3var.gChart.selectAll('.bar')
                        .transition()
                            .attr('fill', function(d, i) { return _getBarColor(d, i); })
                            .attr('x', function(d, i) { return d3var.chart.xScale(i); })
                            .attr('width', d3var.chart.xBarScale.rangeBand())
                            .attr('y', function(d, i) { return d < 0 ? d3var.chart.yScale(0) : d3var.chart.yScale(d); })
                            .attr('height', function(d, i) { return Math.abs(d3var.chart.yScale(d) - d3var.chart.yScale(0)); });
                });

            if (d3var.chart.data.length > option.chart.xTickcount)
                d3var.chart.data.shift();
        }

        function chartTransition(val) {
            d3var.chart.data.push(val);

            var minmax = d3.extent(d3var.chart.data);

            d3var.chart.xScale
                .domain([0, d3var.chart.data.length-1]);
            d3var.chart.yScale
                .domain(minmax)
                .range([d3var.chart.height, 0]);
            d3var.chart.xRevScale
                .range(d3var.chart.xScale.domain());

            switch (option.chart.type) {
            case 'line':
            case 'area':
                lineAreaChartTransition(minmax[0], minmax[1]);
                break;
            case 'bar':
                barChartTransition(minmax[0], minmax[1]);
                break;
            }
        }

        function refresh(value) {
            if (option.transition.enable && _.isNumber(value))
                valueTransition(value);
            else {
                d3var.textValue.text(getText(value));
                moveTextUnits();
            }

            if (!_.isNull(d3var.gChart) && _.isNumber(value))
                chartTransition(value);
        }

        function setBlocks(blocks) {
            if (_.isUndefined(blocks))
                return;
            var titlemargin = (titleElement.css('display') === 'none') ? 0 : titleElement.outerHeight();
            var height = (BLOCK_HEIGHT) * blocks - PADDING - titlemargin;
            widgetElement.css({
                height: height + 'px',
                width: '100%'
            });
            resize();
        }

        this.render = function (element) {
            $(element).append(titleElement).append(widgetElement);
            titleElement.html((_.isUndefined(currentSettings.title) ? '' : currentSettings.title));
            setBlocks(self.getHeight());
            createWidget();
        };

        this.onSettingsChanged = function (newSettings) {
            option.decimal = newSettings.decimal;
            option.comma = newSettings.comma;
            option.metricPrefix = newSettings.metric_prefix;
            option.transition.enable = newSettings.animate;
            option.chart.type = newSettings.chart_type;
            option.chart.color = newSettings.chart_color;
            option.chart.spotcolor.min = option.chart.spotcolor.max = newSettings.chart_minmax_color;

            if (_.isNull(d3var.svg)) {
                currentSettings = newSettings;
                return;
            }

            titleElement.html((_.isUndefined(newSettings.title) ? '' : newSettings.title));
            if (_.isUndefined(newSettings.title) || newSettings.title === '')
                titleElement.css('display', 'none');
            else
                titleElement.css('display', 'block');

            if (currentSettings.chart !== newSettings.chart ||
                currentSettings.chart_type !== newSettings.chart_type) {
                if (newSettings.chart || currentSettings.chart_type !== newSettings.chart_type)
                    createChart(widgetElement[0].getBoundingClientRect());
                else
                    destroyChart();
            }

            var updateCalculate = false;
            if (currentSettings.value != newSettings.value)
                updateCalculate = true;

            currentSettings = newSettings;

            setBlocks(self.getHeight());

            d3var.textUnits.text(currentSettings.units);
            d3var.textUnits.attr('dy', getUnitDy());
            d3var.textValue.attr('font-size', getFontSize());
            moveTextUnits();

            if (currentSettings.chart) {
                var selItem;

                switch (option.chart.type) {
                case 'line':
                    selItem = '.spot';
                    d3var.gChart.select('path').attr('stroke', option.chart.color);
                    break;
                case 'area':
                    selItem = '.spot';
                    d3var.gChart.select('path').attr('fill', option.chart.color);
                    break;
                case 'bar':
                    selItem = '.bar';
                    d3var.gChart.selectAll('.bar').attr('fill', option.chart.color);
                    break;
                }

                if (d3var.chart.minValIndex !== -1) {
                    d3.select(d3var.gChart.selectAll(selItem)[0][d3var.chart.minValIndex])
                                .attr('fill', option.chart.spotcolor.min);
                }
                if (d3var.chart.maxValIndex !== -1) {
                    d3.select(d3var.gChart.selectAll(selItem)[0][d3var.chart.maxValIndex])
                                .attr('fill', option.chart.spotcolor.max);
                }
            }
            return updateCalculate;
        };

        this.onCalculatedValueChanged = function (settingName, newValue) {
            if (settingName === 'value')
                refresh(newValue);
        };

        this.onSizeChanged = function() {
            resize();
        };

        this.onDispose = function () {
            if (!_.isNull(d3var.svg)) {
                destroyChart();
                d3var.gText.remove();
                d3var.gText = null;
                d3var.svg.remove();
                d3var.svg = null;
            }
        };

        this.getHeight = function () {
            return (currentSettings.size === 'big' || currentSettings.chart === true) ? 2 : 1;
        };

        this.onSettingsChanged(settings);
    };

    freeboard.loadWidgetPlugin({
        type_name: 'text_widget',
        display_name: $.i18n.t('plugins_wd.text.display_name'),
        description: $.i18n.t('plugins_wd.text.description'),
        settings: [
            {
                name: 'title',
                display_name: $.i18n.t('plugins_wd.text.title'),
                validate: 'optional,maxSize[100]',
                type: 'text',
                description: $.i18n.t('plugins_wd.text.title_desc')
            },
            {
                name: 'size',
                display_name: $.i18n.t('plugins_wd.text.size'),
                type: 'option',
                options: [
                    {
                        name: $.i18n.t('plugins_wd.text.size_options.regular'),
                        value: 'regular'
                    },
                    {
                        name: $.i18n.t('plugins_wd.text.size_options.big'),
                        value: 'big'
                    }
                ]
            },
            {
                name: 'value',
                display_name: $.i18n.t('plugins_wd.text.value'),
                validate: 'optional,maxSize[2000]',
                type: 'calculated',
                description: $.i18n.t('plugins_wd.text.value_desc')
            },
            {
                name: 'decimal',
                display_name: $.i18n.t('plugins_wd.text.decimal'),
                type: 'number',
                validate: 'required,custom[integer],min[0],max[20]',
                style: 'width:100px',
                default_value: 0
            },
            {
                name: 'comma',
                display_name: $.i18n.t('plugins_wd.text.comma'),
                type: 'boolean',
                default_value: false,
            },
            {
                name: 'metric_prefix',
                display_name: $.i18n.t('plugins_wd.text.metric_prefix'),
                type: 'boolean',
                default_value: false,
                description: $.i18n.t('plugins_wd.text.metric_prefix_desc')
            },
            {
                name: 'units',
                display_name: $.i18n.t('plugins_wd.text.units'),
                validate: 'optional,maxSize[20]',
                type: 'text',
                style: 'width:150px',
                description: $.i18n.t('plugins_wd.text.units_desc')
            },
            {
                name: 'animate',
                display_name: $.i18n.t('plugins_wd.text.animate'),
                type: 'boolean',
                default_value: true
            },
            {
                name: 'chart',
                display_name: $.i18n.t('plugins_wd.text.chart'),
                type: 'boolean'
            },
            {
                name: 'chart_type',
                display_name: $.i18n.t('plugins_wd.text.chart_type'),
                type: 'option',
                options: [
                    {
                        name: $.i18n.t('plugins_wd.text.chart_type_options.line'),
                        value: 'line'
                    },
                    {
                        name: $.i18n.t('plugins_wd.text.chart_type_options.area'),
                        value: 'area'
                    },
                    {
                        name: $.i18n.t('plugins_wd.text.chart_type_options.bar'),
                        value: 'bar'
                    }
                ]
            },
            {
                name: 'chart_color',
                display_name: $.i18n.t('plugins_wd.text.chart_color'),
                validate: 'required,custom[hexcolor]',
                type: 'color',
                default_value: '#ff9900',
                description: $.i18n.t('plugins_wd.text.chart_color_desc')
            },
            {
                name: 'chart_minmax_color',
                display_name: $.i18n.t('plugins_wd.text.chart_minmax_color'),
                validate: 'required,custom[hexcolor]',
                type: 'color',
                default_value: '#0496ff',
                description: $.i18n.t('plugins_wd.text.chart_minmax_color_desc')
            }
        ],
        newInstance: function (settings, newInstanceCallback) {
            newInstanceCallback(new textWidget(settings));
        }
    });
}());

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

(function() {
    'use strict';

    freeboard.addStyle('.gm-style-cc a', 'text-shadow:none;');

    var googleMapWidget = function (settings) {
        var self = this;
        var BLOCK_HEIGHT = 60;

        var currentSettings = settings;
        var map = null,
            marker = null,
            poly = null;
        var mapElement = $('<div></div>');
        var currentPosition = {};

        function updatePosition() {
            if (!_.isNull(map) && !_.isNull(marker) && currentPosition.lat && currentPosition.lon) {
                var newLatLon = new google.maps.LatLng(currentPosition.lat, currentPosition.lon);
                marker.setPosition(newLatLon);
                if (currentSettings.drawpath)
                    poly.getPath().push(newLatLon);
                map.panTo(newLatLon);
            }
        }

        function setBlocks(blocks) {
            if (_.isUndefined(mapElement) || _.isUndefined(blocks))
                return;
            var height = BLOCK_HEIGHT * blocks;
            mapElement.css({
                'height': height + 'px',
                'width': '100%'
            });
            if (!_.isNull(map)) {
                google.maps.event.trigger(mapElement[0], 'resize');
                updatePosition();
            }
        }

        function createWidget() {
            if (_.isUndefined(mapElement))
                return;

            function initializeMap() {
                var mapOptions = {
                    zoom: 13,
                    center: new google.maps.LatLng(37.235, -115.811111),
                    disableDefaultUI: true,
                    draggable: false
                };

                map = new google.maps.Map(mapElement[0], mapOptions);

                var polyOptions = {
                    strokeColor: '#0091D1',
                    strokeOpacity: 1.0,
                    strokeWeight: 3
                };

                poly = new google.maps.Polyline(polyOptions);
                poly.setMap(map);

                google.maps.event.addDomListener(mapElement[0], 'mouseenter', function (e) {
                    e.cancelBubble = true;
                    if (!map.hover) {
                        map.hover = true;
                        map.setOptions({zoomControl: true});
                    }
                });

                google.maps.event.addDomListener(mapElement[0], 'mouseleave', function (e) {
                    if (map.hover) {
                        map.setOptions({zoomControl: false});
                        map.hover = false;
                    }
                });

                marker = new google.maps.Marker({map: map});

                updatePosition();
            }

            if (window.google && window.google.maps) {
                initializeMap();
            } else {
                window.gmap_initialize = initializeMap;
                head.js('https://maps.googleapis.com/maps/api/js?v=3.exp&sensor=false&callback=gmap_initialize');
            }
        }

        this.render = function (element) {
            $(element).append(mapElement);
            setBlocks(currentSettings.blocks);
            createWidget();
        };

        this.onSettingsChanged = function (newSettings) {
            if (_.isNull(map)) {
                currentSettings = newSettings;
                return;
            }

            var updateCalculate = false;
            if (currentSettings.blocks != newSettings.blocks)
                setBlocks(newSettings.blocks);
            if (!newSettings.drawpath)
                poly.getPath().clear();

            if (currentSettings.lat != newSettings.lat || currentSettings.lon != newSettings.lon)
                updateCalculate = true;
            currentSettings = newSettings;
            return updateCalculate;
        };

        this.onCalculatedValueChanged = function (settingName, newValue) {
            if (settingName === 'lat')
                currentPosition.lat = newValue;
            else if (settingName === 'lon')
                currentPosition.lon = newValue;

            updatePosition();
        };

        this.onDispose = function () {
            // for memoryleak
            map = marker = poly = null;
        };

        this.onSizeChanged = function () {
            if (!_.isNull(map)) {
                google.maps.event.trigger(mapElement[0], 'resize');
                updatePosition();
            }
        };

        this.getHeight = function () {
            return currentSettings.blocks;
        };

        this.onSettingsChanged(settings);
    };

    freeboard.loadWidgetPlugin({
        type_name: 'google_map',
        display_name: $.i18n.t('plugins_wd.gmap.display_name'),
        description: $.i18n.t('plugins_wd.gmap.description'),
        fill_size: true,
        settings: [
            {
                name: 'blocks',
                display_name: $.i18n.t('plugins_wd.gmap.blocks'),
                validate: 'required,custom[integer],min[4],max[20]',
                type: 'number',
                style: 'width:100px',
                default_value: 4,
                description: $.i18n.t('plugins_wd.gmap.blocks_desc')
            },
            {
                name: 'lat',
                display_name: $.i18n.t('plugins_wd.gmap.lat'),
                validate: 'optional,maxSize[2000]',
                type: 'calculated',
                description: $.i18n.t('plugins_wd.gmap.lat_desc')
            },
            {
                name: 'lon',
                display_name: $.i18n.t('plugins_wd.gmap.lon'),
                validate: 'optional,maxSize[2000]',
                type: 'calculated',
                description: $.i18n.t('plugins_wd.gmap.lon_desc')
            },
            {
                name: 'drawpath',
                display_name: $.i18n.t('plugins_wd.gmap.drawpath'),
                type: 'boolean',
                default_value: false
            }
        ],
        newInstance: function (settings, newInstanceCallback) {
            newInstanceCallback(new googleMapWidget(settings));
        }
    });
}());

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

(function() {
    'use strict';

    freeboard.addStyle('.pointer-widget', 'width:100%;');

    var pointerWidget = function (settings) {
        var self = this;

        var CIRCLE_WIDTH = 3;
        var BLOCK_HEIGHT = 60;
        var PADDING = 10;

        var currentID = _.uniqueId('pointer_');
        var titleElement = $('<h2 class="section-title"></h2>');
        var widgetElement = $('<div class="pointer-widget" id="' + currentID + '"></div>');
        var currentSettings = settings;
        var fontcolor = '#d3d4d4';
        var widgetSize = {
            height: 0,
            width: 0
        };

        // d3 variables
        var svg = null, center = null, pointer = null, textValue = null, textUnits = null, circle = null;

        function setBlocks(blocks) {
            if (_.isUndefined(blocks))
                return;
            var titlemargin = (titleElement.css('display') === 'none') ? 0 : titleElement.outerHeight();
            var height = (BLOCK_HEIGHT) * blocks - PADDING - titlemargin;
            widgetElement.css({
                height: height + 'px',
                width: '100%'
            });
            resize();
        }

        function getWidgetSize(rc) {
            var h, w, aspect;
            if (rc.width > rc.height) {
                h = rc.height;
                w = h * 1.25;
                if (w > rc.width) {
                    aspect = w / rc.width;
                    w = w / aspect;
                    h = h / aspect;
                }
            } else if (rc.width < rc.height) {
                w = rc.width;
                h = w / 1.25;
                if (h > rc.height) {
                    aspect = w / rc.height;
                    h = h / aspect;
                    width = h / aspect;
                }
            } else {
                w = rc.width;
                h = w * 0.75;
            }
            return { height: h, width: w };
        }

        function polygonPath(points) {
            if (!points || points.length < 2)
                return [];
            var path;
            path = 'M'+points[0]+','+points[1];
            for (var i = 2; i < points.length; i += 2) {
                path += 'L'+points[i]+','+points[i+1];
            }
            path += 'Z';
            return path;
        }

        function getCenteringTransform(rc) {
            return 'translate(' + (rc.width/2) + ',' + (rc.height/2) + ')';
        }

        function getRadius(rc) {
            return Math.min(rc.height, rc.width) / 2 - CIRCLE_WIDTH * 2;
        }

        function calcValueFontSize(r) {
            return (5*r/102.5).toFixed(2);
        }

        function calcUnitsFontSize(r) {
            return (1.1*r/102.5).toFixed(2);
        }

        function getPointerPath(r) {
            return polygonPath([0, - r + CIRCLE_WIDTH, 15, -(r-20), -15, -(r-20)]);
        }

        function resize() {
            if (_.isNull(svg))
                return;

            var rc = widgetElement[0].getBoundingClientRect();
            var newSize = getWidgetSize(rc);

            svg.attr('height', rc.height);
            svg.attr('width', rc.width);

            var x = newSize.width / widgetSize.width;
            var y = newSize.height / widgetSize.height;

            center.attr('transform', getCenteringTransform(rc)+',scale('+x+', '+y+')');
        }

        function createWidget() {

            var rc = widgetElement[0].getBoundingClientRect();

            svg = d3.select('#' + currentID)
                .append('svg')
                .attr('width', rc.width)
                .attr('height', rc.height);

            center = svg.append('g')
                .attr('transform', getCenteringTransform(rc));

            widgetSize = getWidgetSize(rc);
            var r = getRadius(widgetSize);
            circle = center.append('circle')
                .attr('r', r)
                .style('fill', 'rgba(0, 0, 0, 0)')
                .style('stroke-width', CIRCLE_WIDTH)
                .style('stroke', currentSettings.circle_color);

            textValue = center.append('text')
                .text('0')
                .style('fill', fontcolor)
                .style('text-anchor', 'middle')
                .attr('dy', '.3em')
                .attr('font-size', calcValueFontSize(r) + 'em')
                .attr('class', 'ultralight-text');

            textUnits = center.append('text')
                .text(currentSettings.units)
                .style('fill', fontcolor)
                .style('text-anchor', 'middle')
                .attr('dy', '2.8em')
                .attr('font-size', calcUnitsFontSize(r) + 'em')
                .attr('class', 'ultralight-text');

            pointer = center.append('path')
                .style('fill', currentSettings.pointer_color)
                .attr('d', getPointerPath(r));
        }

        this.render = function (element) {
            $(element).append(titleElement).append(widgetElement);
            titleElement.html((_.isUndefined(currentSettings.title) ? '' : currentSettings.title));
            setBlocks(currentSettings.blocks);
            createWidget();
        };

        this.onSettingsChanged = function (newSettings) {
            if (_.isNull(svg)) {
                currentSettings = newSettings;
                return;
            }

            titleElement.html((_.isUndefined(newSettings.title) ? '' : newSettings.title));
            if (_.isUndefined(newSettings.title) || newSettings.title === '')
                titleElement.css('display', 'none');
            else
                titleElement.css('display', 'block');

            circle.style('stroke', newSettings.circle_color);
            pointer.style('fill', newSettings.pointer_color);
            textUnits.text((_.isUndefined(newSettings.units) ? '' : newSettings.units));
            setBlocks(newSettings.blocks);

            var updateCalculate = false;
            if (currentSettings.direction != newSettings.direction ||
                currentSettings.value_text != newSettings.value_text)
                updateCalculate = true;
            currentSettings = newSettings;
            return updateCalculate;
        };

        this.onCalculatedValueChanged = function (settingName, newValue) {
            if (_.isNull(svg))
                return;
            if (settingName === 'direction') {
                pointer.transition()
                    .duration(250)
                    .ease('bounce-out')
                    .attrTween('transform', function(d, i, a) {
                        return d3.interpolateString(a, 'rotate(' + parseInt(newValue) + ', 0, 0)');
                    });
            } else if (settingName === 'value_text') {
                if (_.isUndefined(newValue))
                    return;
                textValue.transition()
                    .duration(500)
                    .ease('circle-out')
                    .tween('text', function() {
                        var i = d3.interpolate(this.textContent, Number(newValue));
                        return function(t) {
                            this.textContent = i(t).toFixed(1);
                        };
                    });
            }
        };

        this.onDispose = function () {
            if (!_.isNull(svg)) {
                center.remove();
                center = null;
                svg.remove();
                svg = null;
            }
        };

        this.onSizeChanged = function () {
            resize();
        };

        this.getHeight = function () {
            return currentSettings.blocks;
        };

        this.onSettingsChanged(settings);
    };

    freeboard.loadWidgetPlugin({
        type_name: 'pointer',
        display_name: $.i18n.t('plugins_wd.pointer.display_name'),
        description: $.i18n.t('plugins_wd.pointer.description'),
        settings: [
            {
                name: 'title',
                display_name: $.i18n.t('plugins_wd.pointer.title'),
                validate: 'optional,maxSize[100]',
                type: 'text',
                description: $.i18n.t('plugins_wd.pointer.title_desc')
            },
            {
                name: 'blocks',
                display_name: $.i18n.t('plugins_wd.pointer.blocks'),
                validate: 'required,custom[integer],min[4],max[10]',
                type: 'number',
                style: 'width:100px',
                default_value: 4,
                description: $.i18n.t('plugins_wd.pointer.blocks_desc')
            },
            {
                name: 'direction',
                display_name: $.i18n.t('plugins_wd.pointer.direction'),
                validate: 'optional,maxSize[2000]',
                type: 'calculated',
                description: $.i18n.t('plugins_wd.pointer.direction_desc')
            },
            {
                name: 'value_text',
                display_name: $.i18n.t('plugins_wd.pointer.value_text'),
                validate: 'optional,maxSize[2000]',
                type: 'calculated',
                description: $.i18n.t('plugins_wd.pointer.value_text_desc')
            },
            {
                name: 'units',
                display_name: $.i18n.t('plugins_wd.pointer.units'),
                validate: 'optional,maxSize[20]',
                style: 'width:150px',
                type: 'text',
                description: $.i18n.t('plugins_wd.pointer.units_desc')
            },
            {
                name: 'circle_color',
                display_name: $.i18n.t('plugins_wd.pointer.circle_color'),
                validate: 'required,custom[hexcolor]',
                type: 'color',
                default_value: '#ff9900',
                description: $.i18n.t('plugins_wd.pointer.circle_color_desc')
            },
            {
                name: 'pointer_color',
                display_name: $.i18n.t('plugins_wd.pointer.pointer_color'),
                validate: 'required,custom[hexcolor]',
                type: 'color',
                default_value: '#fff',
                description: $.i18n.t('plugins_wd.pointer.pointer_color_desc')
            }
        ],
        newInstance: function (settings, newInstanceCallback) {
            newInstanceCallback(new pointerWidget(settings));
        }
    });
}());

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

(function() {
    'use strict';

    var gaugeWidget = function (settings) {
        var self = this;
        var BLOCK_HEIGHT = 60;

        var currentID = _.uniqueId('gauge-');
        var gaugeElement = $('<div class="gauge-widget" id="' + currentID + '"></div>');
        var gauge = null;

        var currentSettings = settings;

        function setBlocks(blocks) {
            if (_.isUndefined(blocks))
                return;
            var height = BLOCK_HEIGHT * blocks;
            gaugeElement.css({
                'height': height + 'px',
                'width': '100%'
            });
            if (!_.isNull(gauge))
                gauge.resize();
        }

        function createGauge() {
            if (!_.isNull(gauge)) {
                gauge.destroy();
                gauge = null;
            }

            gaugeElement.empty();

            gauge = new GaugeD3({
                bindto: currentID,
                title: {
                    text: currentSettings.title,
                    color: currentSettings.value_fontcolor,
                    class: 'normal-text'
                },
                value: {
                    val: 0,
                    min: (_.isUndefined(currentSettings.min_value) ? 0 : currentSettings.min_value),
                    max: (_.isUndefined(currentSettings.max_value) ? 0 : currentSettings.max_value),
                    color: currentSettings.value_fontcolor,
                    decimal: currentSettings.decimal,
                    comma: currentSettings.comma,
                    metricPrefix: currentSettings.metric_prefix,
                    metricPrefixDecimal: currentSettings.decimal,
                    metricPrefixMinMax: currentSettings.metric_prefix,
                    transition: currentSettings.animate,
                    hideMinMax: currentSettings.show_minmax ? false : true,
                    class: 'ultralight-text'
                },
                gauge: {
                    widthScale: currentSettings.gauge_width/100,
                    color: currentSettings.gauge_color,
                    type: currentSettings.type
                },
                label: {
                    text: currentSettings.units,
                    color: currentSettings.value_fontcolor,
                    class: 'normal-text'
                },
                level: {
                    colors: [ currentSettings.gauge_lower_color, currentSettings.gauge_mid_color, currentSettings.gauge_upper_color ]
                }
            });
        }

        this.render = function (element) {
            $(element).append(gaugeElement);
            setBlocks(currentSettings.blocks);
            createGauge();
        };

        this.onSettingsChanged = function (newSettings) {
            if (_.isNull(gauge)) {
                currentSettings = newSettings;
                return;
            }
            setBlocks(newSettings.blocks);

            var updateCalculate = false;

            if (currentSettings.title != newSettings.title ||
                currentSettings.type != newSettings.type ||
                currentSettings.value != newSettings.value ||
                currentSettings.decimal != newSettings.decimal ||
                currentSettings.comma != newSettings.comma ||
                currentSettings.metric_prefix != newSettings.metric_prefix ||
                currentSettings.animate != newSettings.animate ||
                currentSettings.units != newSettings.units ||
                currentSettings.value_fontcolor != newSettings.value_fontcolor ||
                currentSettings.gauge_upper_color != newSettings.gauge_upper_color ||
                currentSettings.gauge_mid_color != newSettings.gauge_mid_color ||
                currentSettings.gauge_lower_color != newSettings.gauge_lower_color ||
                currentSettings.gauge_color != newSettings.gauge_color ||
                currentSettings.gauge_width != newSettings.gauge_width ||
                currentSettings.show_minmax != newSettings.show_minmax ||
                currentSettings.min_value != newSettings.min_value ||
                currentSettings.max_value != newSettings.max_value) {
                updateCalculate = true;
                currentSettings = newSettings;
                createGauge();
            } else {
                currentSettings = newSettings;
            }
            return updateCalculate;
        };

        this.onCalculatedValueChanged = function (settingName, newValue) {
            if (!_.isNull(gauge))
                gauge.refresh(Number(newValue));
        };

        this.onDispose = function () {
            if (!_.isNull(gauge)) {
                gauge.destroy();
                gauge = null;
            }
        };

        this.onSizeChanged = function () {
            if (!_.isNull(gauge))
                gauge.resize();
        };

        this.getHeight = function () {
            return currentSettings.blocks;
        };

        this.onSettingsChanged(settings);
    };

    freeboard.loadWidgetPlugin({
        type_name: 'gauge',
        display_name: $.i18n.t('plugins_wd.gauge.display_name'),
        description: $.i18n.t('plugins_wd.gauge.description'),
        external_scripts : [
            'plugins/thirdparty/gauged3.min.js'
        ],
        settings: [
            {
                name: 'title',
                display_name: $.i18n.t('plugins_wd.gauge.title'),
                validate: 'optional,maxSize[100]',
                type: 'text',
                description: $.i18n.t('plugins_wd.gauge.title_desc')
            },
            {
                name: 'blocks',
                display_name: $.i18n.t('plugins_wd.gauge.blocks'),
                validate: 'required,custom[integer],min[4],max[10]',
                type: 'number',
                style: 'width:100px',
                default_value: 4,
                description: $.i18n.t('plugins_wd.gauge.blocks_desc')
            },
            {
                name: 'type',
                display_name: $.i18n.t('plugins_wd.gauge.type'),
                type: 'option',
                options: [
                    {
                        name: $.i18n.t('plugins_wd.gauge.type_options.half'),
                        value: 'half'
                    },
                    {
                        name: $.i18n.t('plugins_wd.gauge.type_options.quarter-left-top'),
                        value: 'quarter-left-top'
                    },
                    {
                        name: $.i18n.t('plugins_wd.gauge.type_options.quarter-right-top'),
                        value: 'quarter-right-top'
                    },
                    {
                        name: $.i18n.t('plugins_wd.gauge.type_options.quarter-left-bottom'),
                        value: 'quarter-left-bottom'
                    },
                    {
                        name: $.i18n.t('plugins_wd.gauge.type_options.quarter-right-bottom'),
                        value: 'quarter-right-bottom'
                    },
                    {
                        name: $.i18n.t('plugins_wd.gauge.type_options.threequarter-left-top'),
                        value: 'threequarter-left-top'
                    },
                    {
                        name: $.i18n.t('plugins_wd.gauge.type_options.threequarter-right-top'),
                        value: 'threequarter-right-top'
                    },
                    {
                        name: $.i18n.t('plugins_wd.gauge.type_options.threequarter-left-bottom'),
                        value: 'threequarter-left-bottom'
                    },
                    {
                        name: $.i18n.t('plugins_wd.gauge.type_options.threequarter-right-bottom'),
                        value: 'threequarter-right-bottom'
                    },
                    {
                        name: $.i18n.t('plugins_wd.gauge.type_options.threequarter-bottom'),
                        value: 'threequarter-bottom'
                    },
                    {
                        name: $.i18n.t('plugins_wd.gauge.type_options.donut'),
                        value: 'donut'
                    }
                ]
            },
            {
                name: 'value',
                display_name: $.i18n.t('plugins_wd.gauge.value'),
                validate: 'optional,maxSize[2000]',
                type: 'calculated',
                description: $.i18n.t('plugins_wd.gauge.value_desc')
            },
            {
                name: 'decimal',
                display_name: $.i18n.t('plugins_wd.gauge.decimal'),
                type: 'number',
                validate: 'required,custom[integer],min[0],max[4]',
                style: 'width:100px',
                default_value: 0
            },
            {
                name: 'comma',
                display_name: $.i18n.t('plugins_wd.gauge.comma'),
                type: 'boolean',
                default_value: false,
            },
            {
                name: 'metric_prefix',
                display_name: $.i18n.t('plugins_wd.gauge.metric_prefix'),
                type: 'boolean',
                default_value: false,
                description: $.i18n.t('plugins_wd.gauge.metric_prefix_desc'),
            },
            {
                name: 'animate',
                display_name: $.i18n.t('plugins_wd.gauge.animate'),
                type: 'boolean',
                default_value: true
            },
            {
                name: 'units',
                display_name: $.i18n.t('plugins_wd.gauge.units'),
                validate: 'optional,maxSize[20],custom[illegalEscapeChar]',
                style: 'width:150px',
                type: 'text',
                description: $.i18n.t('plugins_wd.gauge.units_desc')
            },
            {
                name: 'value_fontcolor',
                display_name: $.i18n.t('plugins_wd.gauge.value_fontcolor'),
                type: 'color',
                validate: 'required,custom[hexcolor]',
                default_value: '#d3d4d4',
                description: $.i18n.t('plugins_wd.gauge.value_fontcolor_desc')
            },
            {
                name: 'gauge_upper_color',
                display_name: $.i18n.t('plugins_wd.gauge.gauge_upper_color'),
                type: 'color',
                validate: 'required,custom[hexcolor]',
                default_value: '#ff0000',
                description: $.i18n.t('plugins_wd.gauge.gauge_upper_color_desc')
            },
            {
                name: 'gauge_mid_color',
                display_name: $.i18n.t('plugins_wd.gauge.gauge_mid_color'),
                type: 'color',
                validate: 'required,custom[hexcolor]',
                default_value: '#f9c802',
                description: $.i18n.t('plugins_wd.gauge.gauge_mid_color_desc')
            },
            {
                name: 'gauge_lower_color',
                display_name: $.i18n.t('plugins_wd.gauge.gauge_lower_color'),
                type: 'color',
                validate: 'required,custom[hexcolor]',
                default_value: '#a9d70b',
                description: $.i18n.t('plugins_wd.gauge.gauge_lower_color_desc')
            },
            {
                name: 'gauge_color',
                display_name: $.i18n.t('plugins_wd.gauge.gauge_color'),
                type: 'color',
                validate: 'required,custom[hexcolor]',
                default_value: '#edebeb',
                description: $.i18n.t('plugins_wd.gauge.gauge_color_desc')
            },
            {
                name: 'gauge_width',
                display_name: $.i18n.t('plugins_wd.gauge.gauge_width'),
                type: 'number',
                style: 'width:100px',
                validate: 'required,custom[integer],min[0],max[100]',
                default_value: 50,
                description: $.i18n.t('plugins_wd.gauge.gauge_width_desc')
            },
            {
                name: 'show_minmax',
                display_name: $.i18n.t('plugins_wd.gauge.show_minmax'),
                type: 'boolean',
                default_value: true
            },
            {
                name: 'min_value',
                display_name: $.i18n.t('plugins_wd.gauge.min_value'),
                type: 'number',
                style: 'width:100px',
                validate: 'required,custom[number],min[-100000000000],max[100000000000]',
                default_value: 0
            },
            {
                name: 'max_value',
                display_name: $.i18n.t('plugins_wd.gauge.max_value'),
                type: 'number',
                style: 'width:100px',
                validate: 'required,custom[number],min[-100000000000],max[100000000000]',
                default_value: 100,
                description: $.i18n.t('plugins_wd.gauge.max_value_desc')
            }
        ],
        newInstance: function (settings, newInstanceCallback) {
            newInstanceCallback(new gaugeWidget(settings));
        }
    });
}());

// ┌────────────────────────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                                                                      │ \\
// ├────────────────────────────────────────────────────────────────────┤ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                                                        │ \\
// ├────────────────────────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                                                        │ \\
// └────────────────────────────────────────────────────────────────────┘ \\

(function() {
	'use strict';

	var c3jsWidget = function (settings) {
		var self = this;
		var BLOCK_HEIGHT = 60;
		var PADDING = 10;

		var currentID = _.uniqueId('c3js_');
		var titleElement = $('<h2 class="section-title"></h2>');
		var chartElement = $('<div id="' + currentID + '"></div>');
		var currentSettings;
		var chart = null;

		function setBlocks(blocks) {
			if (_.isUndefined(blocks))
				return;

			var titlemargin = (titleElement.css('display') === 'none') ? 0 : titleElement.outerHeight();
			var height = (BLOCK_HEIGHT) * blocks - PADDING - titlemargin;
			chartElement.css({
				'max-height': height + 'px',
				'height': height + 'px',
				'width': '100%'
			});
			if (!_.isNull(chart))
				chart.resize();
		}

		function createWidget(data, chartsettings) {

			var options;

			// No need for the first load
			data = _.omit(data, '_op');

			Function.prototype.toJSON = Function.prototype.toString;

			if (!_.isUndefined(chartsettings.options)) {
				try {
					options = JSON.parse(chartsettings.options.replace(/'/g, '\\\"'), function(k,v) {
						var ret;
						var str = v.toString();
						if (str.indexOf('function') === 0)
							ret = eval('('+v+')');
						else if (str.indexOf('d3.') === 0)
							ret = eval('('+v+')');
						else
							ret = v;
						return ret;
					});
				} catch (e) {
					alert($.i18n.t('plugins_wd.c3js.options_invalid') + e);
					console.error(e);
					return;
				}
			}

			if (!_.isNull(chart)) {
				chartElement.resize(null);
				chart.destroy();
				chart = null;
			}

			var bind = {
				bindto: '#' + currentID,
			};
			options = _.merge(bind, _.merge(data, options));

			try {
				chart = c3.generate(options);
				chart.resize();
			} catch (e) {
				console.error(e);
				return;
			}
		}

		function destroyChart() {
			if (!_.isNull(chart)) {
				chart.destroy();
				chart = null;
			}
		}

		function plotData(data) {
			if (_.isNull(chart))
				return;

			var op = data._op;
			data = _.omit(data, '_op');

			try {
				switch (op) {
				case 'load':
					chart.load(data);
					break;
				case 'unload':
					chart.unload(data);
					break;
				case 'groups':
					chart.groups(data);
					break;
				case 'flow':
					chart.flow(data);
					break;
				case 'data.names':
					chart.data.names(data);
					break;
				case 'data.colors':
					chart.data.colors(data);
					break;
				case 'axis.labels':
					chart.axis.labels(data);
					break;
				case 'axis.max':
					chart.axis.max(data);
					break;
				case 'axis.min':
					chart.axis.min(data);
					break;
				case 'axis.range':
					chart.axis.range(data);
					break;
				case 'xgrids':
					if (!_.isUndefined(data.xgrids))
						chart.xgrids(data.xgrids);
					break;
				case 'xgrids.add':
					if (!_.isUndefined(data.xgrids))
						chart.xgrids.add(data.xgrids);
					break;
				case 'xgrids.remove':
					if (!_.isUndefined(data.xgrids))
						chart.xgrids.remove(data.xgrids);
					else
						chart.xgrids.remove();
					break;
				case 'transform':
					if (!_.isUndefined(data.type)) {
						if (!_.isUndefined(data.name))
							chart.transform(data.type, data.name);
						else
							chart.transform(data.type);
					}
					break;
				default:
					chart.load(data);
					break;
				}
			} catch (e) {
				console.error(e);
			}
		}

		this.render = function (element) {
			$(element).append(titleElement).append(chartElement);
			titleElement.html((_.isUndefined(currentSettings.title) ? '' : currentSettings.title));
			setBlocks(currentSettings.blocks);
		};

		this.onSettingsChanged = function (newSettings) {
			if (titleElement.outerHeight() === 0) {
				currentSettings = newSettings;
				return;
			}

			titleElement.html((_.isUndefined(newSettings.title) ? '' : newSettings.title));
			if (_.isUndefined(newSettings.title) || newSettings.title === '')
				titleElement.css('display', 'none');
			else
				titleElement.css('display', 'block');

			setBlocks(newSettings.blocks);

			var updateCalculate = false;
			if (currentSettings.options != newSettings.options) {
				destroyChart();
				updateCalculate = true;
			}
			if (currentSettings.value != newSettings.value)
				updateCalculate = true;

			currentSettings = newSettings;
			return updateCalculate;
		};

		this.onCalculatedValueChanged = function (settingName, newValue) {
			if (!_.isObject(newValue))
				return;

			if (_.isNull(chart))
				createWidget(newValue, currentSettings);
			else
				plotData(newValue);
		};

		this.onDispose = function () {
			destroyChart();
		};

		this.onSizeChanged = function () {
			if (!_.isNull(chart))
				chart.resize();
		};

		this.getHeight = function () {
			return currentSettings.blocks;
		};

		this.onSettingsChanged(settings);
	};

	freeboard.loadWidgetPlugin({
		type_name: 'c3js',
		display_name: $.i18n.t('plugins_wd.c3js.display_name'),
		description: $.i18n.t('plugins_wd.c3js.description'),
		external_scripts : [
			'plugins/thirdparty/c3.min.js'
		],
		settings: [
			{
				name: 'title',
				display_name: $.i18n.t('plugins_wd.c3js.title'),
				validate: 'optional,maxSize[100]',
				type: 'text',
				description: $.i18n.t('plugins_wd.c3js.title_desc'),
			},
			{
				name: 'blocks',
				display_name: $.i18n.t('plugins_wd.c3js.blocks'),
				validate: 'required,custom[integer],min[2],max[20]',
				type: 'number',
				style: 'width:100px',
				default_value: 4,
				description: $.i18n.t('plugins_wd.c3js.blocks_desc')
			},
			{
				name: 'value',
				display_name: $.i18n.t('plugins_wd.c3js.value'),
				validate: 'optional,maxSize[5000]',
				type: 'calculated',
				description: $.i18n.t('plugins_wd.c3js.value_desc')
			},
			{
				name: 'options',
				display_name: $.i18n.t('plugins_wd.c3js.options'),
				validate: 'optional,maxSize[5000]',
				type: 'json',
				default_value: '{\n\
	"data": {\n\
		"type": "line"\n\
	}\n\
}',
				description: $.i18n.t('plugins_wd.c3js.options_desc')
			}
		],

		newInstance: function (settings, newInstanceCallback) {
			newInstanceCallback(new c3jsWidget(settings));
		}
	});
}());

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

(function() {
    'use strict';

    freeboard.addStyle('.indicator-light', 'border-radius:50%;width:22px;height:22px;border:2px solid #3d3d3d;margin-top:5px;float:left;background-color:#222;margin-right:10px;');
    freeboard.addStyle('.indicator-light.on', 'background-color:#FFC773;box-shadow: 0px 0px 15px #FF9900;border-color:#FDF1DF;');
    freeboard.addStyle('.indicator-text', 'margin-top:10px;');

    var indicatorWidget = function(settings) {
        var self = this;
        var titleElement = $('<h2 class="section-title"></h2>');
        var stateElement = $('<div class="indicator-text"></div>');
        var indicatorElement = $('<div class="indicator-light"></div>');
        var currentSettings = settings;
        var isOn = false;

        function updateState() {
            indicatorElement.toggleClass('on', isOn);

            if (isOn) {
                stateElement.text((_.isUndefined(currentSettings.on_text) ? '' : currentSettings.on_text));
            }
            else {
                stateElement.text((_.isUndefined(currentSettings.off_text) ? '' : currentSettings.off_text));
            }
        }

        this.render = function (element) {
            $(element).append(titleElement).append(indicatorElement).append(stateElement);
        };

        this.onSettingsChanged = function (newSettings) {
            currentSettings = newSettings;
            titleElement.html((_.isUndefined(newSettings.title) ? '' : newSettings.title));
            updateState();
            return true;
        };

        this.onCalculatedValueChanged = function (settingName, newValue) {
            if (settingName === 'value') {
                isOn = Boolean(newValue);
            }

            updateState();
        };

        this.onDispose = function () {
        };

        this.getHeight = function () {
            return 1;
        };

        this.onSettingsChanged(settings);
    };

    freeboard.loadWidgetPlugin({
        type_name: 'indicator',
        display_name: $.i18n.t('plugins_wd.indicator.display_name'),
        description: $.i18n.t('plugins_wd.indicator.description.display_name'),
        settings: [
            {
                name: 'title',
                display_name: $.i18n.t('plugins_wd.indicator.title'),
                validate: 'optional,maxSize[100]',
                type: 'text',
                description: $.i18n.t('plugins_wd.indicator.title_desc')
            },
            {
                name: 'value',
                display_name: $.i18n.t('plugins_wd.indicator.value'),
                validate: 'optional,maxSize[2000]',
                type: 'calculated',
                description: $.i18n.t('plugins_wd.indicator.value_desc')
            },
            {
                name: 'on_text',
                display_name: $.i18n.t('plugins_wd.indicator.on_text'),
                validate: 'optional,maxSize[500]',
                type: 'calculated',
                description: $.i18n.t('plugins_wd.indicator.on_text_desc')
            },
            {
                name: 'off_text',
                display_name: $.i18n.t('plugins_wd.indicator.off_text'),
                validate: 'optional,maxSize[500]',
                type: 'calculated',
                description: $.i18n.t('plugins_wd.indicator.off_text_desc')
            }
        ],
        newInstance: function (settings, newInstanceCallback) {
            newInstanceCallback(new indicatorWidget(settings));
        }
    });
}());

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

(function() {
    'use strict';

    freeboard.addStyle('.picture-widget', 'background-size:contain; background-position:center; background-repeat: no-repeat;');

    var pictureWidget = function(settings) {
        var self = this;
        var BLOCK_HEIGHT = 60;
        var PADDING = 10;

        var widgetElement = $('<div class="picture-widget"></div>');
        var titleElement = $('<h2 class="section-title"></h2>');
        var currentSettings;
        var timer;
        var imageURL;

        function setBlocks(blocks) {
            if (_.isUndefined(blocks))
                return;
            var titlemargin = (titleElement.css('display') === 'none') ? 0 : titleElement.outerHeight();
            var height = (BLOCK_HEIGHT) * blocks - PADDING - titlemargin;
            widgetElement.css({
                'height': height + 'px',
                'width': '100%'
            });
        }

        function stopTimer() {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        }

        function updateImage() {
            if (widgetElement && imageURL) {
                var cacheBreakerURL = imageURL + (imageURL.indexOf('?') === -1 ? '?' : '&') + Date.now();

                $(widgetElement).css({
                    'background-image' :  'url(' + cacheBreakerURL + ')'
                });
            }
        }

        this.render = function(element) {
            $(element).append(titleElement).append(widgetElement);
            titleElement.html((_.isUndefined(currentSettings.title) ? '' : currentSettings.title));
            setBlocks(currentSettings.blocks);
        };

        this.onSettingsChanged = function(newSettings) {
            if (titleElement.outerHeight() === 0) {
                currentSettings = newSettings;
                return;
            }
            stopTimer();

            if (newSettings.refresh && newSettings.refresh > 0)
                timer = setInterval(updateImage, Number(newSettings.refresh) * 1000);

            titleElement.html((_.isUndefined(newSettings.title) ? '' : newSettings.title));
            if (_.isUndefined(newSettings.title) || newSettings.title === '')
                titleElement.css('display', 'none');
            else
                titleElement.css('display', 'block');

            setBlocks(newSettings.blocks);
            var updateCalculate = false;
            if (currentSettings.src != newSettings.src)
                updateCalculate = true;
            currentSettings = newSettings;
            return updateCalculate;
        };

        this.onCalculatedValueChanged = function(settingName, newValue) {
            if (settingName === 'src')
                imageURL = newValue;

            updateImage();
        };

        this.onDispose = function() {
            stopTimer();
        };

        this.getHeight = function() {
            return currentSettings.blocks;
        };

        this.onSettingsChanged(settings);
    };

    freeboard.loadWidgetPlugin({
        type_name: 'picture',
        display_name: $.i18n.t('plugins_wd.picture.display_name'),
        description: $.i18n.t('plugins_wd.picture.description'),
        settings: [
            {
                name: 'title',
                display_name: $.i18n.t('plugins_wd.picture.title'),
                validate: 'optional,maxSize[100]',
                type: 'text',
                description: $.i18n.t('plugins_wd.picture.title_desc')
            },
            {
                name: 'blocks',
                display_name: $.i18n.t('plugins_wd.picture.blocks'),
                validate: 'required,custom[integer],min[4],max[20]',
                type: 'number',
                style: 'width:100px',
                default_value: 4,
                description: $.i18n.t('plugins_wd.picture.blocks_desc'),
            },
            {
                name: 'src',
                display_name: $.i18n.t('plugins_wd.picture.src'),
                validate: 'optional,maxSize[2000]',
                type: 'calculated',
                description: $.i18n.t('plugins_wd.picture.src_desc')
            },
            {
                name: 'refresh',
                display_name: $.i18n.t('plugins_wd.picture.refresh'),
                validate: 'optional,custom[integer],min[1]',
                type: 'number',
                style: 'width:100px',
                suffix: $.i18n.t('plugins_wd.picture.refresh_suffix'),
                description: $.i18n.t('plugins_wd.picture.refresh_desc')
            }
        ],
        newInstance: function (settings, newInstanceCallback) {
            newInstanceCallback(new pictureWidget(settings));
        }
    });
}());

// ┌─────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                │ \\
// ├─────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                       │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                             │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                  │ \\
// ├─────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                  │ \\
// └─────────────────────────────────────────┘ \\

(function() {
    'use strict';

    freeboard.addStyle('.htmlwidget', 'white-space:normal;display:table;');
    freeboard.addStyle('.htmlwidget > *',
        '-moz-box-sizing: border-box;' +
        '-webkit-box-sizing: border-box;' +
        'box-sizing: border-box;');

    var htmlWidget = function (settings) {
        var self = this;
        var BLOCK_HEIGHT = 60;

        var currentID = _.uniqueId('htmlwidget_');
        var htmlElement = $('<div class="htmlwidget" id="' + currentID + '"></div>');
        var currentSettings = settings;

        function setBlocks(blocks) {
            if (_.isUndefined(blocks))
                return;
            var height = BLOCK_HEIGHT * blocks;
            htmlElement.css({
                'height': height + 'px',
                'width': '100%'
            });
        }

        this.render = function (element) {
            $(element).append(htmlElement);
            setBlocks(currentSettings.blocks);
        };

        this.onSettingsChanged = function (newSettings) {
            setBlocks(newSettings.blocks);
            htmlElement.html(newSettings.contents);

            var updateCalculate = false;
            if (currentSettings.value != newSettings.value)
                updateCalculate = true;

            currentSettings = newSettings;
            return updateCalculate;
        };

        this.onCalculatedValueChanged = function (settingName, newValue) {
        };

        this.onDispose = function () {
            htmlElement.remove();
        };

        this.getHeight = function () {
            return currentSettings.blocks;
        };

        this.onSettingsChanged(settings);
    };

    freeboard.loadWidgetPlugin({
        type_name: 'html',
        display_name: $.i18n.t('plugins_wd.html.display_name'),
        description: $.i18n.t('plugins_wd.html.description'),
        fill_size: true,
        settings: [
            {
                name: 'contents',
                display_name: $.i18n.t('plugins_wd.html.contents'),
                type: 'htmlmixed',
                validate: 'optional,maxSize[5000]',
                description: $.i18n.t('plugins_wd.html.contents_desc')
            },
            {
                name: 'value',
                display_name: $.i18n.t('plugins_wd.html.value'),
                validate: 'optional,maxSize[2000]',
                type: 'calculated',
                description: $.i18n.t('plugins_wd.html.value_desc')
            },
            {
                name: 'blocks',
                display_name: $.i18n.t('plugins_wd.html.blocks'),
                type: 'number',
                validate: 'required,custom[integer],min[1],max[10]',
                style: 'width:100px',
                default_value: 4,
                description: $.i18n.t('plugins_wd.html.blocks_desc')
            }
        ],
        newInstance: function (settings, newInstanceCallback) {
            newInstanceCallback(new htmlWidget(settings));
        }
    });
}());